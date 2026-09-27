import { FoodSearchScreen } from '@/features/foods/FoodSearchScreen';

// Stage 2b: the Log tab shows food search so it can be tried on the phone. Stage 8 replaces it
// with the meal timeline and calendar (SPEC §2.10); search then moves into the Add food modal.
export function LogScreen() {
  return <FoodSearchScreen />;
}
