import { createElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAdminAudio } from '@/hooks/useAdminAudio';
import { useAppearance } from '@/lib/appearance';
import { arabicFont, categoryVisual, colors } from '@/lib/theme';
import { AdminAudioRecorder } from '@/components/AdminAudioRecorder';
import { Button, Card, Field, Screen, SkeletonList } from '@/components/ui';

export default function AdminLessonsAudio() {
  const studio = useAdminAudio();
  const { dark } = useAppearance();
  const preview = categoryVisual(studio.word.tamyizCategory, studio.word.colorCode, dark);

  return (
    <Screen>
      <Text style={styles.lead}>Buat pelafalan kata Tamyiz dengan suara AI, rekaman langsung, atau impor spreadsheet.</Text>
      {studio.loading ? <SkeletonList count={3} /> : null}
      <Card>
        <Text style={styles.label}>Modul</Text>
        <View style={styles.lessons}>
          {studio.lessons.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => studio.selectLesson(item.id)}
              style={[styles.lesson, studio.word.lessonId === item.id && styles.lessonOn]}
            >
              <Text style={[styles.lessonText, studio.word.lessonId === item.id && styles.lessonTextOn]}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.arabicRow}>
          <View style={styles.grow}>
            <Field label="Teks Arab" value={studio.word.arabicText} onChangeText={(arabicText) => studio.setWord({ ...studio.word, arabicText })} style={arabicFont} />
          </View>
          <Button label="Generate AI Audio" disabled={!studio.word.arabicText.trim() || studio.busy} loading={studio.busy} onPress={() => void studio.generate()} />
        </View>
        <Field label="Arti" value={studio.word.translation} onChangeText={(translation) => studio.setWord({ ...studio.word, translation })} />
        <Field label="Kategori" value={studio.word.tamyizCategory} onChangeText={(tamyizCategory) => studio.setWord({ ...studio.word, tamyizCategory })} />
        <Field label="Path audio" value={studio.word.audioUrl ?? ''} onChangeText={(audioUrl) => studio.setWord({ ...studio.word, audioUrl })} />
        <View style={[styles.preview, { backgroundColor: preview.backgroundColor, borderColor: preview.borderColor }]}>
          <Text style={[arabicFont, styles.arabic]}>{studio.word.arabicText || 'بِسْمِ'}</Text>
          <Text style={styles.title}>{studio.word.translation || 'Arti kata'}</Text>
        </View>
        <Button label="Putar audio formulir" tone="ghost" disabled={!studio.word.audioUrl} onPress={() => void studio.previewAudio()} />
        <AdminAudioRecorder busy={studio.busy} onUse={studio.useRecording} />
        <Button label={studio.word.id ? 'Simpan kata' : 'Tambah kata'} disabled={studio.busy} onPress={() => void studio.save()} />
      </Card>
      <Card>
        <Text style={styles.title}>Import Modul via Excel/CSV</Text>
        <Text style={styles.lead}>Kolom: arabic_text, translation, tamyiz_category. Opsional: surah_number, ayah_number, word_position. Kata tanpa audio masuk antrean generator.</Text>
        {studio.progress ? <Text style={styles.progress}>{studio.progress}</Text> : null}
        {Platform.OS === 'web'
          ? createElement('input', {
              type: 'file',
              accept: '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              onChange: (event: { target: { files?: { item: (index: number) => Blob | null } | null } }) => {
                const file = event.target.files?.item(0);
                if (file) void studio.importFile(file);
              },
            })
          : <Text style={styles.lead}>Impor spreadsheet dilakukan dari browser admin.</Text>}
        <Button label="Buat audio untuk kata yang belum punya file" tone="ghost" disabled={studio.busy || !studio.word.lessonId} onPress={() => void studio.generateMissing()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, lineHeight: 20 },
  label: { color: colors.muted, fontWeight: '700' },
  lessons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lesson: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8 },
  lessonOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  lessonText: { color: colors.text, fontWeight: '700' },
  lessonTextOn: { color: colors.white },
  arabicRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 220 },
  preview: { borderWidth: 2, borderRadius: 16, padding: 16, gap: 4 },
  arabic: { textAlign: 'right' },
  title: { fontWeight: '800', color: colors.text },
  progress: { color: colors.primary, fontWeight: '700' },
});
