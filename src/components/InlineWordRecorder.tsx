import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { encodeRecordingMp3 } from '@/lib/quranAudio';
import { colors } from '@/lib/theme';

export function InlineWordRecorder({
  disabled,
  onRecorded,
}: {
  disabled: boolean;
  onRecorded: (blob: Blob, extension: 'mp3' | 'm4a') => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      recorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (Platform.OS !== 'web') return <Text style={styles.note}>Browser</Text>;

  async function start() {
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
      void encodeRecordingMp3(blob)
        .then((encoded) => onRecorded(encoded.blob, encoded.extension))
        .catch(() => undefined);
      setRecording(false);
    };
    recorder.current = mediaRecorder;
    mediaRecorder.start();
    setRecording(true);
  }

  function stop() {
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Rekam Cepat"
      disabled={disabled}
      onPress={() => void (recording ? stop() : start())}
      style={[styles.mic, recording && styles.micOn, disabled && styles.disabled]}
    >
      <Text style={styles.micText}>{recording ? 'Stop' : 'Rekam Cepat'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: { borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6 },
  micOn: { backgroundColor: colors.danger },
  disabled: { opacity: 0.45 },
  micText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  note: { color: colors.muted, fontSize: 12 },
});
