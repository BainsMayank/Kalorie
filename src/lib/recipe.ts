// Recipes the person builds from ingredients (SPEC §2.9): totals, per serving, per 100 g, and
// the units a recipe can be logged in. A recipe is saved as a food with per-100 g values, like
// every other food, so logging it works the same way.

import { emptyNutrients, NUTRIENT_KEYS, type NutrientValues } from './nutrients';
import { nutrientsForGrams, sumNutrients } from './nutrition';
import { recipeOilStep, type OilStep } from './oil';
import { normalizeText } from './search';
import { UNIT_DEFAULTS } from './units';

const FAT_WORDS = /\b(oil|oils|ghee|butter|vanaspati|margarine|dalda)\b/;
const NOT_FAT_WORDS =
  /\b(peanut butter|butter ?milk|cocoa butter|butter beans|almond butter|oil seeds?)\b/;

/**
 * Is this ingredient a cooking fat (oil, ghee, butter, vanaspati, margarine)? These are what the
 * Less / Normal / More oil control scales (SPEC §5.5). `category` is the food's foods.db
 * category when known (`oil_fat` for INDB's fats group).
 */
export function isFatIngredient(name: string, category?: string): boolean {
  const text = normalizeText(name);
  if (NOT_FAT_WORDS.test(text)) return false;
  return category === 'oil_fat' || FAT_WORDS.test(text);
}

/** One ingredient: how much goes in, and its nutrients per 100 g (`null` = food not found). */
export interface RecipeIngredient {
  grams: number;
  nutrients: NutrientValues | null;
  /** Oil, ghee, butter…: scaled by the oil control. */
  isFat: boolean;
}

/** Everything a recipe's numbers are worked out from. */
export interface RecipeAmounts {
  ingredients: readonly RecipeIngredient[];
  /** How many servings the whole pot makes. */
  servings: number;
  /** The whole pot weighed after cooking, in grams; `null` = not weighed. */
  cookedWeightG: number | null;
}

/** Grams of all ingredients as they went in (raw). */
export function rawWeightG(ingredients: readonly RecipeIngredient[]): number {
  return ingredients.reduce((sum, i) => sum + Math.max(0, i.grams), 0);
}

/**
 * The weight the recipe's per-100 g values refer to: the cooked weight when it was weighed
 * (water boils off, rice and dal soak it up), else the raw ingredients' weight.
 */
export function recipeYieldG(recipe: RecipeAmounts): number {
  const cooked = recipe.cookedWeightG;
  return cooked !== null && cooked > 0 ? cooked : rawWeightG(recipe.ingredients);
}

/**
 * Nutrients in the whole pot: the sum over the ingredients (grams / 100 × per 100 g). A nutrient
 * unknown for one ingredient is left out of the sum; it is unknown only if no ingredient has it.
 */
export function recipeTotals(ingredients: readonly RecipeIngredient[]): NutrientValues {
  return sumNutrients(
    ingredients.map((i) =>
      i.nutrients ? nutrientsForGrams(i.nutrients, Math.max(0, i.grams)) : emptyNutrients(),
    ),
  );
}

function divide(values: NutrientValues, by: number): NutrientValues {
  const result = {} as NutrientValues;
  for (const key of NUTRIENT_KEYS) {
    const value = values[key];
    result[key] = value === null || by <= 0 ? null : value / by;
  }
  return result;
}

/** Nutrients per 100 g of the dish (cooked, if it was weighed). All unknown for an empty pot. */
export function recipePer100g(recipe: RecipeAmounts): NutrientValues {
  return divide(recipeTotals(recipe.ingredients), recipeYieldG(recipe) / 100);
}

/** Nutrients in one serving: the whole pot ÷ servings. */
export function recipePerServing(recipe: RecipeAmounts): NutrientValues {
  return divide(recipeTotals(recipe.ingredients), recipe.servings);
}

/** Grams in one serving: the pot's weight ÷ servings (0 if there are no servings). */
export function servingWeightG(recipe: RecipeAmounts): number {
  return recipe.servings > 0 ? recipeYieldG(recipe) / recipe.servings : 0;
}

/** A unit a recipe can be logged in, as saved in `custom_food_units`. */
export interface RecipeUnit {
  unit: string;
  label: string;
  grams: number;
  isDefault: boolean;
}

const KATORI = UNIT_DEFAULTS.find((u) => u.unit === 'katori')!;

/**
 * Units for logging a recipe: *serving* (the default), and *katori* once the pot was weighed
 * after cooking — a katori is 150 g of the cooked dish, which the raw weight can't tell. Grams
 * are always offered on top (by the food screen).
 */
export function recipeUnits(recipe: RecipeAmounts, servingLabel: string): RecipeUnit[] {
  const units: RecipeUnit[] = [];
  const serving = servingWeightG(recipe);
  if (serving > 0) {
    units.push({ unit: 'serving', label: servingLabel, grams: serving, isDefault: true });
  }
  if (recipe.cookedWeightG !== null && recipe.cookedWeightG > 0) {
    // Recipes are taken as 1 g per ml, like foods.db's dishes without a known density.
    units.push({ unit: 'katori', label: KATORI.label, grams: KATORI.ml, isDefault: false });
  }
  return units;
}

/** The oil control's step for this recipe (SPEC §5.5), or `null` if it has no oil or ghee. */
export function recipeOilStepFor(recipe: RecipeAmounts): OilStep | null {
  return recipeOilStep(
    recipe.ingredients
      .filter((i) => i.isFat && i.nutrients !== null)
      .map((i) => ({ grams: Math.max(0, i.grams), nutrients: i.nutrients! })),
    recipeYieldG(recipe),
  );
}
