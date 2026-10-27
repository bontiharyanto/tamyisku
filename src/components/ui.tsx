import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useAppearance, useColors } from '@/lib/appearance';
import { selectionHaptic } from '@/lib/haptics';
import { colors, latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { BrandLogo } from '@/components/BrandLogo';

export function SkeletonList({ count = 3 }: { count?: number }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: count }, (_, index) => (
        <Animated.View key={index} style={[styles.skeleton, { opacity: pulse }]} />
      ))}
    </View>
  );
}

export function BootScreen({ label = 'Menyiapkan Tamyizku...' }: { label?: string }) {
  return (
    <View style={styles.boot}>
      <View style={styles.bootCard}>
        <BrandLogo width={180} />
      </View>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Screen({
  children,
  edges = ['bottom'],
  scroll = true,
  fab,
  footer,
}: {
  children: ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  fab?: { label: string; onPress: () => void };
  footer?: ReactNode;
}) {
  const { contentMax, gutter, compact } = useViewport();
  const palette = useColors();
  const frame = { padding: gutter, maxWidth: contentMax, width: '100%' as const, alignSelf: 'center' as const };
  const body = scroll ? (
    <ScrollView
      style={footer ? styles.fill : undefined}
      contentContainerStyle={[styles.content, frame, compact && fab ? styles.fabSpace : null]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, frame]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: palette.background }]}>
      {body}
      {footer ? <View style={[styles.footerBar, { backgroundColor: palette.card, borderTopColor: palette.line }]}>{footer}</View> : null}
      {fab ? (
        <Pressable accessibilityRole="button" accessibilityLabel={fab.label} onPress={fab.onPress} style={styles.fab}>
          <Text style={styles.fabText}>{fab.label}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const palette = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyMark, { borderColor: palette.gold, backgroundColor: '#FFF8E1' }]}>
        <Text style={styles.emptyMarkText}>ت</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: palette.muted }]}>{body}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
}) {
  const palette = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPressIn={() => {
        if (!disabled && !loading) selectionHaptic();
      }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'ghost' && [styles.ghost, { borderColor: palette.primary }],
        tone === 'danger' && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={tone === 'ghost' ? palette.primary : colors.white} /> : <Text style={[styles.buttonText, tone === 'ghost' && { color: palette.primary }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...input } = props;
  const palette = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
      <TextInput placeholderTextColor={palette.muted} style={[styles.input, { backgroundColor: palette.card, color: palette.text, borderColor: palette.line }, style]} {...input} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { palette, dark } = useAppearance();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.line },
        dark ? styles.cardGlow : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'green' | 'gold' | 'muted' }) {
  return (
    <View style={[styles.badge, tone === 'green' && styles.badgeGreen, tone === 'gold' && styles.badgeGold]}>
      <Text style={[styles.badgeText, tone === 'muted' && styles.badgeMutedText]}>{label}</Text>
    </View>
  );
}

export function useToast() {
  return useToastState();
}

type ToastItem = { id: number; message: string; tone: 'ok' | 'err' };

const listeners = new Set<(toast: ToastItem) => void>();

export function notify(message: string, tone: 'ok' | 'err' = 'ok') {
  const toast = { id: Date.now(), message, tone };
  listeners.forEach((listener) => listener(toast));
}

function useToastState() {
  return notify;
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const { compact } = useViewport();
  useEffect(() => {
    const listener = (next: ToastItem) => setToast(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, toast.tone === 'err' && styles.toastErr, { bottom: compact ? 88 : 24 }]}>
      <Text style={styles.toastText}>{toast.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootCard: { backgroundColor: colors.white, borderRadius: 28, padding: 12 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { gap: 12 },
  fill: { flex: 1 },
  fabSpace: { paddingBottom: 88 },
  button: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  buttonText: { ...latinFont, color: colors.white, fontWeight: '700', fontSize: 16 },
  ghostText: { color: colors.primary },
  field: { gap: 6 },
  fieldLabel: { ...latinFont, color: colors.muted, fontSize: 13, fontWeight: '600' },
  input: { ...latinFont, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8,
  },
  cardGlow: {
    shadowColor: '#1F4237',
    shadowOpacity: 0.85,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  footerBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
  emptyMark: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  emptyMarkText: { fontSize: 32, color: '#0F5132', fontWeight: '700' },
  emptyTitle: { ...latinFont, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { ...latinFont, textAlign: 'center', lineHeight: 22 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#ECEAE4' },
  badgeGreen: { backgroundColor: '#E7F6EF' },
  badgeGold: { backgroundColor: '#F8EFDA', borderWidth: 1, borderColor: colors.gold },
  badgeText: { ...latinFont, color: colors.primary, fontWeight: '700', fontSize: 12 },
  badgeMutedText: { color: colors.muted },
  muted: { ...latinFont, color: '#D7E4DF' },
  toast: { position: 'absolute', left: 16, right: 16, backgroundColor: colors.primaryDark, borderRadius: 14, padding: 14, alignSelf: 'center', maxWidth: 520 },
  toastErr: { backgroundColor: colors.danger },
  toastText: { ...latinFont, color: colors.white, textAlign: 'center', fontWeight: '600' },
  skeletonList: { gap: 12 },
  skeleton: { height: 96, borderRadius: 18, backgroundColor: colors.line },
  fab: { position: 'absolute', right: 20, bottom: 24, minHeight: 52, borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { ...latinFont, color: colors.white, fontWeight: '800' },
});
