// Temporary targets for the Today screen, used until goals exist (Stage 5 — onboarding and
// goals — replaces them with the `targets` row in effect for the day). Change them only here.

import type { DayTargets } from './nutrition';

export const PLACEHOLDER_TARGETS: DayTargets = {
  kcal: 2000,
  protein_g: 60,
  carb_g: 250,
  fat_g: 65,
};
