import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUndoStore } from '@/stores/undo';
import { useTheme } from '@/theme';

type Props = {
  /**
   * `tabs`: inside a tab screen, whose bottom edge is already above the tab bar.
   * `screen`: on a full screen, so the bar keeps clear of the home indicator (and the keyboard).
   */
  placement: 'tabs' | 'screen';
};

/**
 * "Removed Mixed dal · Undo" for 5 seconds after a log, delete or copy (SPEC §2.2, §5.11).
 * Each screen that logs or deletes puts one at the end of its own view, where taps reach it
 * reliably: native screens don't let a bar drawn outside them receive taps on iOS.
 */
export function UndoBar({ placement }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const current = useUndoStore((state) => state.current);
  const undo = useUndoStore((state) => state.undo);
  const keyboard = useKeyboardHeight();

  if (!current) return null;
  const bottom =
    placement === 'tabs'
      ? spacing.md
      : // Just above the keyboard while it is open, so the bar is never hidden.
        keyboard > 0
        ? keyboard + spacing.sm
        : insets.bottom + spacing.md;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { left: spacing.lg, right: spacing.lg, bottom }]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.text,
            borderRadius: radius.md,
            paddingLeft: spacing.lg,
            minHeight: minTapTarget,
          },
        ]}
      >
        <Text
          style={[styles.flex, { color: colors.background, fontSize: fontSize.body }]}
          numberOfLines={2}
        >
          {current.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('undo.button')}
          onPress={() => {
            undo().catch(() => {});
          }}
          style={({ pressed }) => [
            styles.button,
            {
              minHeight: minTapTarget,
              paddingHorizontal: spacing.lg,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.background, fontSize: fontSize.body, fontWeight: '700' }}>
            {t('undo.button')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The keyboard's height while it is open on iOS, else 0. Android resizes the screen for the
 * keyboard by itself, so the bar already sits above it there.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center' },
  button: { alignItems: 'center', justifyContent: 'center' },
});
