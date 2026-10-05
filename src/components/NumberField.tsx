import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  label: string;
  /** What is typed, as text (so "12." can be typed on the way to "12.5"). */
  value: string;
  onChangeText: (text: string) => void;
  /** Shown after the number, e.g. "kg". */
  unit?: string;
  placeholder?: string;
  /** Whole numbers only (age). */
  integer?: boolean;
  testID?: string;
};

/** A labelled number box with its unit, at least 48 dp tall (SPEC §8.2). */
export function NumberField({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  integer = false,
  testID,
}: Props) {
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  return (
    <View style={styles.flex}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.row,
          {
            minHeight: minTapTarget,
            borderRadius: radius.sm,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          accessibilityLabel={unit ? `${label}, ${unit}` : label}
          placeholder={placeholder}
          placeholderTextColor={colors.iconInactive}
          maxLength={7}
          style={[
            styles.flex,
            { color: colors.text, fontSize: fontSize.body, minHeight: minTapTarget },
          ]}
        />
        {unit !== undefined && (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>{unit}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
