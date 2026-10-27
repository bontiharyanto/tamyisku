import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lessonNodeState, type LessonNodeState } from '@/lib/leveling';
import { latinFont } from '@/lib/theme';
import type { Lesson, ProgressRow } from '@/lib/types';

const MARK: Record<LessonNodeState, { glyph: string; label: string; color: string }> = {
  completed: { glyph: '✓', label: 'Selesai', color: '#1B5E20' },
  active: { glyph: '●', label: 'Sedang dibuka', color: '#0D47A1' },
  locked: { glyph: '🔒', label: 'Terkunci', color: '#8A8175' },
};

export function LearningRoadmap({
  lessons,
  progress,
  admin,
  nearby = false,
}: {
  lessons: Lesson[];
  progress: ProgressRow[];
  admin: boolean;
  nearby?: boolean;
}) {
  const router = useRouter();
  const ordered = [...lessons].sort((left, right) => left.orderIndex - right.orderIndex);
  const activeIndex = Math.max(
    0,
    ordered.findIndex((lesson) => lessonNodeState(lesson, ordered, progress, admin) === 'active'),
  );
  const visible = nearby ? ordered.slice(Math.max(0, activeIndex - 1), activeIndex + 4) : ordered;

  return (
    <View style={styles.wrap}>
      {visible.map((lesson, index) => {
        const state = lessonNodeState(lesson, ordered, progress, admin);
        const mark = MARK[state];
        const score = progress.find((item) => item.lessonId === lesson.id)?.score;
        return (
          <Pressable
            key={lesson.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: state === 'locked' }}
            disabled={state === 'locked'}
            onPress={() => router.push(`/lesson/${lesson.id}`)}
            style={styles.node}
          >
            {index < visible.length - 1 ? <View style={styles.line} /> : null}
            <View style={[styles.dot, { borderColor: mark.color, backgroundColor: state === 'locked' ? '#F3F0EA' : '#FFFFFF' }]}>
              <Text style={{ color: mark.color, fontWeight: '800' }}>{mark.glyph}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, state === 'locked' && styles.lockedText]}>{lesson.title}</Text>
              <Text style={[styles.meta, { color: mark.color }]}>
                {mark.label}{typeof score === 'number' ? ` · ${score}` : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  node: { flexDirection: 'row', gap: 12, minHeight: 64, alignItems: 'flex-start' },
  line: { position: 'absolute', left: 17, top: 36, bottom: -8, width: 2, backgroundColor: '#E6E0D6' },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, paddingBottom: 12 },
  title: { ...latinFont, fontWeight: '800', fontSize: 16 },
  lockedText: { color: '#8A8175' },
  meta: { ...latinFont, fontWeight: '700', fontSize: 13 },
});
