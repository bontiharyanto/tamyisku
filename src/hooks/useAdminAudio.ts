import { useCallback, useEffect, useState } from 'react';
import { fetchAdminContent, signStoredAudio, upsertWord } from '@/lib/api';
import { playUrl } from '@/lib/audio';
import { emptyWord } from '@/hooks/useAdminContent';
import {
  audioPrefixForLesson,
  fillMissingAudio,
  generateQuranAudio,
  readWordSheet,
  saveImportedWords,
  uploadQuranAudio,
} from '@/lib/quranAudio';
import type { Lesson, QuranWord } from '@/lib/types';
import { notify } from '@/components/ui';

export function useAdminAudio() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [words, setWords] = useState<QuranWord[]>([]);
  const [word, setWord] = useState<QuranWord>(emptyWord(''));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const content = await fetchAdminContent();
      setLessons(content.lessons);
      setWords(content.words);
      setWord((current) => (current.lessonId ? current : emptyWord(content.lessons[0]?.id ?? '')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load().catch((cause: unknown) => notify(cause instanceof Error ? cause.message : 'Gagal memuat', 'err'));
  }, [load]);

  const lesson = lessons.find((item) => item.id === word.lessonId) ?? lessons[0];
  const prefix = audioPrefixForLesson(lesson?.orderIndex ?? 1);

  async function generate() {
    setBusy(true);
    try {
      const audioUrl = await generateQuranAudio(word.arabicText, prefix);
      setWord((current) => ({ ...current, audioUrl }));
      notify('Audio AI tersimpan di formulir');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal membuat audio', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function useRecording(blob: Blob, extension: 'mp3' | 'm4a') {
    setBusy(true);
    try {
      const audioUrl = await uploadQuranAudio(blob, prefix, extension);
      setWord((current) => ({ ...current, audioUrl }));
      notify('Rekaman tersimpan di formulir');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menyimpan rekaman', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await upsertWord({ ...word, audioUrl: word.audioUrl || null });
      setWord(emptyWord(word.lessonId));
      await load();
      notify('Kata disimpan');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menyimpan', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function previewAudio() {
    if (!word.audioUrl) return;
    const url = await signStoredAudio(word.audioUrl);
    if (!url) {
      notify('Audio belum bisa diputar', 'err');
      return;
    }
    playUrl(url);
  }

  async function importFile(file: Blob) {
    setBusy(true);
    try {
      const parsed = await readWordSheet(file);
      parsed.problems.slice(0, 3).forEach((problem) => notify(problem, 'err'));
      if (!word.lessonId) throw new Error('Pilih modul terlebih dahulu');
      const count = await saveImportedWords({
        lessonId: word.lessonId,
        words: parsed.words,
        prefix,
        onProgress: setProgress,
      });
      await load();
      notify(`${parsed.words.length} kata tersimpan, ${count} audio dibuat`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal mengimpor', 'err');
    } finally {
      setProgress('');
      setBusy(false);
    }
  }

  async function generateMissing() {
    setBusy(true);
    try {
      const count = await fillMissingAudio(
        words.filter((item) => item.lessonId === word.lessonId),
        prefix,
        setProgress,
      );
      await load();
      notify(count ? `${count} audio dibuat` : 'Semua kata pada modul ini sudah punya audio');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Antrean audio berhenti', 'err');
    } finally {
      setProgress('');
      setBusy(false);
    }
  }

  function selectLesson(lessonId: string) {
    setWord(emptyWord(lessonId));
  }

  return {
    lessons,
    word,
    setWord,
    selectLesson,
    busy,
    loading,
    progress,
    generate,
    useRecording,
    save,
    previewAudio,
    importFile,
    generateMissing,
  };
}
