import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { ChoiceChips, NumberField } from '@/components';
import type { Sex } from '@/lib/targets';
import { useTheme } from '@/theme';

import { isUnder18, type AboutDraft } from './draft';
import { HeightField } from './HeightField';

const SEXES: Sex[] = ['m', 'f', 'x'];

/** Sex, age, height and weight — each one can be left empty (SPEC §2.1 "About you"). */
export function AboutFields({
  draft,
  onChange,
}: {
  draft: AboutDraft;
  onChange: (changes: Partial<AboutDraft>) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {t('about.sex')}
        </Text>
        <ChoiceChips
          label={t('about.sex')}
          choices={SEXES.map((value) => ({ value, label: t(`about.sexOptions.${value}`) }))}
          selected={draft.sex}
          onSelect={(sex) => onChange({ sex })}
        />
      </View>
      <View style={[styles.row, { gap: spacing.md }]}>
        <NumberField
          label={t('about.age')}
          value={draft.age}
          onChangeText={(age) => onChange({ age })}
          unit={t('about.years')}
          integer
          testID="age"
        />
        <NumberField
          label={t('about.weight')}
          value={draft.weight}
          onChangeText={(weight) => onChange({ weight })}
          unit={t('about.kg')}
          testID="weight"
        />
      </View>
      {isUnder18(draft) && (
        <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('about.under18')}</Text>
      )}
      <HeightField heightCm={draft.heightCm} onChange={(heightCm) => onChange({ heightCm })} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
