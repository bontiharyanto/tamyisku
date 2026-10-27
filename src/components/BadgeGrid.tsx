import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EarnedBadge } from '@/lib/types';
import { colors } from '@/lib/theme';
import { Button } from '@/components/ui';

export function BadgeGrid({ badges }: { badges: EarnedBadge[] }) {
  const [selected, setSelected] = useState<EarnedBadge | null>(null);

  return (
    <>
      <View style={styles.grid}>
        {badges.map((badge) => {
          const open = !!badge.unlockedAt;
          return (
            <Pressable key={badge.id} accessibilityRole="button" onPress={() => setSelected(badge)} style={styles.cell}>
              <Text style={[styles.icon, !open && styles.locked]}>{badge.icon}</Text>
              <Text style={[styles.title, !open && styles.lockedText]} numberOfLines={2}>
                {badge.title}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {open ? new Date(badge.unlockedAt!).toLocaleDateString('id-ID') : badge.requirement}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogIcon}>{selected?.icon}</Text>
            <Text style={styles.dialogTitle}>{selected?.title}</Text>
            <Text style={styles.dialogBody}>{selected?.description}</Text>
            <Text style={styles.dialogMeta}>
              {selected?.unlockedAt
                ? `Terbuka ${new Date(selected.unlockedAt).toLocaleString('id-ID')}`
                : `Syarat: ${selected?.requirement}`}
            </Text>
            <Button label="Tutup" tone="ghost" onPress={() => setSelected(null)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '23%',
    minWidth: 76,
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    gap: 4,
  },
  icon: { fontSize: 28 },
  locked: Platform.OS === 'web' ? ({ filter: 'grayscale(1)', opacity: 0.55 } as object) : { opacity: 0.35 },
  lockedText: { color: colors.muted },
  title: { fontWeight: '800', color: colors.text, fontSize: 12 },
  meta: { color: colors.muted, fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,25,21,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 20, padding: 20, gap: 8 },
  dialogIcon: { fontSize: 40 },
  dialogTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  dialogBody: { color: colors.text, lineHeight: 22 },
  dialogMeta: { color: colors.muted },
});
