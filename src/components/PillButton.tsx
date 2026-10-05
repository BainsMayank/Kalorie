import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** `outline` = a thin border (the usual), `filled` = the main action on its card. */
  kind?: 'outline' | 'filled';
  /** Bold label, for a pill that is the one thing to do in its box. */
  strong?: boolean;
  /** For screen readers, when the label alone isn't clear ("Bring back" → "Bring back Mixed dal"). */
  accessibilityLabel?: string;
};

/**
 * A rounded, content-sized button with an optional icon: *Quick add*, *Scan barcode*,
 * *Use 1,500 kcal*. At least 48 dp tall (SPEC §8.2). `Button` is the full-width one.
 */
export function PillButton({
  label,
  onPress,
  icon,
  kind = 'outline',
  strong = false,
  accessibilityLabel,
}: Props) {
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const filled = kind === 'filled';
  const textColor = filled ? colors.background : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: minTapTarget,
          paddingHorizontal: filled ? spacing.xl : spacing.lg,
          gap: spacing.xs,
          borderRadius: radius.lg * 2,
          borderWidth: filled ? 0 : 1,
          borderColor: strong ? colors.text : colors.border,
          backgroundColor: filled ? colors.text : pressed ? colors.surfaceMuted : colors.surface,
          opacity: filled && pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={filled ? 20 : 18} color={textColor} />}
      <Text
        style={{
          color: textColor,
          fontSize: fontSize.body,
          fontWeight: filled || strong ? '600' : 'normal',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
