import { createElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { uploadLessonAudio } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAppearance } from '@/lib/appearance';
import { arabicFont, categoryVisual, colors, latinFont } from '@/lib/theme';
import { useAdminContent, emptyQuiz, emptyWord } from '@/hooks/useAdminContent';
import { DataGrid } from '@/components/DataGrid';
import { Button, Card, Field, Screen, SkeletonList, notify } from '@/components/ui';

export default function AdminContent() {
  const { dataVersion } = useAuth();
  const { dark } = useAppearance();
  const catalog = useAdminContent(dataVersion);
  const preview = categoryVisual(catalog.word.tamyizCategory, catalog.word.colorCode, dark);

  return (
    <Screen
      fab={
        catalog.tab === 'words'
          ? { label: 'Tambah kata', onPress: () => catalog.setWord(emptyWord(catalog.word.lessonId)) }
          : catalog.tab === 'quizzes'
            ? { label: 'Tambah kuis', onPress: () => catalog.setQuiz(emptyQuiz(catalog.quiz.lessonId)) }
            : undefined
      }
    >
      <View style={styles.tabs}>
        {(['lessons', 'words', 'quizzes'] as const).map((item) => (
          <Pressable key={item} onPress={() => catalog.setTab(item)} style={[styles.tab, catalog.tab === item && styles.tabOn]}>
            <Text style={[styles.tabText, catalog.tab === item && styles.tabTextOn]}>{item === 'lessons' ? 'Modul' : item === 'words' ? 'Kata' : 'Kuis'}</Text>
          </Pressable>
        ))}
      </View>

      {catalog.tab === 'lessons' ? (
        <>
          <Card>
            <Field label="Judul" value={catalog.lesson.title} onChangeText={(title) => catalog.setLesson({ ...catalog.lesson, title })} />
            <Field label="Level" keyboardType="number-pad" value={String(catalog.lesson.level)} onChangeText={(value) => catalog.setLesson({ ...catalog.lesson, level: Number(value) || 1 })} />
            <Field label="Kategori" value={catalog.lesson.category ?? ''} onChangeText={(category) => catalog.setLesson({ ...catalog.lesson, category })} />
            <Field label="Deskripsi" value={catalog.lesson.description ?? ''} onChangeText={(description) => catalog.setLesson({ ...catalog.lesson, description })} />
            <Field label="Urutan" keyboardType="number-pad" value={String(catalog.lesson.orderIndex)} onChangeText={(value) => catalog.setLesson({ ...catalog.lesson, orderIndex: Number(value) || 1 })} />
            <Button label={catalog.lesson.id ? 'Simpan modul' : 'Tambah modul'} onPress={() => void catalog.saveLesson()} />
          </Card>
          {catalog.loading ? <SkeletonList count={2} /> : null}
          {catalog.lessons.map((item) => (
            <Card key={item.id}>
              <Text style={styles.title}>{item.orderIndex}. {item.title}</Text>
              <Button label="Edit" tone="ghost" onPress={() => catalog.setLesson(item)} />
              <Button label="Hapus" tone="danger" onPress={() => void catalog.removeLesson(item.id)} />
            </Card>
          ))}
        </>
      ) : null}

      {catalog.tab === 'words' ? (
        <>
          <Card>
            <Field label="ID modul" value={catalog.word.lessonId} onChangeText={(lessonId) => catalog.setWord({ ...catalog.word, lessonId })} />
            <Field label="Arab" value={catalog.word.arabicText} onChangeText={(arabicText) => catalog.setWord({ ...catalog.word, arabicText })} style={arabicFont} />
            <Field label="Arti" value={catalog.word.translation} onChangeText={(translation) => catalog.setWord({ ...catalog.word, translation })} />
            <Field label="Kategori (Isim, Fi'il, Huruf, Tamyiz 1-4)" value={catalog.word.tamyizCategory} onChangeText={(tamyizCategory) => catalog.setWord({ ...catalog.word, tamyizCategory })} />
            <Field label="Kode warna" value={catalog.word.colorCode ?? ''} onChangeText={(colorCode) => catalog.setWord({ ...catalog.word, colorCode })} />
            <Field label="Surah" keyboardType="number-pad" value={String(catalog.word.surahNumber)} onChangeText={(value) => catalog.setWord({ ...catalog.word, surahNumber: Number(value) || 1 })} />
            <Field label="Ayat" keyboardType="number-pad" value={String(catalog.word.ayahNumber)} onChangeText={(value) => catalog.setWord({ ...catalog.word, ayahNumber: Number(value) || 1 })} />
            <Field label="Posisi kata" keyboardType="number-pad" value={String(catalog.word.wordPosition)} onChangeText={(value) => catalog.setWord({ ...catalog.word, wordPosition: Number(value) || 1 })} />
            <Field label="Path audio di bucket (kosongkan jika belum ada)" value={catalog.word.audioUrl ?? ''} onChangeText={(audioUrl) => catalog.setWord({ ...catalog.word, audioUrl })} />
            {Platform.OS === 'web'
              ? createElement('input', {
                  type: 'file',
                  accept: 'audio/*',
                  onChange: (event: { target: { files?: { item: (index: number) => Blob & { name: string } | null } | null } }) => {
                    const file = event.target.files?.item(0);
                    if (!file) return;
                    catalog.setUploading(true);
                    void uploadLessonAudio(file, file.name)
                      .then((path) => {
                        catalog.setWord((current) => ({ ...current, audioUrl: path }));
                        notify('Audio terunggah');
                      })
                      .catch((cause: unknown) => notify(cause instanceof Error ? cause.message : 'Gagal mengunggah', 'err'))
                      .finally(() => catalog.setUploading(false));
                  },
                })
              : <Text style={styles.title}>Unggah audio dari browser admin.</Text>}
            <View style={[styles.preview, { backgroundColor: preview.backgroundColor, borderColor: preview.borderColor }]}>
              <Text style={[arabicFont, styles.arabic]}>{catalog.word.arabicText || 'بِسْمِ'}</Text>
              <Text style={styles.title}>{catalog.word.translation || 'Arti kata'}</Text>
              <Text style={styles.title}>{preview.label}</Text>
            </View>
            <Button label={catalog.uploading ? 'Mengunggah audio...' : catalog.word.id ? 'Simpan kata' : 'Tambah kata'} loading={catalog.uploading} onPress={() => void catalog.saveWord()} />
          </Card>
          <Field label="Cari kata" value={catalog.query} onChangeText={catalog.setQuery} />
          <View style={styles.tabs}>
            {catalog.filters.map((item) => (
              <Pressable key={item} onPress={() => catalog.setFilter(item)} style={[styles.tab, catalog.filter === item && styles.tabOn]}>
                <Text style={[styles.tabText, catalog.filter === item && styles.tabTextOn]}>{item}</Text>
              </Pressable>
            ))}
          </View>
          {catalog.loading ? <SkeletonList /> : (
            <DataGrid
              rows={catalog.visibleWords}
              columns={[
                { key: 'arabic', label: 'Arab', minWidth: 160, render: (item) => <Text style={[arabicFont, styles.arabic]}>{item.arabicText}</Text> },
                { key: 'translation', label: 'Arti', minWidth: 180, render: (item) => <Text style={styles.title}>{item.translation}</Text> },
                { key: 'category', label: 'Kategori', minWidth: 120, render: (item) => <Text style={styles.title}>{item.tamyizCategory}</Text> },
                {
                  key: 'action',
                  label: 'Aksi',
                  minWidth: 200,
                  render: (item) => (
                    <View style={styles.actions}>
                      <Button label="Edit" tone="ghost" onPress={() => catalog.setWord(item)} />
                      <Button label="Hapus" tone="danger" onPress={() => void catalog.removeWord(item.id)} />
                    </View>
                  ),
                },
              ]}
            />
          )}
          <View style={styles.tabs}>
            <Button label="Sebelumnya" tone="ghost" onPress={() => catalog.setPage((value) => Math.max(0, value - 1))} />
            <Text style={styles.title}>{catalog.page + 1} / {catalog.pages}</Text>
            <Button label="Berikutnya" tone="ghost" onPress={() => catalog.setPage((value) => Math.min(catalog.pages - 1, value + 1))} />
          </View>
        </>
      ) : null}

      {catalog.tab === 'quizzes' ? (
        <>
          <Card>
            <Field label="ID modul" value={catalog.quiz.lessonId} onChangeText={(lessonId) => catalog.setQuiz({ ...catalog.quiz, lessonId })} />
            <Field label="Teks Arab" value={catalog.quiz.arabicText} onChangeText={(arabicText) => catalog.setQuiz({ ...catalog.quiz, arabicText })} />
            <Field label="Arti" value={catalog.quiz.translation} onChangeText={(translation) => catalog.setQuiz({ ...catalog.quiz, translation })} />
            <Field label="Jawaban benar" value={catalog.quiz.correctAnswer} onChangeText={(correctAnswer) => catalog.setQuiz({ ...catalog.quiz, correctAnswer })} />
            <Field label="Penjelasan" value={catalog.quiz.explanation} onChangeText={(explanation) => catalog.setQuiz({ ...catalog.quiz, explanation })} />
            <Field label="Poin" keyboardType="number-pad" value={String(catalog.quiz.scorePoints)} onChangeText={(value) => catalog.setQuiz({ ...catalog.quiz, scorePoints: Number(value) || 10 })} />
            <Button label={catalog.quiz.id ? 'Simpan kuis' : 'Tambah kuis'} onPress={() => void catalog.saveQuiz()} />
          </Card>
          {catalog.loading ? <SkeletonList count={2} /> : (
            <DataGrid
              rows={catalog.quizzes}
              columns={[
                { key: 'arabic', label: 'Arab', minWidth: 160, render: (item) => <Text style={[arabicFont, styles.arabic]}>{item.arabicText}</Text> },
                { key: 'answer', label: 'Jawaban', minWidth: 140, render: (item) => <Text style={styles.title}>{item.correctAnswer}</Text> },
                {
                  key: 'action',
                  label: 'Aksi',
                  minWidth: 200,
                  render: (item) => (
                    <View style={styles.actions}>
                      <Button label="Edit" tone="ghost" onPress={() => catalog.setQuiz(item)} />
                      <Button label="Hapus" tone="danger" onPress={() => void catalog.removeQuiz(item.id)} />
                    </View>
                  ),
                },
              ]}
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.text, fontWeight: '700' },
  tabTextOn: { color: colors.white },
  title: { ...latinFont, fontWeight: '800' },
  arabic: { textAlign: 'right', fontSize: 28, lineHeight: 44 },
  preview: { borderWidth: 2, borderRadius: 16, padding: 16, gap: 4 },
  actions: { gap: 8 },
});
