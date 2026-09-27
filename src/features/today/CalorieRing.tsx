import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
// Imported from its own file: the package's main file also loads the bar and line charts,
// which need a gradient library Kalorie doesn't use.
import { PieChart } from 'react-native-gifted-charts/dist/PieChart';

import { formatKcal } from '@/lib/format';
import type { Progress } from '@/lib/nutrition';
import { useTheme } from '@/theme';

const RADIUS = 92; // the main ring
const THICKNESS = 14;
const GAP = 4; // between the ring and the outer arc
const ARC = 5; // the thin outer arc for "more than planned"
const OUTER = RADIUS + GAP + ARC;

/** A ring filled to `fraction` (0–1), starting at 12 o'clock and going clockwise. */
function ringData(fraction: number, fill: string, track: string) {
  if (fraction <= 0) return [{ value: 1, color: track }];
  if (fraction >= 1) return [{ value: 1, color: fill }];
  return [
    { value: fraction, color: fill },
    { value: 1 - fraction, color: track },
  ];
}

/**
 * The calorie ring (SPEC §2.2): eaten in the middle, the target under it, and what's left (or
 * how much more than planned) below. The ring fills to 100%; anything beyond shows as a thin
 * soft-blue outer arc — never red.
 */
export function CalorieRing({ kcal }: { kcal: Progress }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const eaten = formatKcal(kcal.eaten)!;
  const target = formatKcal(kcal.target)!;

  let status: string;
  if (kcal.over > 0) status = t('today.ring.more', { value: formatKcal(kcal.over) });
  else if (kcal.left > 0) status = t('today.ring.left', { value: formatKcal(kcal.left) });
  else status = t('today.ring.atTarget');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('today.ring.label', { eaten, target, status })}
      style={styles.center}
    >
      <View style={{ width: OUTER * 2, height: OUTER * 2 }}>
        {kcal.overFraction > 0 && (
          <View style={StyleSheet.absoluteFill}>
            <PieChart
              donut
              radius={OUTER}
              innerRadius={RADIUS + GAP}
              innerCircleColor={colors.background}
              data={ringData(kcal.overFraction, colors.offTarget, 'transparent')}
            />
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, { top: GAP + ARC, left: GAP + ARC }]}>
          <PieChart
            donut
            radius={RADIUS}
            innerRadius={RADIUS - THICKNESS}
            innerCircleColor={colors.background}
            data={ringData(kcal.fraction, colors.text, colors.border)}
            centerLabelComponent={() => (
              <View style={styles.center}>
                <Text style={{ color: colors.text, fontSize: 40, fontWeight: '700' }}>{eaten}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                  {t('today.ring.ofTarget', { target })}
                </Text>
              </View>
            )}
          />
        </View>
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.body,
          fontWeight: '600',
          marginTop: spacing.md,
        }}
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
