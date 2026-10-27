import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppearance } from '@/lib/appearance';
import { selectionHaptic } from '@/lib/haptics';
import { categoryVisual, colors, latinFont } from '@/lib/theme';

const STEPS = [
  {
    title: 'Tiga warna Tamyiz',
    body: 'Biru untuk isim, merah untuk fi\'il, hijau untuk huruf. Kuning menandai rumus atau kosa kata yang diulang.',
  },
  {
    title: 'Baca dari kanan',
    body: 'Kartu ayat tersusun dari kanan ke kiri. Dengarkan setiap kata, lalu lihat arti dan kelasnya di kartu yang sama.',
  },
  {
    title: 'Kuis membuka surah',
    body: 'Nilai 80 menyimpan progres dan membuka surah berikutnya. Nyala streak dan lencana mengikuti hari belajar Anda.',
  },
] as const;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();
  const { palette, dark } = useAppearance();
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  function next() {
    selectionHaptic();
    if (last) onDone();
    else setStep((value) => value + 1);
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.copy}>
        <Text style={styles.kicker}>Langkah {step + 1} dari {STEPS.length}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{current.title}</Text>
        <Text style={[styles.body, { color: palette.muted }]}>{current.body}</Text>
        {step === 0 ? (
          <View style={styles.swatches}>
            {(['Isim', "Fi'il", 'Huruf', 'Tamyiz 1'] as const).map((category) => {
              const visual = categoryVisual(category, null, dark);
              return (
                <View key={category} style={[styles.swatch, { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor }]}>
                  <Text style={[styles.swatchText, { color: visual.textColor }]}>{visual.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={styles.dots}>
        {STEPS.map((item, index) => (
          <View key={item.title} style={[styles.dot, index === step && styles.dotOn]} />
        ))}
      </View>
      <View style={styles.actions}>
        {last ? null : (
          <Pressable accessibilityRole="button" onPress={onDone} style={styles.ghost}>
            <Text style={styles.ghostText}>Lewati</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={next} style={styles.primary}>
          <Text style={styles.primaryText}>{last ? 'Mulai belajar' : 'Lanjut'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, zIndex: 20, paddingHorizontal: 24, justifyContent: 'space-between' },
  copy: { gap: 12, marginTop: 24 },
  kicker: { ...latinFont, color: colors.gold, fontWeight: '800' },
  title: { ...latinFont, fontSize: 32, fontWeight: '800', lineHeight: 40 },
  body: { ...latinFont, fontSize: 17, lineHeight: 26 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  swatch: { borderWidth: 2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  swatchText: { ...latinFont, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E6E0D6' },
  dotOn: { width: 22, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', gap: 10 },
  ghost: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  ghostText: { ...latinFont, color: colors.primary, fontWeight: '800' },
  primary: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...latinFont, color: colors.white, fontWeight: '800' },
});
