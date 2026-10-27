import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchGamification, fetchProgress } from '@/lib/api';
import { useColors } from '@/lib/appearance';
import { selectionHaptic } from '@/lib/haptics';
import { useAuth } from '@/lib/auth';
import { jakartaDate, shiftIsoDate } from '@/lib/dates';
import { LEVEL_PASS_SCORE } from '@/lib/leveling';
import { levelFromXp } from '@/lib/dashboardData';
import { fetchUserXp } from '@/lib/juzQuiz';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { surahName } from '@/lib/surahs';
import { subscriptionState, type EarnedBadge, type ProgressRow, type Streak } from '@/lib/types';
import { latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { NightModeToggle } from '@/components/NightModeToggle';
import { BadgeGrid } from '@/components/BadgeGrid';
import { WeekChart, XpGauge } from '@/components/profile/meters';
import { Badge, EmptyState, Field, SkeletonList, notify } from '@/components/ui';

type HistoryItem = { id: string; title: string; passed: boolean; at: string };

export default function ProfileScreen() {
  const { user, subscription, signOut, saveName, dataVersion } = useAuth();
  const { expanded, phone } = useViewport();
  const palette = useColors();
  const surface = { backgroundColor: palette.card, borderColor: palette.line };
  const ink = { color: palette.text };
  const mute = { color: palette.muted };
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [week, setWeek] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [streak, setStreak] = useState<Streak>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.fullName ?? '');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [progress, game, points, surahDates] = await Promise.all([
        fetchProgress(),
        fetchGamification(),
        fetchUserXp().catch(() => 0),
        loadSurahHistory(),
      ]);
      setRows(progress);
      setStreak(game.streak);
      setBadges(game.badges);
      setXp(points);
      const lessonHistory = progress.map((row) => ({
        id: row.id,
        title: row.lessonTitle,
        passed: row.score >= LEVEL_PASS_SCORE,
        at: row.updatedAt,
      }));
      const merged = [...lessonHistory, ...surahDates].sort((left, right) => right.at.localeCompare(left.at));
      setHistory(merged.slice(0, 6));
      setWeek(bucketWeek([...progress.map((row) => row.updatedAt), ...surahDates.map((row) => row.at)]));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, dataVersion]),
  );

  const state = subscriptionState(subscription);
  const initial = (user?.fullName || user?.email || '?').slice(0, 1).toUpperCase();
  const level = levelFromXp(xp);
  const unlocked = badges.filter((badge) => badge.unlockedAt);
  const planLabel = state === 'active' ? 'Member Premium' : state === 'expired' ? 'Langganan berakhir' : 'Akun Gratis';

  async function save() {
    setSaving(true);
    try {
      await saveName(name);
      setEditing(false);
      notify('Profil diperbarui');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menyimpan', 'err');
    } finally {
      setSaving(false);
    }
  }

  const achievement = (
    <View style={styles.panel}>
      {phone ? null : <Text style={styles.section}>Pencapaian saya</Text>}
      <View style={[styles.card, surface]}>
        <Text style={styles.flame}>🔥</Text>
        <Text style={[styles.streakValue, { color: palette.primary }]}>{streak.currentStreak} hari</Text>
        <Text style={[styles.muted, mute]}>Rekor {streak.longestStreak} hari</Text>
      </View>
      <View style={[styles.card, surface]}>
        <XpGauge level={level.level} into={level.intoBand} band={level.band} />
        <Text style={styles.muted}>{level.levelTitle}</Text>
      </View>
      <Text style={[styles.section, ink]}>Lencana yang diperoleh</Text>
      {unlocked.length === 0 ? <EmptyState title="Belum ada lencana" body="Lencana terbuka setelah modul atau surah lulus." /> : <BadgeGrid badges={unlocked} />}
    </View>
  );

  const body = (
    <View style={styles.main}>
      <View style={[styles.card, surface]}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={[styles.name, ink]}>{user?.fullName || 'Santri'}</Text>
            <Text style={[styles.muted, mute]}>{user?.email}</Text>
            <Badge label={planLabel} tone="green" />
          </View>
          <NightModeToggle />
        </View>
        {editing ? (
          <>
            <Field label="Nama lengkap" value={name} onChangeText={setName} />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => void save()} style={styles.primary}>
                <Text style={styles.primaryText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setEditing(false)} style={styles.quiet}>
                <Text style={styles.quietText}>Batal</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={[styles.actions, phone ? styles.actionsStack : null]}>
            <Pressable
              accessibilityRole="button"
              onPressIn={selectionHaptic}
              onPress={() => { setName(user?.fullName ?? ''); setEditing(true); }}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Edit Profil</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPressIn={selectionHaptic} onPress={() => void signOut()} style={({ pressed }) => [styles.danger, pressed && styles.pressed]}>
              <Text style={styles.dangerText}>Keluar</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={[styles.section, ink]}>Ringkasan aktivitas</Text>
      {loading ? <SkeletonList count={2} /> : null}
      <View style={[styles.grid, phone ? styles.gridStack : null]}>
        <View style={[styles.card, styles.gridCard, surface]}>
          <Text style={[styles.cardTitle, ink]}>Streak belajar</Text>
          <Text style={[styles.muted, mute]}>Kuis yang tersimpan minggu ini, Minggu–Sabtu.</Text>
          <WeekChart counts={week} />
        </View>
        <View style={[styles.card, styles.gridCard, surface]}>
          <Text style={[styles.cardTitle, ink]}>Kuis history</Text>
          {history.length === 0 ? <Text style={styles.muted}>Belum ada kuis.</Text> : null}
          {history.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <View style={styles.grow}>
                <Text style={[styles.historyTitle, ink]}>{item.title}</Text>
                <Text style={[styles.muted, mute]}>{new Date(item.at).toLocaleString('id-ID')}</Text>
              </View>
              <Badge label={item.passed ? 'Lulus' : 'Belum 80'} tone={item.passed ? 'green' : 'gold'} />
            </View>
          ))}
        </View>
      </View>
      {!loading && rows.length === 0 && history.length === 0 ? (
        <EmptyState title="Belum ada aktivitas" body="Selesaikan satu kuis untuk mengisi ringkasan ini." />
      ) : null}
    </View>
  );

  if (phone) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {body}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: awardsOpen }}
          onPressIn={selectionHaptic}
          onPress={() => setAwardsOpen((value) => !value)}
          style={({ pressed }) => [styles.card, styles.awardToggle, surface, pressed && styles.pressed]}
        >
          <Text style={[styles.section, ink]}>Pencapaian saya</Text>
          <Text style={[styles.muted, mute]}>{awardsOpen ? 'Tutup' : `${streak.currentStreak} hari · Level ${level.level}`}</Text>
        </Pressable>
        {awardsOpen ? achievement : null}
      </ScrollView>
    );
  }

  if (expanded) {
    return (
      <View style={styles.split}>
        <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView>
        <ScrollView style={styles.sideScroll} contentContainerStyle={styles.scroll}>{achievement}</ScrollView>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {body}
      {achievement}
    </ScrollView>
  );
}

