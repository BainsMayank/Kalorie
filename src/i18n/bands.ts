// Hide-numbers mode (SPEC §8.3): a share of a target, need or limit as words.

import type { TFunction } from 'i18next';

import { shareBand } from '@/lib/bands';

/**
 * "Nearly there", "Around your target", "A bit more than planned"… The last two bands depend on
 * what the share is of: a target (calories, macros), a daily need (vitamins, minerals) or a limit
 * (sodium, sugar, saturated fat).
 */
export function bandText(t: TFunction, share: number, of: 'target' | 'need' | 'limit'): string {
  const band = shareBand(share);
  return band === 'around' || band === 'more' ? t(`bands.${of}.${band}`) : t(`bands.${band}`);
}
