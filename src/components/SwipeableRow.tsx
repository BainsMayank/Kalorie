import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

const ACTION_WIDTH = 96;

/**
 * The swipe itself: where the row is, and what a drag does. A drag left past half the button's
 * width leaves the row open; anything less springs it back.
 */
function createSwipe(onOpenChange: (open: boolean) => void) {
  const translateX = new Animated.Value(0);
  let isOpen = false;
  let listener: ((swiping: boolean) => void) | undefined;

  const settle = (next: boolean) => {
    isOpen = next;
    onOpenChange(next);
    Animated.spring(translateX, {
      toValue: next ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };
  const start = () => (isOpen ? -ACTION_WIDTH : 0);

  const pan = PanResponder.create({
    // Take over only for a clearly sideways drag, so the list still scrolls up and down.
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => listener?.(true),
    onPanResponderMove: (_, g) => {
      translateX.setValue(Math.min(0, Math.max(-ACTION_WIDTH * 1.5, start() + g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      settle(start() + g.dx < -ACTION_WIDTH / 2);
      listener?.(false);
    },
    onPanResponderTerminate: () => {
      settle(isOpen);
      listener?.(false);
    },
    onPanResponderTerminationRequest: () => false,
  });

  return {
    translateX,
    settle,
    handlers: pan.panHandlers,
    setListener: (next: typeof listener) => {
      listener = next;
    },
  };
}

type Props = {
  children: ReactNode;
  /** The action shown behind the row, e.g. "Delete". */
  actionLabel: string;
  onAction: () => void;
  /** Called when a swipe starts and ends, so a list can stop scrolling meanwhile. */
  onSwipeChange?: (swiping: boolean) => void;
};

/**
 * A row that slides left to show an action button behind it (SPEC §2.2: swipe left → delete).
 * Built with React Native's own PanResponder, so it needs no extra library. The button is
 * neutral grey, never red (SPEC §8.1). Screen-reader users get the same action through the
 * row's accessibility actions, which the caller adds.
 */
export function SwipeableRow({ children, actionLabel, onAction, onSwipeChange }: Props) {
  const { colors, spacing, fontSize } = useTheme();
  const [open, setOpen] = useState(false);
  // The slide position and gesture handlers are made once and kept for the row's lifetime.
  const [swipe] = useState(() => createSwipe(setOpen));
  useEffect(() => swipe.setListener(onSwipeChange), [swipe, onSwipeChange]);

  return (
    <View style={styles.clip}>
      <View
        style={[StyleSheet.absoluteFill, styles.actions, { backgroundColor: colors.surfaceMuted }]}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!open}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={() => {
            swipe.settle(false);
            onAction();
          }}
          style={[styles.action, { width: ACTION_WIDTH, gap: spacing.xs }]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: fontSize.caption }}>{actionLabel}</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX: swipe.translateX }] }} {...swipe.handlers}>
        {children}
        {open && (
          // While open, a tap on the row closes it instead of opening the entry.
          <Pressable
            accessible={false}
            onPress={() => swipe.settle(false)}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: { alignItems: 'center', justifyContent: 'center' },
});
