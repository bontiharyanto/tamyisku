import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { InlineWordRecorder } from '@/components/InlineWordRecorder';
import { arabicFont, colors } from '@/lib/theme';

export type PdfPreviewRow = {
  id: string;
  arabicText: string;
  translation: string;
  audioUrl: string | null;
  status: 'quran' | 'ai' | 'tutor' | 'missing';
};

const STATUS_LABEL = {
  quran: 'Audio Ditemukan',
  tutor: 'Audio Ditemukan',
  ai: 'Menggunakan AI Voice',
  missing: 'Belum Ada Audio',
} as const;

const STATUS_COLOR = {
  quran: '#2E7D32',
  tutor: '#2E7D32',
  ai: '#F9A825',
  missing: '#D32F2F',
} as const;

export function PdfPreviewTable({
  rows,
  busyId,
  onChange,
  onPlay,
  onRecorded,
}: {
  rows: PdfPreviewRow[];
  busyId: string | null;
  onChange: (id: string, patch: Partial<Pick<PdfPreviewRow, 'arabicText' | 'translation'>>) => void;
  onPlay: (row: PdfPreviewRow) => void;
  onRecorded: (id: string, blob: Blob, extension: 'mp3' | 'm4a') => Promise<void>;
}) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.headText, styles.arabicHead]}>Kata</Text>
        <Text style={[styles.headText, styles.grow]}>Arti</Text>
        <Text style={[styles.headText, styles.status]}>Audio Status</Text>
        <Text style={[styles.headText, styles.action]}>Rekam</Text>
      </View>
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <TextInput
            value={row.arabicText}
            onChangeText={(arabicText) => onChange(row.id, { arabicText })}
            style={[styles.input, arabicFont, styles.arabic]}
          />
          <TextInput
            value={row.translation}
            onChangeText={(translation) => onChange(row.id, { translation })}
            style={[styles.input, styles.grow]}
            placeholder="Arti"
            placeholderTextColor={colors.muted}
          />
          <View style={styles.status}>
            <Text style={[styles.badge, { color: STATUS_COLOR[row.status] }]}>● {STATUS_LABEL[row.status]}</Text>
            {row.audioUrl ? (
              <Pressable accessibilityRole="button" onPress={() => onPlay(row)} style={styles.play}>
                <Text style={styles.playText}>Play</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.action}>
            <InlineWordRecorder disabled={busyId !== null} onRecorded={(blob, extension) => onRecorded(row.id, blob, extension)} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  head: { paddingBottom: 4 },
  headText: { color: colors.muted, fontWeight: '800' },
  arabicHead: { width: 140, fontWeight: '800', color: colors.muted },
  grow: { flexGrow: 1, flexBasis: 140 },
  status: { width: 180, gap: 4 },
  action: { width: 110 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  arabic: { width: 140, textAlign: 'right', fontSize: 20 },
  badge: { fontWeight: '700' },
  play: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4 },
  playText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
});
