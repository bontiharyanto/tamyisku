import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DeleteAccountModal } from '@/components/DeleteAccountModal';
import { useAppearance } from '@/lib/appearance';
import { deleteOwnAccount, fetchNotifyPrefs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearLocalAccountData } from '@/lib/localData';
import { saveStudyReminder } from '@/lib/settingsActions';
import type { NotifyPrefs } from '@/lib/types';
import { colors } from '@/lib/theme';
import { NightModeToggle } from '@/components/NightModeToggle';
import { Button, Card, Screen, notify } from '@/components/ui';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { palette, arabicScale, setArabicScale } = useAppearance();
  const scaleWidth = useRef(1);
  const scalePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => applyScale(event.nativeEvent.locationX),
      onPanResponderMove: (event) => applyScale(event.nativeEvent.locationX),
    }),
  ).current;

  function applyScale(locationX: number) {
    const ratio = Math.min(1, Math.max(0, locationX / Math.max(scaleWidth.current, 1)));
    setArabicScale(0.85 + ratio * 0.6);
  }
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifyPrefs>({ enabled: true, hour: 20, minute: 0 });
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void fetchNotifyPrefs().then(setPrefs).catch(() => undefined);
  }, []);

  async function persist(next: NotifyPrefs) {
    setPrefs(next);
    setSaving(true);
    try {
      const result = await saveStudyReminder(next);
      if (result === 'denied') {
        notify('Izin notifikasi ditolak. Aktifkan di pengaturan perangkat.', 'err');
        setPrefs({ ...next, enabled: false });
        return;
      }
      notify('Pengingat disimpan');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menyimpan', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(input: { confirmation: string; password: string }) {
    setDeleting(true);
    try {
      await deleteOwnAccount(input);
      await clearLocalAccountData();
      try {
        await signOut();
      } catch {
        // Sesi sudah tidak berlaku setelah akun dihapus.
      }
      setConfirming(false);
      notify('Akun dan data Anda telah berhasil dihapus.');
      router.replace('/(auth)/login');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menghapus akun', 'err');
    } finally {
      setDeleting(false);
    }
  }

  const clock = `${String(prefs.hour).padStart(2, '0')}:${String(prefs.minute).padStart(2, '0')} WIB`;

  return (
    <Screen>
      <Card>
        <Text style={[styles.label, { color: palette.text }]}>Tampilan</Text>
        <View style={styles.row}>
          <Text style={[styles.note, { color: palette.muted }]}>Mode malam memakai latar zamrud dalam. Kartu dan kategori Tamyiz ikut berubah.</Text>
          <NightModeToggle />
        </View>
        <Text style={styles.note}>Ukuran huruf Arab {Math.round(arabicScale * 100)}%</Text>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Ukuran huruf Arab"
          onLayout={(event) => {
            scaleWidth.current = event.nativeEvent.layout.width;
          }}
          {...scalePan.panHandlers}
          style={styles.track}
        >
          <View style={[styles.fill, { width: `${((arabicScale - 0.85) / 0.6) * 100}%` }]} />
        </View>
        <Text style={[styles.preview, { fontSize: 28 * arabicScale }]}>بِسْمِ ٱللَّهِ</Text>
      </Card>
      <Card>
        <View style={styles.row}>
          <Text style={[styles.label, { color: palette.text }]}>Pengingat Belajar Harian</Text>
          <Switch
            value={prefs.enabled}
            disabled={saving}
            onValueChange={(enabled) => void persist({ ...prefs, enabled })}
            trackColor={{ true: colors.primary, false: colors.line }}
          />
        </View>
        <Text style={styles.note}>Default pukul 20:00 WIB. Jika hari ini sudah belajar, pengingat malam ini dibatalkan dan dijadwalkan lagi besok.</Text>
        <Text style={[styles.clock, { color: palette.primary }]}>{clock}</Text>
        <View style={styles.steppers}>
          <Stepper
            label="Jam"
            onMinus={() => void persist({ ...prefs, hour: (prefs.hour + 23) % 24 })}
            onPlus={() => void persist({ ...prefs, hour: (prefs.hour + 1) % 24 })}
          />
          <Stepper
            label="Menit"
            onMinus={() => void persist({ ...prefs, minute: (prefs.minute + 55) % 60 })}
            onPlus={() => void persist({ ...prefs, minute: (prefs.minute + 5) % 60 })}
          />
        </View>
      </Card>
      <Button label="Dasbor" tone="ghost" onPress={() => router.push('/dashboard')} />
      {user?.role === 'tutor' || user?.role === 'admin' ? <Button label="Kelola materi" tone="ghost" onPress={() => router.push('/tutor/lessons')} /> : null}
      {user?.role === 'admin' ? <Button label="Dashboard admin" tone="ghost" onPress={() => router.push('/admin')} /> : null}
      <Button label="Pusat Bantuan" tone="ghost" onPress={() => router.push('/help')} />
      <Button label="Kebijakan privasi & ketentuan" tone="ghost" onPress={() => router.push('/privacy')} />
      <Button label="Hapus Akun Saya" tone="danger" onPress={() => setConfirming(true)} />
      <DeleteAccountModal
        visible={confirming}
        busy={deleting}
        onClose={() => setConfirming(false)}
        onConfirm={(input) => void removeAccount(input)}
      />
    </Screen>
  );
}

function Stepper({ label, onMinus, onPlus }: { label: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <Pressable accessibilityRole="button" onPress={onMinus} style={styles.stepButton}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onPlus} style={styles.stepButton}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontWeight: '800', color: colors.text, fontSize: 16 },
  note: { color: colors.muted, lineHeight: 20 },
  clock: { fontSize: 32, fontWeight: '800', color: colors.primary },
  steppers: { flexDirection: 'row', gap: 12 },
  stepper: { flex: 1, gap: 6 },
  stepLabel: { color: colors.muted, fontWeight: '700' },
  stepRow: { flexDirection: 'row', gap: 8 },
  stepButton: { flex: 1, backgroundColor: colors.background, borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  stepText: { fontSize: 20, fontWeight: '800', color: colors.primary },
  track: { height: 28, borderRadius: 99, backgroundColor: '#EFE8D8', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 99, backgroundColor: colors.gold },
  preview: { textAlign: 'center', color: colors.primary, fontFamily: 'Scheherazade New' },
});
