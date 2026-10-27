import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { Platform, Vibration } from 'react-native';

let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;
let token = 0;

export type AudioTrack = { id: string; url: string };
export type AudioPlayMode = 'idle' | 'playlist' | 'single';
export type AudioPlayerState = {
  mode: AudioPlayMode;
  playingId: string | null;
  completedIds: string[];
};

const idleState: AudioPlayerState = { mode: 'idle', playingId: null, completedIds: [] };
let audioPlayerState: AudioPlayerState = idleState;
let queue: AudioTrack[] = [];
const playerListeners = new Set<(state: AudioPlayerState) => void>();

function getPlayer() {
  if (!player) player = createAudioPlayer(null);
  return player;
}

function publish(next: AudioPlayerState) {
  audioPlayerState = next;
  playerListeners.forEach((listener) => listener(next));
}

export function getAudioPlayerState() {
  return audioPlayerState;
}

export function subscribeAudioPlayer(listener: (state: AudioPlayerState) => void) {
  playerListeners.add(listener);
  listener(audioPlayerState);
  return () => {
    playerListeners.delete(listener);
  };
}

function haltPlayer() {
  token += 1;
  subscription?.remove();
  subscription = null;
  const current = getPlayer();
  current.pause();
}

export function stopAudioPlayback() {
  haltPlayer();
  queue = [];
  publish({ ...audioPlayerState, mode: 'idle', playingId: null });
}

function playAt(index: number, mine: number) {
  const track = queue[index];
  if (!track || mine !== token) {
    publish({ ...audioPlayerState, mode: 'idle', playingId: null });
    return;
  }
  publish({ ...audioPlayerState, playingId: track.id });
  const current = getPlayer();
  let advanced = false;
  let started = false;
  subscription?.remove();
  subscription = current.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    if (status.playing) started = true;
    if (mine !== token || advanced || !started || !status.didJustFinish) return;
    advanced = true;
    const finishedId = queue[index]?.id;
    const completedIds = finishedId ? [...new Set([...audioPlayerState.completedIds, finishedId])] : audioPlayerState.completedIds;
    const next = index + 1;
    if (audioPlayerState.mode !== 'playlist' || next >= queue.length) {
      publish({ mode: 'idle', playingId: null, completedIds });
      return;
    }
    publish({ mode: 'playlist', playingId: queue[next]?.id ?? null, completedIds });
    playAt(next, mine);
  });
  current.replace({ uri: track.url });
  current.play();
}

export function startAudioPlaylist(tracks: AudioTrack[]) {
  const playable = tracks.filter((track) => track.url);
  if (!playable.length) return;
  haltPlayer();
  queue = playable;
  const mine = token;
  publish({ mode: 'playlist', playingId: playable[0]?.id ?? null, completedIds: [] });
  playAt(0, mine);
}

export function playAudioTrack(track: AudioTrack) {
  if (!track.url) return;
  haltPlayer();
  queue = [track];
  const mine = token;
  publish({ ...audioPlayerState, mode: 'single', playingId: track.id });
  playAt(0, mine);
}

export function playUrl(url: string) {
  haltPlayer();
  queue = [];
  publish({ ...audioPlayerState, mode: 'idle', playingId: null });
  const current = getPlayer();
  current.replace({ uri: url });
  current.play();
}

export function playCelebration() {
  if (Platform.OS !== 'web') {
    Vibration.vibrate([0, 40, 50, 40, 50, 80]);
    return;
  }
  const AudioContextCtor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  [523, 659, 784].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const start = context.currentTime + index * 0.12;
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  });
}

export function playFeedback(correct: boolean) {
  if (Platform.OS !== 'web') return;
  const AudioContextCtor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = correct ? 880 : 196;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
}
