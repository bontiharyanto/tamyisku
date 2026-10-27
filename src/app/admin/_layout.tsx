import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectionHaptic } from '@/lib/haptics';
import { useAuth } from '@/lib/auth';
import { fetchOpenTicketCount, subscribeSupportTickets } from '@/lib/support';
import { useViewport } from '@/lib/viewport';
import { colors, latinFont } from '@/lib/theme';
import { BootScreen, Button, Screen } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';

const LINKS = [
  { href: '/admin', label: 'Ringkasan' },
  { href: '/admin/content', label: 'Kelola Modul' },
  { href: '/admin/lessons', label: 'Audio Modul' },
  { href: '/admin/users', label: 'Kelola User' },
  { href: '/admin/settings', label: 'Pengaturan' },
  { href: '/admin/support', label: 'Dukungan' },
] as const;

export default function AdminLayout() {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { compact, medium } = useViewport();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void fetchOpenTicketCount()
        .then((count) => {
          if (active) setOpenTickets(count);
        })
        .catch(() => {
          if (active) setOpenTickets(0);
        });
    };
    refresh();
    const unsubscribe = subscribeSupportTickets(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pathname]);

  if (!ready) return <BootScreen />;
  if (user?.role !== 'admin') {
    return (
      <Screen edges={['top', 'bottom']}>
        <Text style={styles.code}>403</Text>
        <Text style={styles.denied}>Access Denied (403)</Text>
        <Text style={styles.note}>Halaman ini hanya untuk pengguna dengan peran admin.</Text>
        <Button label="Kembali" onPress={() => router.replace('/(main)')} />
      </Screen>
    );
  }

  const collapsed = medium && !open;

  return (
    <View style={[styles.shell, !compact && styles.shellWide]}>
      {compact ? null : (
        <View style={[styles.side, collapsed ? styles.sideCollapsed : styles.sideWide]}>
          <View style={styles.brandPlate}>
            <BrandLogo variant={collapsed ? 'mark' : 'lockup'} width={collapsed ? 44 : 150} />
          </View>
          {medium ? (
            <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={styles.link}>
              <Text style={styles.linkText}>{open ? 'Tutup' : 'Menu'}</Text>
            </Pressable>
          ) : null}
          <View style={styles.menu}>
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Pressable key={link.href} accessibilityRole="button" onPress={() => router.push(link.href)} style={[styles.link, active && styles.linkOn]}>
                  <Text style={[styles.linkText, active && styles.linkTextOn]}>
                    {collapsed ? link.label.slice(0, 1) : link.label}
                    {!collapsed && link.href === '/admin/support' && openTickets > 0 ? ` (${openTickets})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <View style={[styles.body, compact && { paddingBottom: 72 + insets.bottom }]}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.white,
            headerTitleStyle: { ...latinFont, fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
            headerShown: compact,
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Ringkasan' }} />
          <Stack.Screen name="users" options={{ title: 'Kelola User' }} />
          <Stack.Screen name="content" options={{ title: 'Kelola Modul' }} />
          <Stack.Screen name="lessons" options={{ title: 'Audio Modul' }} />
          <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
          <Stack.Screen name="support" options={{ title: 'Dukungan' }} />
        </Stack>
      </View>
      {compact ? (
        <View style={[styles.bottomWrap, { bottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.bottom}>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Pressable
                key={link.href}
                accessibilityRole="button"
                onPress={() => {
                  selectionHaptic();
                  router.push(link.href);
                }}
                style={({ pressed }) => [styles.bottomLink, pressed && styles.pressed]}
              >
                <Text style={[styles.bottomText, active && styles.bottomTextOn]}>{link.label.split(' ')[0]}</Text>
              </Pressable>
            );
          })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  shellWide: { flexDirection: 'row' },
  side: { backgroundColor: colors.primaryDark, padding: 16, gap: 8 },
  sideWide: { width: 260 },
  sideCollapsed: { width: 84 },
  brandPlate: { backgroundColor: colors.white, borderRadius: 16, padding: 6, alignItems: 'center' },
  menu: { gap: 4 },
  link: { borderRadius: 12, paddingHorizontal: 12, minHeight: 48, justifyContent: 'center' },
  linkOn: { backgroundColor: colors.primary },
  linkText: { ...latinFont, color: '#D7E6E1', fontWeight: '700' },
  linkTextOn: { color: colors.white },
  body: { flex: 1, paddingBottom: 0 },
  bottomWrap: { position: 'absolute', left: 8, right: 8 },
  bottom: { flexDirection: 'row', backgroundColor: colors.primaryDark, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 4 },
  bottomLink: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.96 }] },
  bottomText: { ...latinFont, color: '#D7E6E1', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  bottomTextOn: { color: colors.white },
  code: { fontSize: 48, fontWeight: '800', color: colors.danger },
  denied: { ...latinFont, fontSize: 22, fontWeight: '800' },
  note: { ...latinFont, color: colors.muted },
});
