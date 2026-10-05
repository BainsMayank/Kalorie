import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomSheet, Button, ChoiceChips, NumberField } from '@/components';
import { formatDate, formatDayName } from '@/i18n/dates';
import { addDays } from '@/lib/day';
import { formatKg } from '@/lib/format';
import { BODY_RANGES, inRange } from '@/lib/measure';
import { parseAmount } from '@/lib/parse';
import { useGoalsStore } from '@/stores/goals';
import { useTheme } from '@/theme';

type Props = {
  today: string;
  onClose: () => void;
} & ({ mode: 'add'; startKg: number | null } | { mode: 'edit'; day: string; kg: number });

/**
 * Add a weigh-in (for today or yesterday) or change / delete one. One weigh-in a day: saving on
 * a day that has one replaces it (SPEC §4.2).
 */
export function WeightSheet(props: Props) {
  const { today, onClose } = props;
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const saveWeighIn = useGoalsStore((state) => state.saveWeighIn);
  const deleteWeighIn = useGoalsStore((state) => state.deleteWeighIn);
  const [day, setDay] = useState(props.mode === 'edit' ? props.day : today);
  const start = props.mode === 'edit' ? props.kg : props.startKg;
  const [text, setText] = useState(start === null ? '' : formatKg(start));
  const [failed, setFailed] = useState(false);
  const kg = inRange(parseAmount(text), BODY_RANGES.weightKg);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      onClose();
    } catch {
      setFailed(true);
    }
  };

  const yesterday = addDays(today, -1);
  return (
    <BottomSheet
      title={
        props.mode === 'edit'
          ? t('weight.editTitle', { date: formatDate(t, day, today) })
          : t('weight.addTitle')
      }
      onClose={onClose}
      footer={
        <View style={{ gap: spacing.sm }}>
          {failed && (
            <Text style={{ color: colors.text, fontSize: fontSize.body, textAlign: 'center' }}>
              {t('entry.saveProblem')}
            </Text>
          )}
          <Button
            label={t('weight.save')}
            disabled={kg === null}
            onPress={() => kg !== null && void run(() => saveWeighIn(day, kg))}
            testID="weight-save"
          />
          {props.mode === 'edit' && (
            <Button
              label={t('weight.delete')}
              kind="secondary"
              onPress={() => void run(() => deleteWeighIn(day))}
              testID="weight-delete"
            />
          )}
        </View>
      }
    >
      <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
        <NumberField
          label={t('weight.label')}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setFailed(false);
          }}
          unit={t('about.kg')}
          testID="weight-kg"
        />
        {props.mode === 'add' && (
          <ChoiceChips
            label={t('weight.day')}
            choices={[today, yesterday].map((value) => ({
              value,
              label: formatDayName(t, value, today),
            }))}
            selected={day}
            onSelect={setDay}
          />
        )}
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {t('weight.hint')}
        </Text>
      </View>
    </BottomSheet>
  );
}
