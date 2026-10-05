import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getFoodDetail, searchFoods, type FoodDetail } from '@/db/foods';
import { openFoodsDbForTests } from '@/db/foods/testing';
import { getCustomFoodDetail, getRecipe, listCustomFoods } from '@/db/user/customFoods';
import { recipePerServing } from '@/lib/recipe';
import { useRecipeDraftStore } from '@/stores/recipeDraft';

import { draftAmounts, newDraftItem } from './draft';
import { IngredientPickerScreen } from './IngredientPickerScreen';
import { RecipeBuilderScreen } from './RecipeBuilderScreen';

// Foods come from the real foods.db; user.db is a fresh in-memory database.
jest.mock('@/db/foods/client', () => {
  const { openFoodsDbForTests: open } = jest.requireActual('@/db/foods/testing');
  const db = open();
  return { getFoodsDb: async () => db };
});
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));
let mockParams: { id?: string; copy?: string } = {};
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

const foodsDb = openFoodsDbForTests();
afterAll(() => foodsDb.close());

async function food(query: string): Promise<FoodDetail> {
  const [first] = await searchFoods(foodsDb, query);
  return (await getFoodDetail(foodsDb, first.id))!;
}

let rajma: FoodDetail;
let oil: FoodDetail;
beforeAll(async () => {
  rajma = await food('rajma');
  oil = await food('sunflower oil');
});
beforeEach(() => {
  mockParams = {};
  mockBack.mockClear();
  mockPush.mockClear();
});

const kcalText = (kcal: number) => `${Math.round(kcal).toLocaleString('en-US')} kcal`;

async function renderBuilder() {
  await render(<RecipeBuilderScreen />);
  await act(async () => {}); // let a saved recipe load
}

describe('Recipe builder — a new recipe', () => {
  it('asks for a name, servings and an ingredient before saving', async () => {
    await renderBuilder();
    expect(screen.getByText(/Add a name, the servings and at least one ingredient/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));
    expect(mockPush).toHaveBeenCalledWith('/recipe-ingredient');
  });

  it('works out per serving and per 100 g cooked, and saves it as a food', async () => {
    await renderBuilder();
    await fireEvent.changeText(screen.getByLabelText('Name'), "Mom's rajma");
    await fireEvent.changeText(screen.getByLabelText('Servings'), '4');
    await fireEvent.changeText(screen.getByLabelText('Cooked weight (optional), g'), '900');
    await act(async () => {
      const { addItem } = useRecipeDraftStore.getState();
      addItem(newDraftItem({ food: rajma, qty: 200, unit: 'g', grams: 200, isFat: false }));
      addItem(newDraftItem({ food: oil, qty: 1, unit: 'tbsp', grams: 15, isFat: true }));
    });

    const perServing = recipePerServing(draftAmounts(useRecipeDraftStore.getState().draft));
    expect(screen.getByText(kcalText(perServing.energy_kcal!))).toBeOnTheScreen();
    expect(screen.getByText('One serving ≈ 225 g')).toBeOnTheScreen();
    expect(screen.getByText('Per 100 g cooked')).toBeOnTheScreen();
    expect(screen.getByText(/^1 katori \(150 g\) ≈ \d+ kcal$/)).toBeOnTheScreen();
    expect(screen.getByText('Oil/ghee')).toBeOnTheScreen(); // the oil is flagged

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
    expect(mockBack).toHaveBeenCalled();

    const [saved] = await listCustomFoods('recipe');
    const detail = (await getCustomFoodDetail(saved.id))!;
    expect(detail.name).toBe("Mom's rajma");
    expect(detail.units.map((u) => [u.unit, u.grams])).toEqual([
      ['serving', 225],
      ['katori', 150],
      ['g', 1],
    ]);
    // 1 serving from the saved food = the builder's per serving
    expect((detail.nutrients.energy_kcal! * 225) / 100).toBeCloseTo(perServing.energy_kcal!);
    expect(detail.oilStep).not.toBeNull();
  });

  it('shows per 100 g of the raw weight, and no katori, without a cooked weight', async () => {
    await renderBuilder();
    await act(async () => {
      useRecipeDraftStore
        .getState()
        .addItem(newDraftItem({ food: rajma, qty: 100, unit: 'g', grams: 100, isFat: false }));
    });
    expect(screen.getByText('Per 100 g (raw weight)')).toBeOnTheScreen();
    expect(screen.getByText('Add the cooked weight to log this by the katori.')).toBeOnTheScreen();
  });
});

describe('Recipe builder — edit and duplicate', () => {
  it('opens a saved recipe to edit, and saving keeps its id', async () => {
    const [saved] = await listCustomFoods('recipe');
    mockParams = { id: saved.id };
    await renderBuilder();

    expect(screen.getByLabelText('Name')).toHaveDisplayValue("Mom's rajma");
    expect(screen.getByLabelText('Servings')).toHaveDisplayValue('4');
    expect(screen.getByText(/Changes also update the days/)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Servings'), '6');
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(await listCustomFoods('recipe')).toHaveLength(1);
    expect((await getRecipe(saved.id))?.servings).toBe(6);
  });

  it('duplicates a recipe as a new one, "(copy)"', async () => {
    const [saved] = await listCustomFoods('recipe');
    mockParams = { copy: saved.id };
    await renderBuilder();

    expect(screen.getByLabelText('Name')).toHaveDisplayValue("Mom's rajma (copy)");
    expect(screen.queryByText(/Changes also update the days/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    const recipes = await listCustomFoods('recipe');
    expect(recipes.map((r) => r.name)).toEqual(["Mom's rajma", "Mom's rajma (copy)"]);
    const copy = (await getRecipe(recipes[1].id))!;
    expect(copy.items.map((i) => [i.name, i.grams, i.isFat])).toEqual([
      [rajma.name, 200, false],
      [oil.name, 15, true],
    ]);
  });

  it('opens an ingredient to change its amount', async () => {
    const [saved] = await listCustomFoods('recipe');
    mockParams = { id: saved.id };
    await renderBuilder();

    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${oil.name}, `) }));
    await fireEvent.press(screen.getByRole('radio', { name: 'g' }));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '10');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    const items = useRecipeDraftStore.getState().draft.items;
    expect(items.map((i) => i.grams)).toEqual([200, 10]);
  });
});

describe('Add ingredient', () => {
  it('searches, picks an amount and adds it to the recipe; oil is flagged by itself', async () => {
    jest.useFakeTimers();
    useRecipeDraftStore.getState().start({
      id: null,
      name: '',
      servingsText: '',
      cookedWeightText: '',
      items: [],
    });
    await render(<IngredientPickerScreen />);
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'sunflower oil');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    await fireEvent.press(screen.getAllByRole('button', { name: new RegExp(`^${oil.name},`) })[0]);
    await act(async () => {});

    expect(screen.getByRole('switch', { name: 'Oil or ghee' })).toHaveProp('value', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Add to recipe' }));

    const [item] = useRecipeDraftStore.getState().draft.items;
    expect(item).toMatchObject({ isFat: true });
    expect(item.food.name).toBe(oil.name);
    expect(mockBack).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
