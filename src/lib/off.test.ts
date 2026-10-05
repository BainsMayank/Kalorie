import {
  isPlausible,
  mapOffNutriments,
  offProductUrl,
  offUserAgent,
  parseOffResponse,
} from './off';
import { emptyNutrients } from './nutrients';

// Real answers from Open Food Facts (saved 2026-09-27), trimmed to the fields Kalorie asks for.
import maggi from './testdata/off/maggi.json';
import notFound from './testdata/off/not-found.json';
import parleG from './testdata/off/parle-g.json';

describe('offProductUrl', () => {
  it('asks API v2 for one product with only the fields Kalorie uses', () => {
    const url = offProductUrl('8901058851298');
    expect(url).toMatch(
      /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8901058851298\.json\?fields=/,
    );
    expect(url).toContain('nutriments');
    expect(url).toContain('serving_quantity');
  });
});

describe('offUserAgent', () => {
  it('names the app, its version and a contact', () => {
    expect(offUserAgent('1.0.0', 'someone@example.com')).toBe(
      'Kalorie/1.0.0 (someone@example.com)',
    );
  });

  it('uses the app ID when there is no contact', () => {
    expect(offUserAgent('1.2.3', '')).toBe('Kalorie/1.2.3 (com.mynklabs.kalorie)');
    expect(offUserAgent('1.2.3')).toBe('Kalorie/1.2.3 (com.mynklabs.kalorie)');
  });
});

describe('parseOffResponse', () => {
  it('reads Maggi: name, first brand, pack and serving, nutrients per 100 g', () => {
    const result = parseOffResponse('8901058851298', 200, maggi);
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    const { product } = result;
    expect(product).toMatchObject({
      barcode: '8901058851298',
      name: 'Maggi 2-minutes Noodles',
      brand: 'Maggi',
      servingG: 70,
      packG: 70,
      isLiquid: false,
    });
    const n = product.nutrients;
    expect(n.energy_kcal).toBe(437);
    expect(n.protein_g).toBe(10.4);
    expect(n.carb_g).toBe(44.5);
    expect(n.fat_g).toBe(15.7);
    expect(n.fibre_g).toBe(3.9);
    expect(n.sugar_g).toBe(5);
    expect(n.sat_fat_g).toBe(6.8);
    expect(n.trans_fat_g).toBe(0.24);
    // Minerals are in grams in Open Food Facts: 1.2322 g sodium = 1232.2 mg.
    expect(n.sodium_mg).toBeCloseTo(1232.2, 1);
    expect(n.calcium_mg).toBeCloseTo(153.5, 1);
    expect(n.iron_mg).toBeCloseTo(3.7, 1);
    // Not on the label: unknown, not zero.
    expect(n.vit_c_mg).toBeNull();
    expect(n.cholesterol_mg).toBeNull();
  });

  it('reads Parle-G: serving but no pack size', () => {
    const result = parseOffResponse('8901719101038', 200, parleG);
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.product).toMatchObject({ name: 'Parle - G', brand: 'Parle', servingG: 56.4 });
    expect(result.product.packG).toBeNull();
    expect(result.product.nutrients.energy_kcal).toBeCloseTo(461, 0);
  });

  it('knows an unknown barcode (404 with status 0)', () => {
    expect(parseOffResponse('8901063010321', 404, notFound)).toEqual({ status: 'not_found' });
    expect(parseOffResponse('8901063010321', 200, { status: 0 })).toEqual({ status: 'not_found' });
  });

  it('sends a product with no nutrition numbers to the label form, keeping its name', () => {
    const result = parseOffResponse('8900000000001', 200, {
      status: 1,
      product: { product_name: 'Masala chips', brands: 'Local', nutriments: {} },
    });
    expect(result.status).toBe('no_nutrition');
    expect(result).toMatchObject({ product: { name: 'Masala chips', brand: 'Local' } });
  });

  it('spots drinks sold in ml or litres', () => {
    const milk = parseOffResponse('8901262150019', 200, {
      status: 1,
      product: {
        product_name: 'Toned milk',
        quantity: '500 ml',
        product_quantity: 500,
        product_quantity_unit: 'ml',
        nutriments: { 'energy-kcal_100g': 58, proteins_100g: 3, fat_100g: 3 },
      },
    });
    expect(milk).toMatchObject({ status: 'found', product: { isLiquid: true, packG: 500 } });

    const cola = parseOffResponse('5449000000996', 200, {
      status: 1,
      product: {
        product_name: 'Cola',
        quantity: '1 L',
        product_quantity: 1,
        product_quantity_unit: 'l',
        nutriments: { 'energy-kcal_100g': 42 },
      },
    });
    expect(cola).toMatchObject({ product: { isLiquid: true, packG: 1000 } });
  });

  it('throws on a server problem, so the lookup can wait and try again', () => {
    expect(() => parseOffResponse('8901058851298', 503, null)).toThrow();
    expect(() => parseOffResponse('8901058851298', 200, 'Service unavailable')).toThrow();
  });
});

