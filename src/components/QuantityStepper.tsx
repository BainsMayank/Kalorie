import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  value: string;
  onChange: (text: string) => void;
  onStep: (direction: 1 | -1) => void;
  /** Grams and ml: a wider box, since the amount is usually typed. */
  freeNumber: boolean;
  unitLabel: string;
};

/** − [ 1.5 ] katori + : the amount can be stepped with the buttons or typed. */
export function QuantityStepper({ value, onChange, onStep, freeNumber, unitLabel }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const button = (direction: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(direction === 1 ? 'food.increase' : 'food.decrease')}
      onPress={() => onStep(direction)}
      style={({ pressed }) => [
        styles.center,
        {
          width: minTapTarget,
          height: minTapTarget,
          borderRadius: minTapTarget / 2,
          backgroundColor: pressed ? colors.border : colors.surfaceMuted,
        },
      ]}
    >
      <Ionicons name={direction === 1 ? 'add' : 'remove'} size={24} color={colors.text} />
    </Pressable>
  );

  return (
    <View
      style={[styles.row, { justifyContent: 'center', marginTop: spacing.lg, gap: spacing.md }]}
    >
      {button(-1)}
      <View style={[styles.row, { gap: spacing.sm }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={t('food.amount')}
          style={{
            minWidth: freeNumber ? 88 : 64,
            minHeight: minTapTarget,
            textAlign: 'center',
            color: colors.text,
            fontSize: fontSize.title,
            fontWeight: '600',
            borderRadius: radius.sm,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: spacing.sm,
          }}
        />
        <Text style={{ color: colors.text, fontSize: fontSize.body }}>{unitLabel}</Text>
      </View>
      {button(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
