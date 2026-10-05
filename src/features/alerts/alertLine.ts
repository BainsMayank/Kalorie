import type { TFunction } from 'i18next';

import type { CrossedLimit } from '@/lib/alerts';
import { formatAmount } from '@/lib/format';

/**
 * One calm line per limit: "Fat is 12 g above today's limit." (SPEC §6, §7 wording rules.) With
 * hide numbers on (SPEC §8.3) it leaves the amount out: "Fat has reached today's limit."
 */
export function alertLine(t: TFunction, alert: CrossedLimit, hideNumbers = false): string {
  const nutrient = t(`alerts.names.${alert.key}`);
  const unit = t(`nutrientUnits.${alert.unit}`);
  const amount = formatAmount(alert.above);
  if (hideNumbers || amount === null || amount === '0') return t('alerts.reached', { nutrient });
  return t('alerts.above', { nutrient, amount, unit });
}
