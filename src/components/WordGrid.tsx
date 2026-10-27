import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  getAudioPlayerState,
  playAudioTrack,
  startAudioPlaylist,
  stopAudioPlayback,
  subscribeAudioPlayer,
  type AudioPlayerState,
} from '@/lib/audio';
import { useAppearance } from '@/lib/appearance';
import { selectionHaptic } from '@/lib/haptics';
import type { QuranWord } from '@/lib/types';
import { useViewport } from '@/lib/viewport';
import { arabicFont, categoryVisual, colors, latinFont, noSelect } from '@/lib/theme';
import { Button } from '@/components/ui';

type CardStatus = 'idle' | 'playing' | 'completed';

function readingOrder(words: QuranWord[]) {
  return [...words].sort(
    (left, right) =>
      left.surahNumber - right.surahNumber || left.ayahNumber - right.ayahNumber || left.wordPosition - right.wordPosition,
  );
}

function cardStatus(wordId: string, playingId: string | null, completedIds: Set<string>): CardStatus {
  if (playingId === wordId) return 'playing';
  if (completedIds.has(wordId)) return 'completed';
  return 'idle';
}

function Equalizer() {
  const first = useRef(new Animated.Value(0.35)).current;
  const second = useRef(new Animated.Value(0.7)).current;
  const third = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loops = [first, second, third].map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 1, duration: 260 + index * 70, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.3, duration: 260, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [first, second, third]);
  return (
    <View style={styles.equalizer}>
      {[first, second, third].map((bar, index) => (
        <Animated.View key={index} style={[styles.bar, { transform: [{ scaleY: bar }] }]} />
      ))}
    </View>
  );
}

function PulseCard({ active, children, style }: { active: boolean; children: ReactNode; style?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.035, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);
  return <Animated.View style={[style, active ? { transform: [{ scale }] } : null]}>{children}</Animated.View>;
}

export function PlaylistButton({ words }: { words: QuranWord[] }) {
  const [player, setPlayer] = useState<AudioPlayerState>(getAudioPlayerState());
  const playable = readingOrder(words).filter((word): word is QuranWord & { audioUrl: string } => Boolean(word.audioUrl));
  useEffect(() => subscribeAudioPlayer(setPlayer), []);

  function playAll() {
    if (player.mode === 'playlist') {
      stopAudioPlayback();
      return;
    }
    startAudioPlaylist(playable.map((word) => ({ id: word.id, url: word.audioUrl })));
  }

  return (
    <Button
      label={playable.length ? (player.mode === 'playlist' ? 'Hentikan Audio' : 'Putar Semua Audio Ayat') : 'Audio belum diunggah'}
      tone={player.mode === 'playlist' ? 'danger' : 'ghost'}
      disabled={!playable.length}
      onPress={playAll}
    />
  );
}

