import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ChoiceChips, NumberField } from '@/components';
import { formatQty } from '@/lib/format';
import { cmFromFtIn, ftInFromCm } from '@/lib/measure';
import { parseAmount } from '@/lib/parse';
import { useTheme } from '@/theme';

type Unit = 'cm' | 'ftin';

/** Height in cm, or feet + inches (SPEC §1: always stored as cm). */
export function HeightField({
  heightCm,
  onChange,
}: {
  heightCm: number | null;
  onChange: (cm: number | null) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [unit, setUnit] = useState<Unit>('cm');
  const [cmText, setCmText] = useState(heightCm === null ? '' : formatQty(heightCm));
  const start = heightCm === null ? null : ftInFromCm(heightCm);
  const [feet, setFeet] = useState(start === null ? '' : String(start.feet));
  const [inches, setInches] = useState(start === null ? '' : String(start.inches));

  const changeCm = (text: string) => {
    setCmText(text);
    onChange(parseAmount(text));
  };
  const changeFtIn = (ft: string, inch: string) => {
    setFeet(ft);
    setInches(inch);
    const f = parseAmount(ft);
    onChange(f === null ? null : cmFromFtIn(f, parseAmount(inch) ?? 0));
  };
  const switchUnit = (next: Unit) => {
    setUnit(next);
    // Show the same height in the other unit.
    if (heightCm === null) return;
    if (next === 'cm') setCmText(formatQty(Math.round(heightCm)));
    else {
      const { feet: f, inches: i } = ftInFromCm(heightCm);
      setFeet(String(f));
      setInches(String(i));
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {unit === 'cm' ? (
        <NumberField
          label={t('about.height')}
          value={cmText}
          onChangeText={changeCm}
          unit={t('about.cm')}
          testID="height-cm"
        />
      ) : (
        <View style={[styles.row, { gap: spacing.md }]}>
          <NumberField
            label={t('about.height')}
            value={feet}
            onChangeText={(text) => changeFtIn(text, inches)}
            unit={t('about.feet')}
            integer
          />
          <NumberField
            label={t('about.inches')}
            value={inches}
            onChangeText={(text) => changeFtIn(feet, text)}
            unit={t('about.inchesUnit')}
          />
        </View>
      )}
      <ChoiceChips
        label={t('about.heightUnit')}
        choices={[
          { value: 'cm', label: t('about.cm') },
          { value: 'ftin', label: t('about.ftIn') },
        ]}
        selected={unit}
        onSelect={switchUnit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
