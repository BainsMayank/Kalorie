import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { queueBarcode, listBarcodeQueue } from '@/db/user/barcodeQueue';
import { findProductByBarcode, getCustomFoodDetail } from '@/db/user/customFoods';
import { useBarcodeQueueStore } from '@/stores/barcodeQueue';

import { LabelFormScreen } from './LabelFormScreen';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
let mockParams: Record<string, string> = {};
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('./labelPhoto', () => ({ keepLabelPhoto: jest.fn() }));

const BARCODE = '8901234567894';

beforeEach(() => {
  mockReplace.mockClear();
  mockParams = { barcode: BARCODE, reason: 'not_found', slot: 'snacks', day: '2026-09-27' };
});

const type = async (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

describe('Add from label', () => {
  it('asks for a name, the energy, and the serving size when values are per serving', async () => {
    await render(<LabelFormScreen />);
    expect(screen.getByText(/isn't in Open Food Facts yet/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'One serving' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Add a name.')).toBeOnTheScreen();
    expect(screen.getByText('Add the energy (kcal).')).toBeOnTheScreen();
    expect(screen.getByText('Add the serving size in grams.')).toBeOnTheScreen();
    expect(await findProductByBarcode(BARCODE)).toBeNull();
  });

  it('saves per-serving label values as per 100 g, with serving and pack units', async () => {
    await queueBarcode({ barcode: BARCODE, day: '2026-09-27', slotId: 'snacks' });
    await useBarcodeQueueStore.getState().load();
    await render(<LabelFormScreen />);

    await type('Name', 'Masala peanuts');
    await fireEvent.press(screen.getByRole('radio', { name: 'One serving' }));
    await type('Serving size, g', '30');
    await type('Pack size (optional), g', '150');
    await type('Energy, kcal', '168');
    await type('Protein, g', '6.6');
    await type('Total fat, g', '13.2');
    await type('Sodium, mg', '120');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    });

    const saved = (await findProductByBarcode(BARCODE))!;
    expect(saved).toMatchObject({ name: 'Masala peanuts', offStatus: 'user_added', servingG: 30 });
    const food = (await getCustomFoodDetail(saved.id))!;
    expect(food.nutrients.energy_kcal).toBeCloseTo(560); // 168 × 100 / 30
    expect(food.nutrients.protein_g).toBeCloseTo(22);
    expect(food.nutrients.fat_g).toBeCloseTo(44);
    expect(food.nutrients.sodium_mg).toBeCloseTo(400);
    expect(food.nutrients.carb_g).toBeNull(); // left empty: unknown, not zero
    expect(food.units.map((u) => [u.unit, u.grams])).toEqual([
      ['serving', 30],
      ['pack', 150],
      ['g', 1],
    ]);

    // Off the pending list, and on to the product to log it to the day and meal it was scanned for.
    expect(await listBarcodeQueue()).toEqual([]);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/food/[id]',
      params: { id: saved.id, source: 'custom', slot: 'snacks', day: '2026-09-27' },
    });
  });

  it('fills in the name Open Food Facts already knows', async () => {
    mockParams = { barcode: '8900000000017', reason: 'no_nutrition', name: 'Masala chips' };
    await render(<LabelFormScreen />);
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Masala chips');
    expect(screen.getByText(/knows this packet but not its nutrition/)).toBeOnTheScreen();
  });
});