export function WordGrid({ words, ayahKey, showPlaylist = true }: { words: QuranWord[]; ayahKey?: string | null; showPlaylist?: boolean }) {
  const { columns, expanded } = useViewport();
  const { arabicScale, dark } = useAppearance();
  const [player, setPlayer] = useState<AudioPlayerState>(getAudioPlayerState());
  const ordered = readingOrder(words).filter((word) => !ayahKey || `${word.surahNumber}:${word.ayahNumber}` === ayahKey);
  const playable = ordered.filter((word): word is QuranWord & { audioUrl: string } => Boolean(word.audioUrl));
  const groups = new Map<string, QuranWord[]>();
  ordered.forEach((word) => {
    const key = `${word.surahNumber}:${word.ayahNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), word]);
  });
  const basis = columns === 1 ? '100%' : columns === 2 ? '48%' : '31%';
  const completedIds = new Set(player.completedIds);

  useEffect(() => subscribeAudioPlayer(setPlayer), []);

  useEffect(() => {
    return () => stopAudioPlayback();
  }, []);

  useEffect(() => {
    if (!player.playingId || Platform.OS !== 'web') return;
    document.getElementById(`word-card-${player.playingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [player.playingId]);

  const playableKey = playable.map((word) => `${word.id}:${word.audioUrl}`).join('|');
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const tracks = playableKey
      .split('|')
      .filter(Boolean)
      .map((item) => {
        const splitAt = item.indexOf(':');
        return { id: item.slice(0, splitAt), url: item.slice(splitAt + 1) };
      });
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (getAudioPlayerState().mode === 'playlist') stopAudioPlayback();
        else startAudioPlaylist(tracks);
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (!tracks.length) return;
      const current = getAudioPlayerState().playingId;
      const index = tracks.findIndex((track) => track.id === current);
      const forward = event.key === 'ArrowLeft';
      const nextIndex = index < 0 ? 0 : forward ? Math.min(tracks.length - 1, index + 1) : Math.max(0, index - 1);
      const track = tracks[nextIndex];
      if (track) playAudioTrack(track);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playableKey]);

  function playOne(word: QuranWord) {
    if (!word.audioUrl) return;
    playAudioTrack({ id: word.id, url: word.audioUrl });
  }

  return (
    <View style={styles.wrap}>
      {showPlaylist ? <PlaylistButton words={words} /> : null}
      {expanded ? <Text style={styles.keys}>Spasi memutar atau menghentikan ayat. Panah kiri ke kata berikutnya, panah kanan ke kata sebelumnya.</Text> : null}
      {[...groups.entries()].map(([key, group]) => (
        <View key={key} style={styles.group}>
          <Text style={styles.ayah}>QS {group[0].surahNumber}:{group[0].ayahNumber}</Text>
          <View style={styles.grid}>
            {group.map((word) => {
              const visual = categoryVisual(word.tamyizCategory, word.colorCode, dark);
              const status = cardStatus(word.id, player.playingId, completedIds);
              const playing = status === 'playing';
              const completed = status === 'completed';
              return (
                <PulseCard key={word.id} active={playing} style={{ flexBasis: basis, flexGrow: 1, minWidth: 140 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Putar ${word.translation}`}
                    disabled={!word.audioUrl}
                    onPressIn={() => {
                      if (word.audioUrl) selectionHaptic();
                    }}
                    onPress={() => playOne(word)}
                    style={({ pressed }) => [pressed && word.audioUrl ? styles.cardPressed : null]}
                  >
                  <View
                    nativeID={`word-card-${word.id}`}
                    style={[
                      styles.card,
                      { backgroundColor: visual.backgroundColor, borderColor: playing ? colors.gold : completed ? '#B71C1C' : visual.borderColor },
                      playing && styles.playing,
                      completed && styles.completed,
                      noSelect,
                    ]}
                  >
                    {playing ? <Equalizer /> : null}
                    <Text selectable={false} style={[arabicFont, styles.arabic, { color: visual.textColor, fontSize: 36 * arabicScale, lineHeight: 56 * arabicScale }]}>
                      {word.arabicText}
                    </Text>
                    <Text selectable={false} style={[styles.translation, { color: visual.textColor }]}>{word.translation}</Text>
                    <Text selectable={false} style={[styles.category, { color: completed ? '#B71C1C' : visual.textColor }]}>
                      {playing ? 'Sedang diputar' : completed ? 'Selesai' : visual.label}
                    </Text>
                    <View style={[styles.play, { borderColor: playing ? colors.gold : completed ? '#B71C1C' : visual.borderColor }]}>
                      <Text style={[styles.playText, { color: playing ? '#6D4C00' : completed ? '#B71C1C' : visual.textColor }]}>
                        {word.audioUrl ? 'Putar' : 'Audio menyusul'}
                      </Text>
                    </View>
                  </View>
                  </Pressable>
                </PulseCard>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  group: { gap: 10 },
  ayah: { ...latinFont, color: colors.muted, fontWeight: '700' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  card: {
    flexGrow: 1,
    minHeight: 168,
    minWidth: 140,
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  playing: { borderWidth: 3, shadowColor: colors.gold, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  completed: { borderWidth: 3 },
  arabic: { textAlign: 'center' },
  translation: { ...latinFont, textAlign: 'center', fontSize: 15 },
  category: { ...latinFont, fontSize: 12, fontWeight: '800' },
  play: { minHeight: 48, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  cardPressed: { transform: [{ scale: 0.97 }] },
  playText: { ...latinFont, fontWeight: '800', fontSize: 13 },
  keys: { ...latinFont, color: colors.muted, fontSize: 13, lineHeight: 20 },
  equalizer: { flexDirection: 'row', alignItems: 'flex-end', height: 16, gap: 3 },
  bar: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.gold },
});
