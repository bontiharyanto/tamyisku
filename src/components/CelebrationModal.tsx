import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { playCelebration } from '@/lib/audio';
import type { LevelBadge, LevelResult } from '@/lib/leveling';
import type { Celebration } from '@/lib/types';
import { colors, latinFont } from '@/lib/theme';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/ui';

const DOTS = ['#FF8F00', '#0F5132', '#FFF8E1', '#0D47A1', '#B71C1C', '#1B5E20'];

export function CelebrationModal({
  celebration,
  onClose,
}: {
  celebration: Celebration | null;
  onClose: () => void;
}) {
  const fall = useRef(DOTS.map(() => new Animated.Value(0))).current;
  const visible = !!celebration && (celebration.streakIncreased || celebration.newBadges.length > 0);

  useEffect(() => {
    if (!visible) return;
    playCelebration();
    fall.forEach((value) => value.setValue(0));
    Animated.stagger(
      70,
      fall.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [visible, fall, celebration]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.confetti} pointerEvents="none">
        {fall.map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                left: 16 + index * 36,
                backgroundColor: DOTS[index],
                transform: [
                  {
                    translateY: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 180],
                    }),
                  },
                ],
                opacity: value.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.kicker}>Selamat</Text>
      {celebration?.streakIncreased ? (
        <Text style={styles.title}>🔥 Streak {celebration.currentStreak} hari</Text>
      ) : null}
      {celebration?.newBadges.map((badge) => (
        <Text key={badge.id} style={styles.badge}>
          {badge.icon} {badge.title}
        </Text>
      ))}
      <Text style={styles.body}>
        {celebration?.newBadges[0]?.description ?? 'Belajar hari ini tercatat. Pertahankan streak-mu.'}
      </Text>
      <Button label="Lanjut belajar" onPress={onClose} />
    </BottomSheet>
  );
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes <= 0) return `${rest} detik`;
  return `${minutes} menit ${rest} detik`;
}

export function LevelCelebration({
  result,
  timeSpent,
  extraBadges,
  onNext,
  onHome,
}: {
  result: LevelResult | null;
  timeSpent: number;
  extraBadges: LevelBadge[];
  onNext: () => void;
  onHome: () => void;
}) {
  const fall = useRef(DOTS.map(() => new Animated.Value(0))).current;
  const visible = Boolean(result?.passed);
  const badges = [result?.unlockedBadge, ...extraBadges].filter((badge): badge is LevelBadge => Boolean(badge));
  const unique = badges.filter((badge, index) => badges.findIndex((item) => item.id === badge.id) === index);

  useEffect(() => {
    if (!visible) return;
    playCelebration();
    fall.forEach((value) => value.setValue(0));
    Animated.stagger(
      70,
      fall.map((value) => Animated.timing(value, { toValue: 1, duration: 1100, useNativeDriver: true })),
    ).start();
  }, [visible, fall, result]);

  return (
    <BottomSheet visible={visible} onClose={onHome} dismissOnBackdrop={false}>
      <View style={styles.confetti} pointerEvents="none">
        {fall.map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                left: 16 + index * 36,
                backgroundColor: DOTS[index],
                transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [-20, 180] }) }],
                opacity: value.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.kicker}>Modul lulus</Text>
      <Text style={styles.title}>Skor {result?.score ?? 0}</Text>
      <Text style={styles.body}>Waktu pengerjaan {formatDuration(timeSpent)}. XP bertambah {result?.xpEarned ?? 0}.</Text>
      {unique.map((badge) => (
        <Text key={badge.id} style={styles.badge}>{badge.icon} {badge.title}</Text>
      ))}
      {result?.nextLessonId ? <Button label="Lanjut ke pelajaran berikutnya" onPress={onNext} /> : null}
      <Button label="Kembali ke peta belajar" tone="ghost" onPress={onHome} />
    </BottomSheet>
  );
}

export function EncourageSheet({ visible, onRetry }: { visible: boolean; onRetry: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onRetry} dismissOnBackdrop={false}>
      <Text style={styles.title}>Yuk ulang kuis sekali lagi!</Text>
      <Text style={styles.body}>Kamu butuh skor minimal 80 untuk lanjut ke modul berikutnya.</Text>
      <Button label="Ulangi kuis" onPress={onRetry} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  confetti: { height: 8 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  kicker: { ...latinFont, color: colors.accent, fontWeight: '800' },
  title: { ...latinFont, fontSize: 26, fontWeight: '800', color: colors.primary },
  badge: { ...latinFont, fontSize: 18, fontWeight: '800' },
  body: { ...latinFont, color: colors.muted, lineHeight: 22 },
});
