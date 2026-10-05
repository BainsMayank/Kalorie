import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/format';
import { NUTRIENTS } from '@/lib/nutrients';
import { microRequirements, type ActivityLevel, type Sex } from '@/lib/targets';
import { useTheme } from '@/theme';

/** Reference values are shown exactly as ICMR-NIN prints them (13.2 mg, 1,000 mg). */
function exact(value: number | null): string | null {
  if (value === null) return null;
  return Number.isInteger(value) ? formatKcal(value) : String(value);
}

/**
 * Daily vitamin and mineral needs from ICMR-NIN 2020 (icmr.ts) for the person's sex, age and
 * activity, with the safe upper limit where the report gives one. Read-only until Stage 9.
 */
export function MicroList({
  sex,
  age,
  activity,
}: {
  sex: Sex | null;
  age: number | null;
  activity: ActivityLevel | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  // Skipped answers: "prefer not to say" and an adult age, so the list is never empty for adults.
  const reqs = microRequirements(sex ?? 'x', age ?? 30, activity ?? 'sedentary');
  if (!reqs) {
    return (
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
        {t('about.under18')}
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {NUTRIENTS.filter((n) => reqs[n.key]).map((n) => {
        const req = reqs[n.key]!;
        const unit = t(`nutrientUnits.${n.unit}`);
        const need =
          req.need === null
            ? t('goals.microLimitOnly', { value: exact(req.tul), unit })
            : t('goals.microNeed', { value: exact(req.need), unit });
        return (
          <View key={n.key} style={styles.row}>
            <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
              {t(`nutrients.${n.key}`)}
            </Text>
            <View style={styles.right}>
              <Text style={{ color: colors.text, fontSize: fontSize.body }}>{need}</Text>
              {req.need !== null && req.tul !== null && (
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                  {/* Magnesium's upper limit is for supplements only (ICMR-NIN p. 17). */}
                  {n.key === 'magnesium_mg'
                    ? t('goals.microUpperSupplements', { value: exact(req.tul), unit })
                    : t('goals.microUpper', { value: exact(req.tul), unit })}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  right: { alignItems: 'flex-end' },
});
