import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

type Props<T extends string> = {
  /** Read out by screen readers for the whole group, e.g. "Unit". */
  label: string;
  choices: readonly Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** One line that scrolls sideways, instead of wrapping onto more lines. */
  scroll?: boolean;
};

/** A row of pill buttons where exactly one is picked (units, meal slots…). Wraps onto more lines. */
export function ChoiceChips<T extends string>({
  label,
  choices,
  selected,
  onSelect,
  scroll = false,
}: Props<T>) {
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const chips = choices.map((choice) => {
    const isSelected = choice.value === selected;
    return (
      <Pressable
        key={choice.value}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={choice.label}
        onPress={() => onSelect(choice.value)}
        style={[
          styles.center,
          {
            minHeight: minTapTarget,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg * 2,
            borderWidth: 1,
            borderColor: isSelected ? colors.text : colors.border,
            backgroundColor: isSelected ? colors.text : colors.surface,
          },
        ]}
      >
        <Text
          style={{
            color: isSelected ? colors.background : colors.text,
            fontSize: fontSize.body,
          }}
        >
          {choice.label}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        contentContainerStyle={{ gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {chips}
      </ScrollView>
    );
  }
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.wrap, { gap: spacing.sm }]}
    >
      {chips}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
