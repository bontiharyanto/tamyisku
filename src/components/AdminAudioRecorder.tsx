import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { encodeRecordingMp3 } from '@/lib/quranAudio';
import { colors } from '@/lib/theme';
import { Button } from '@/components/ui';

type RecorderState = 'idle' | 'recording' | 'ready';

export function AdminAudioRecorder({
  onUse,
  busy,
}: {
  onUse: (blob: Blob, extension: 'mp3' | 'm4a') => Promise<void>;
  busy: boolean;
}) {
  const [state, setState] = useState<RecorderState>('idle');
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 24 }, () => 4));
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (Platform.OS !== 'web') {
    return <Text style={styles.note}>Perekam langsung tersedia di browser admin.</Text>;
  }

  function stopMeter() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  async function start() {
    setError(null);
    const media = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.current = media;
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((item) => MediaRecorder.isTypeSupported(item));
    const mediaRecorder = new MediaRecorder(media, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 });
    chunks.current = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setState('ready');
    };
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    audioContext.createMediaStreamSource(media).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    timer.current = setInterval(() => {
      analyser.getByteFrequencyData(data);
      setLevels(Array.from(data).slice(0, 24).map((value) => 4 + value / 7));
    }, 80);
    recorder.current = mediaRecorder;
    mediaRecorder.start();
    setState('recording');
    mediaRecorder.addEventListener('stop', () => void audioContext.close(), { once: true });
  }

  function stop() {
    stopMeter();
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }

  function play() {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    void audio.play();
  }

  async function useRecording() {
    if (!previewUrl) return;
    setError(null);
    try {
      const original = await fetch(previewUrl).then((response) => response.blob());
      const encoded = await encodeRecordingMp3(original);
      await onUse(encoded.blob, encoded.extension);
      setState('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memakai rekaman');
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Rekam pelafalan</Text>
      <View style={styles.wave}>
        {levels.map((height, index) => (
          <View key={index} style={[styles.bar, { height }]} />
        ))}
      </View>
      <View style={styles.row}>
        <Button label="Mulai Rekam" tone="ghost" disabled={state === 'recording' || busy} onPress={() => void start().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Mikrofon ditolak'))} />
        <Button label="Hentikan" tone="danger" disabled={state !== 'recording'} onPress={stop} />
        <Button label="Putar Ulang (Preview)" tone="ghost" disabled={!previewUrl || state === 'recording'} onPress={play} />
      </View>
      <Button label="Gunakan Rekaman Ini" disabled={state !== 'ready' || busy} loading={busy} onPress={() => void useRecording()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14 },
  title: { fontWeight: '800', color: colors.text },
  wave: { height: 48, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 6, borderRadius: 99, backgroundColor: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { color: colors.muted },
  error: { color: colors.danger },
});
