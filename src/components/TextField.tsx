import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

/**
 * A labelled text box, at least 48 dp tall (Account, My group). `large` = bigger, spaced-out
 * characters, for a code. No autocorrect or automatic capitals unless asked for.
 */
export function TextField({
  label,
  large = false,
  ...input
}: { label: string; large?: boolean } & Omit<TextInputProps, 'style'>) {
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors.iconInactive}
        style={{
          minHeight: minTapTarget,
          borderRadius: radius.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: large ? fontSize.title : fontSize.body,
          letterSpacing: large ? 4 : 0,
          paddingHorizontal: spacing.md,
        }}
      />
    </View>
  );
}