describe('mapOffNutriments', () => {
  it('works out kcal from kJ when kcal is missing', () => {
    expect(mapOffNutriments({ energy_100g: 1828 }, null).energy_kcal).toBeCloseTo(436.9, 1);
    expect(mapOffNutriments({ 'energy-kj_100g': 418.4 }, null).energy_kcal).toBeCloseTo(100, 5);
  });

  it('works out kcal from protein, carbs and fat as a last resort', () => {
    const n = mapOffNutriments({ proteins_100g: 10, carbohydrates_100g: 50, fat_100g: 10 }, null);
    expect(n.energy_kcal).toBe(330);
  });

  it('gets sodium from salt when only salt is given', () => {
    expect(mapOffNutriments({ salt_100g: 2.5 }, null).sodium_mg).toBeCloseTo(1000);
  });

  it('scales per-serving values up to 100 g when there is no per-100 g value', () => {
    const n = mapOffNutriments({ 'energy-kcal_serving': 130, proteins_serving: 2 }, 25);
    expect(n.energy_kcal).toBe(520);
    expect(n.protein_g).toBe(8);
  });

  it('turns vitamins into mg and µg', () => {
    const n = mapOffNutriments(
      { 'vitamin-c_100g': 0.06, 'vitamin-d_100g': 0.000005, 'vitamin-b9_100g': 0.0002 },
      null,
    );
    expect(n.vit_c_mg).toBeCloseTo(60);
    expect(n.vit_d_ug).toBeCloseTo(5);
    expect(n.folate_ug).toBeCloseTo(200);
  });

  it('ignores negative numbers and text that is not a number', () => {
    const n = mapOffNutriments({ proteins_100g: -1, fat_100g: 'lots', fiber_100g: '2.5' }, null);
    expect(n.protein_g).toBeNull();
    expect(n.fat_g).toBeNull();
    expect(n.fibre_g).toBe(2.5);
  });
});

describe('isPlausible', () => {
  const values = (kcal: number | null, protein = 0, carb = 0, fat = 0) => ({
    ...emptyNutrients(),
    energy_kcal: kcal,
    protein_g: protein,
    carb_g: carb,
    fat_g: fat,
  });

  it('accepts real foods, including pure oil', () => {
    expect(isPlausible(values(437, 10.4, 44.5, 15.7))).toBe(true);
    expect(isPlausible(values(900, 0, 0, 100))).toBe(true);
  });

  it('refuses missing energy and impossible numbers', () => {
    expect(isPlausible(values(null))).toBe(false);
    expect(isPlausible(values(4370))).toBe(false); // kJ typed as kcal, or a slip
    expect(isPlausible(values(400, 60, 60, 20))).toBe(false); // 140 g in 100 g
  });
});
