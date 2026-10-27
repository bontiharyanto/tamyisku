import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { loadOwnSubscription, mapSubscription, updateFullName } from '@/lib/api';
import { demoCurrentUser, demoSignIn, demoSignOut, demoSubscription, hydrateDemo, subscribeDemo } from '@/lib/demoStore';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser, Subscription } from '@/lib/types';
import { isSubscriptionActive, teaches } from '@/lib/types';

type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  user: AppUser | null;
  subscription: Subscription | null;
  premium: boolean;
  dataVersion: number;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<'session' | 'confirm'>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveName: (fullName: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function profileFromSession(session: Session): Promise<{ user: AppUser; subscription: Subscription }> {
  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('id', session.user.id)
    .maybeSingle();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const row = profile as { email?: string; full_name?: string; role?: string } | null;
  return {
    user: {
      id: session.user.id,
      email: row?.email ?? session.user.email ?? '',
      fullName: row?.full_name ?? String(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? ''),
      role: row?.role === 'admin' ? 'admin' : row?.role === 'tutor' ? 'tutor' : 'user',
    },
    subscription: mapSubscription((subscription as Record<string, unknown> | null) ?? null),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let demoUnsub = () => {};
    let authUnsub = () => {};

    async function boot() {
      if (!isSupabaseConfigured) {
        await hydrateDemo();
        if (cancelled) return;
        const apply = () => {
          const current = demoCurrentUser();
          setUser(current);
          setSubscription(current ? demoSubscription(current.id) : null);
          setDataVersion((value) => value + 1);
        };
        apply();
        demoUnsub = subscribeDemo(apply);
        setReady(true);
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => {
          if (cancelled) return;
          if (!session) {
            setUser(null);
            setSubscription(null);
            return;
          }
          void profileFromSession(session).then((next) => {
            if (cancelled) return;
            setUser(next.user);
            setSubscription(next.subscription);
          });
        }, 0);
      });
      authUnsub = () => listener.subscription.unsubscribe();
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        const next = await profileFromSession(data.session);
        setUser(next.user);
        setSubscription(next.subscription);
      }
      if (!cancelled) setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
      demoUnsub();
      authUnsub();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    const channel = supabase
      .channel(`subscription-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` },
        () => {
          void loadOwnSubscription(user.id).then(setSubscription);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: isSupabaseConfigured,
      user,
      subscription,
      premium: isSubscriptionActive(subscription) || teaches(user?.role),
      dataVersion,
      async signIn(email, password) {
        if (!isSupabaseConfigured) {
          if (!email.includes('@') || password.length < 6) throw new Error('Email dan kata sandi minimal 6 karakter.');
          demoSignIn(email);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message);
      },
      async signUp(email, password, fullName) {
        if (!isSupabaseConfigured) {
          if (!email.includes('@') || password.length < 6) throw new Error('Email dan kata sandi minimal 6 karakter.');
          demoSignIn(email, fullName);
          return 'session';
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw new Error(error.message);
        return data.session ? 'session' : 'confirm';
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) {
          throw new Error('Google Sign-In aktif setelah Supabase dikonfigurasi.');
        }
        const redirectTo = makeRedirectUri({ scheme: 'tamyizku', path: 'auth-callback' });
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
        });
        if (error) throw new Error(error.message);
        if (Platform.OS === 'web' || !data.url) return;
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') return;
        const parsed = new URL(result.url);
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token') ?? parsed.searchParams.get('access_token');
        const refreshToken = hash.get('refresh_token') ?? parsed.searchParams.get('refresh_token');
        if (!accessToken || !refreshToken) throw new Error('Sesi Google tidak lengkap.');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw new Error(sessionError.message);
      },
      async resetPassword(email) {
        if (!isSupabaseConfigured) {
          throw new Error('Pemulihan kata sandi aktif setelah Supabase dikonfigurasi.');
        }
        const redirectTo = makeRedirectUri({ scheme: 'tamyizku', path: 'auth-callback' });
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw new Error(error.message);
      },
      async signOut() {
        if (!isSupabaseConfigured) {
          demoSignOut();
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
      },
      async saveName(fullName) {
        if (!user) return;
        await updateFullName(user.id, fullName);
        if (isSupabaseConfigured) setUser({ ...user, fullName });
      },
      async refreshSubscription() {
        if (!user) return;
        setSubscription(await loadOwnSubscription(user.id));
      },
    }),
    [ready, user, subscription, dataVersion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

WebBrowser.maybeCompleteAuthSession();
