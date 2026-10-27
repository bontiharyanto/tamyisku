import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppearance } from '@/lib/appearance';
import { selectionHaptic } from '@/lib/haptics';

export function NightModeToggle() {
  const { dark, setMode, palette } = useAppearance();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel={dark ? 'Matikan mode malam' : 'Nyalakan mode malam'}
      onPress={() => {
        selectionHaptic();
        setMode(dark ? 'light' : 'dark');
      }}
      style={({ pressed }) => [styles.hit, { backgroundColor: palette.card, borderColor: palette.line }, pressed && styles.pressed]}
    >
      {dark ? <Moon color={palette.gold} /> : <Sun color="#FF8F00" />}
    </Pressable>
  );
}

function Sun({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M12 2.5v2.2M12 19.3V21.5M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function Moon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  hit: { minWidth: 48, minHeight: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.96 }] },
});
