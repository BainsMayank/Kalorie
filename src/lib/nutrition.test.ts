import { emptyNutrients } from './nutrients';
import { nutrientsForGrams } from './nutrition';

describe('nutrientsForGrams', () => {
  const dal = { ...emptyNutrients(), energy_kcal: 62, protein_g: 3.2, iron_mg: 0.9 };

  it('scales per-100 g values to the portion (1 katori dal = 150 g)', () => {
    const katori = nutrientsForGrams(dal, 150);
    expect(katori.energy_kcal).toBeCloseTo(93);
    expect(katori.protein_g).toBeCloseTo(4.8);
    expect(katori.iron_mg).toBeCloseTo(1.35);
  });

  it('keeps unknown nutrients unknown, not zero', () => {
    expect(nutrientsForGrams(dal, 150).vit_c_mg).toBeNull();
  });

  it('gives zero for zero grams', () => {
    expect(nutrientsForGrams(dal, 0).energy_kcal).toBe(0);
  });
});
