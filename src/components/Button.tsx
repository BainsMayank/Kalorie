import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  /** `primary` = filled (the main action), `secondary` = outlined, `text` = no box. */
  kind?: 'primary' | 'secondary' | 'text';
  disabled?: boolean;
  testID?: string;
};

/** A full-width button, at least 48 dp tall (SPEC §8.2). Monochrome, like the rest of the app. */
export function Button({ label, onPress, kind = 'primary', disabled = false, testID }: Props) {
  const { colors, fontSize, radius, minTapTarget, spacing } = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.center,
        {
          minHeight: minTapTarget,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: primary ? colors.text : 'transparent',
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: primary ? colors.background : colors.text,
          fontSize: fontSize.body,
          fontWeight: '600',
          textDecorationLine: kind === 'text' ? 'underline' : 'none',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
