import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useColors } from '@/lib/appearance';
import { useViewport } from '@/lib/viewport';
import { colors } from '@/lib/theme';

export function BottomSheet({
  visible,
  onClose,
  children,
  dismissOnBackdrop = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissOnBackdrop?: boolean;
}) {
  const { compact } = useViewport();
  const palette = useColors();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) drag.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 110) closeRef.current();
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType={compact ? 'slide' : 'fade'} onRequestClose={onClose}>
      <View style={[styles.frame, !compact && styles.frameCenter]}>
        <Pressable style={styles.backdrop} onPress={dismissOnBackdrop ? onClose : undefined} />
        <Animated.View style={[compact ? styles.sheet : styles.dialog, { backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1 }, compact && { transform: [{ translateY: drag }] }]}>
          {compact ? (
            <View style={styles.handleHit} {...pan.panHandlers}>
              <View style={styles.handle} />
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  frameCenter: { justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 18, 0.46)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    gap: 10,
  },
  dialog: {
    alignSelf: 'center',
    width: '92%',
    maxWidth: 480,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    gap: 10,
  },
  handleHit: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 8 },
  handle: { width: 48, height: 5, borderRadius: 99, backgroundColor: colors.line },
});
