import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppearance, useColors } from '@/lib/appearance';
import { selectionHaptic } from '@/lib/haptics';
import type { UserRole } from '@/lib/types';
import { roleLabel } from '@/lib/types';
import { latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, Screen } from '@/components/ui';

type LinkItem = { href: Href; label: string; icon: string };

function linksFor(role: UserRole): LinkItem[] {
  const base: LinkItem[] = [
    { href: '/dashboard', label: 'Dasbor', icon: '▣' },
    { href: '/(main)/belajar', label: 'Belajar', icon: 'أ' },
    { href: '/(main)/kuis', label: 'Kuis', icon: '؟' },
    { href: '/(main)/profile', label: 'Profil', icon: '●' },
  ];
  if (role === 'tutor' || role === 'admin') base.splice(1, 0, { href: '/tutor/lessons', label: 'Materi', icon: '✎' });
  if (role === 'admin') base.push({ href: '/admin', label: 'Admin', icon: '⚙' });
  return base;
}

export function DashboardShell({ role, children }: { role: UserRole; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, dark, setMode } = useAppearance();
  const { phone } = useViewport();
  const [collapsed, setCollapsed] = useState(!phone ? false : true);
  const links = linksFor(role);
  const side = !phone;

  return (
    <View style={[styles.root, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <View style={styles.row}>
        {side ? (
          <View style={[styles.side, { width: collapsed ? 76 : 220, backgroundColor: palette.card, borderRightColor: palette.line }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ciutkan menu" onPress={() => setCollapsed((value) => !value)} style={styles.brandRow}>
              <BrandLogo variant={collapsed ? 'mark' : 'lockup'} width={collapsed ? 40 : 148} />
            </Pressable>
            {links.map((link) => (
              <Pressable
                key={link.label}
                accessibilityRole="button"
                onPress={() => {
                  selectionHaptic();
                  router.push(link.href);
                }}
                style={styles.navItem}
              >
                <Text style={styles.navIcon}>{link.icon}</Text>
                {collapsed ? null : <Text style={styles.navLabel}>{link.label}</Text>}
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={[styles.main, phone && styles.mainPhone]}>
          <View style={styles.top}>
            <Text style={[styles.role, { color: palette.text }]}>{roleLabel(role)}</Text>
            <Pressable accessibilityRole="button" onPress={() => setMode(dark ? 'light' : 'dark')} style={styles.mode}>
              <Text style={styles.modeText}>{dark ? 'Terang' : 'Gelap'}</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
      {phone ? (
        <View pointerEvents="box-none" style={[styles.dockWrap, { bottom: Math.max(insets.bottom, 10) }]}>
          <View style={[styles.dock, { backgroundColor: palette.card, borderColor: palette.line }]}>
          {links.map((link) => (
            <Pressable
              key={link.label}
              accessibilityRole="button"
              onPress={() => {
                selectionHaptic();
                router.push(link.href);
              }}
              style={({ pressed }) => [styles.dockItem, pressed && styles.pressed]}
            >
              <Text style={styles.navIcon}>{link.icon}</Text>
              <Text style={styles.dockLabel}>{link.label}</Text>
            </Pressable>
          ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export class DashboardErrorBoundary extends Component<{ children: ReactNode }, { error: string | null; tick: number }> {
  state = { error: null as string | null, tick: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <Screen edges={['top', 'bottom']}>
          <Text style={styles.errorTitle}>Dasbor tidak bisa dimuat</Text>
          <Text style={styles.errorBody}>{this.state.error}</Text>
          <Button label="Coba lagi" onPress={() => this.setState((current) => ({ error: null, tick: current.tick + 1 }))} />
        </Screen>
      );
    }
    return <View key={this.state.tick} style={styles.fill}>{this.props.children}</View>;
  }
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const { palette } = useAppearance();
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [opacity]);
  return (
    <Animated.View style={[styles.stat, { opacity, backgroundColor: palette.card, borderColor: palette.line }]}>
      <Text style={[styles.statValue, { color: palette.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: palette.muted }]}>{hint}</Text> : null}
    </Animated.View>
  );
}

export function FlameCount({ value }: { value: number }) {
  const palette = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  useEffect(() => {
    if (value <= 0) {
      setShown(0);
      return;
    }
    let current = 0;
    const step = Math.max(1, Math.round(value / 12));
    const timer = setInterval(() => {
      current = Math.min(value, current + step);
      setShown(current);
      if (current >= value) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <View style={styles.flameRow}>
      <Animated.Text style={[styles.flame, { transform: [{ scale }] }]}>🔥</Animated.Text>
      <Text style={[styles.flameCount, { color: palette.primary }]}>{shown}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  side: { borderRightWidth: 1, padding: 12, gap: 4 },
  brandRow: { alignItems: 'center', marginBottom: 12 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8 },
  navIcon: { fontSize: 16, width: 24, textAlign: 'center', color: '#0F5132' },
  navLabel: { ...latinFont, fontWeight: '700', color: '#1C1915' },
  main: { flex: 1, minWidth: 0 },
  mainPhone: { paddingBottom: 96 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  role: { ...latinFont, fontWeight: '800' },
  mode: { borderWidth: 1, borderColor: '#D4AF37', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  modeText: { ...latinFont, fontWeight: '700', color: '#0F5132' },
  dockWrap: { position: 'absolute', left: 12, right: 12 },
  dock: { flexDirection: 'row', borderWidth: 1, borderRadius: 28, paddingVertical: 6, paddingHorizontal: 4, shadowColor: '#0A3A24', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  dockItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { transform: [{ scale: 0.96 }] },
  dockLabel: { ...latinFont, fontSize: 11, fontWeight: '700', color: '#5C564C' },
  stat: { borderWidth: 1, borderRadius: 16, padding: 16, flexGrow: 1, flexBasis: 160, gap: 4 },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { ...latinFont, fontWeight: '700', color: '#1C1915' },
  hint: { ...latinFont, color: '#5C564C', fontSize: 13 },
  flameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flame: { fontSize: 28 },
  flameCount: { ...latinFont, fontSize: 28, fontWeight: '800', color: '#0F5132' },
  errorTitle: { ...latinFont, fontSize: 22, fontWeight: '800', color: '#0F5132' },
  errorBody: { ...latinFont, color: '#5C564C' },
});
