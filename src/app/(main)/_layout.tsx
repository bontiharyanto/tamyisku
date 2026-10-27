import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppearance } from '@/lib/appearance';
import { selectionHaptic } from '@/lib/haptics';
import { colors, latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { BrandLogo } from '@/components/BrandLogo';
import { NavIcon, type NavIconName } from '@/components/NavIcon';
import { Onboarding } from '@/components/Onboarding';
import { StreakPanel } from '@/components/StreakPanel';

const TAB_META: Record<string, { label: string; icon: NavIconName }> = {
  index: { label: 'Beranda', icon: 'home' },
  belajar: { label: 'Belajar', icon: 'book' },
  kuis: { label: 'Kuis', icon: 'award' },
  streak: { label: 'Streak', icon: 'flame' },
  profile: { label: 'Profil', icon: 'trophy' },
  settings: { label: 'Pengaturan', icon: 'settings' },
};

const LINKS: { href: '/(main)' | '/(main)/belajar' | '/(main)/kuis' | '/(main)/streak' | '/(main)/profile'; label: string; icon: NavIconName; match: (path: string) => boolean }[] = [
  { href: '/(main)', label: 'Beranda', icon: 'home', match: (path) => path === '/' || path === '/(main)' },
  { href: '/(main)/belajar', label: 'Belajar', icon: 'book', match: (path) => path.endsWith('/belajar') },
  { href: '/(main)/kuis', label: 'Kuis', icon: 'award', match: (path) => path.endsWith('/kuis') },
  { href: '/(main)/streak', label: 'Streak', icon: 'flame', match: (path) => path.endsWith('/streak') },
  { href: '/(main)/profile', label: 'Profil', icon: 'trophy', match: (path) => path.endsWith('/profile') },
];

const PHONE_TABS = ['index', 'belajar', 'kuis', 'streak', 'profile'];

function StudentTabBar({ state }: { state: { index: number; routes: { key: string; name: string }[] } }) {
  const insets = useSafeAreaInsets();
  const palette = useAppearance().palette;
  const router = useRouter();
  const current = state.routes[state.index]?.name;
  return (
    <View style={[styles.tabBar, { bottom: Math.max(insets.bottom, 10), backgroundColor: palette.card, borderColor: palette.line }]}>
      {state.routes
        .filter((route) => PHONE_TABS.includes(route.name))
        .map((route) => {
          const meta = TAB_META[route.name] ?? { label: route.name, icon: 'home' as const };
          const focused = current === route.name;
          const href = LINKS.find((link) => link.icon === meta.icon)?.href;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              onPress={() => {
                if (focused || !href) return;
                selectionHaptic();
                router.push(href);
              }}
              style={({ pressed }) => [styles.tab, focused && styles.tabOn, pressed && styles.pressed]}
            >
              <NavIcon name={meta.icon} color={focused ? '#FFFFFF' : colors.muted} size={18} />
              <Text style={[styles.tabLabel, { color: focused ? '#FFFFFF' : colors.muted }]}>{meta.label}</Text>
            </Pressable>
          );
        })}
    </View>
  );
}

export default function MainLayout() {
  const { phone, expanded } = useViewport();
  const { palette, ready, onboarded, completeOnboarding } = useAppearance();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settingsOn = pathname.endsWith('/settings');
  const dockSpace = 76 + Math.max(insets.bottom, 10);

  return (
    <View style={[styles.shell, { backgroundColor: palette.background }, !phone && styles.row]}>
      {phone ? null : (
        <View style={[styles.side, { paddingTop: insets.top + 12, backgroundColor: palette.card, borderRightColor: palette.line }]}>
          <View style={styles.brandPlate}>
            <BrandLogo width={148} />
          </View>
          {LINKS.map((link) => {
            const active = link.match(pathname);
            return (
              <Pressable
                key={link.href}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={link.label}
                onPress={() => {
                  selectionHaptic();
                  router.push(link.href);
                }}
                style={({ pressed }) => [styles.link, active && styles.linkOn, pressed && styles.pressed]}
              >
                <NavIcon name={link.icon} color={active ? '#FFFFFF' : '#0F5132'} />
                <Text style={[styles.linkText, { color: active ? '#FFFFFF' : palette.text }]}>{link.label}</Text>
              </Pressable>
            );
          })}
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: settingsOn }}
            onPress={() => router.push('/(main)/settings')}
            style={[styles.link, settingsOn && styles.linkOn]}
          >
            <NavIcon name="settings" color={settingsOn ? '#FFFFFF' : '#0F5132'} />
            <Text style={[styles.linkText, { color: settingsOn ? '#FFFFFF' : palette.text }]}>Pengaturan</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.body}>
        <Tabs
          tabBar={(props) => (phone ? <StudentTabBar state={props.state} /> : null)}
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.white,
            headerTitleStyle: { ...latinFont, fontWeight: '700' },
            sceneStyle: { backgroundColor: palette.background, paddingBottom: phone ? dockSpace : 0 },
            headerRight: phone
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pengaturan"
                    onPress={() => {
                      selectionHaptic();
                      router.push('/(main)/settings');
                    }}
                    style={({ pressed }) => [styles.headerHit, pressed && styles.pressed]}
                  >
                    <NavIcon name="settings" color={colors.white} />
                  </Pressable>
                )
              : undefined,
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
          <Tabs.Screen name="belajar" options={{ title: 'Belajar' }} />
          <Tabs.Screen name="kuis" options={{ title: 'Kuis' }} />
          <Tabs.Screen name="streak" options={{ title: 'Streak' }} />
          <Tabs.Screen name="profile" options={{ title: 'Profil Saya' }} />
          <Tabs.Screen name="settings" options={{ title: 'Pengaturan' }} />
        </Tabs>
      </View>
      {expanded && !pathname.endsWith('/profile') ? (
        <View style={[styles.rail, { paddingTop: insets.top + 16, borderLeftColor: palette.line, backgroundColor: palette.background }]}>
          <Text style={[styles.railTitle, { color: palette.text }]}>Progres</Text>
          <StreakPanel />
        </View>
      ) : null}
      {ready && !onboarded ? <Onboarding onDone={completeOnboarding} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  row: { flexDirection: 'row' },
  body: { flex: 1, minWidth: 0 },
  side: { width: 240, padding: 16, gap: 6, borderRightWidth: 1 },
  brandPlate: { alignItems: 'center', marginBottom: 12 },
  link: { minHeight: 48, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkOn: { backgroundColor: '#0F5132' },
  linkText: { ...latinFont, color: '#1C1915', fontWeight: '700' },
  linkTextOn: { color: '#FFFFFF' },
  spacer: { flex: 1 },
  rail: { width: 300, borderLeftWidth: 1, padding: 16, gap: 12 },
  railTitle: { ...latinFont, fontSize: 18, fontWeight: '800' },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 28,
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#0A3A24',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tab: { flex: 1, minHeight: 48, minWidth: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabOn: { backgroundColor: '#0F5132' },
  tabLabel: { ...latinFont, fontSize: 10, fontWeight: '800' },
  pressed: { transform: [{ scale: 0.96 }] },
  headerHit: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