async function loadSurahHistory(): Promise<HistoryItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('user_surah_progress')
    .select('id, surah_number, score, completed_at')
    .order('completed_at', { ascending: false })
    .limit(12);
  if (error) return [];
  return (data ?? []).map((row) => {
    const record = row as { id: string; surah_number: number; score: number; completed_at: string };
    return {
      id: record.id,
      title: `QS ${surahName(record.surah_number)}`,
      passed: record.score >= LEVEL_PASS_SCORE,
      at: record.completed_at,
    };
  });
}

function bucketWeek(stamps: string[]) {
  const today = jakartaDate();
  const weekday = new Date(`${today}T12:00:00+07:00`).getUTCDay();
  const start = shiftIsoDate(today, -weekday);
  const end = shiftIsoDate(start, 6);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const stamp of stamps) {
    const day = jakartaDate(new Date(stamp));
    if (day < start || day > end) continue;
    const index = new Date(`${day}T12:00:00+07:00`).getUTCDay();
    counts[index] += 1;
  }
  return counts;
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  scroll: { padding: 16, gap: 12 },
  sideScroll: { width: 320, borderLeftWidth: 1, borderLeftColor: '#E6E0D6' },
  main: { gap: 12 },
  panel: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E6E0D6', padding: 16, gap: 10 },
  identity: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  identityCopy: { flex: 1, gap: 4 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#0F5132', borderWidth: 3, borderColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FDFBF7', fontSize: 32, fontWeight: '800' },
  name: { ...latinFont, fontSize: 22, fontWeight: '800', color: '#1C1915' },
  muted: { ...latinFont, color: '#5C564C' },
  actions: { flexDirection: 'row', gap: 10 },
  actionsStack: { flexDirection: 'column' },
  primary: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...latinFont, color: '#FFFFFF', fontWeight: '800' },
  danger: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#B71C1C', alignItems: 'center', justifyContent: 'center' },
  dangerText: { ...latinFont, color: '#FFFFFF', fontWeight: '800' },
  pressed: { transform: [{ scale: 0.97 }] },
  awardToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quiet: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E6E0D6', alignItems: 'center', justifyContent: 'center' },
  quietText: { ...latinFont, color: '#1C1915', fontWeight: '800' },
  section: { ...latinFont, fontSize: 18, fontWeight: '800', color: '#1C1915' },
  grid: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  gridStack: { flexDirection: 'column' },
  gridCard: { flex: 1 },
  cardTitle: { ...latinFont, fontWeight: '800', color: '#1C1915', fontSize: 16 },
  historyRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  historyTitle: { ...latinFont, fontWeight: '800', color: '#1C1915' },
  grow: { flex: 1 },
  flame: { fontSize: 42, textAlign: 'center' },
  streakValue: { ...latinFont, fontSize: 28, fontWeight: '800', color: '#0F5132', textAlign: 'center' },
});
