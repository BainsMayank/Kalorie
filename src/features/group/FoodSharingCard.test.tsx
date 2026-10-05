import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { clearFlags, fetchFlags, flagFood, unflagFood } from '@/db/cloud/groups';
import type { FoodDetail, FoodSharing } from '@/db/foods';
import { emptyNutrients } from '@/lib/nutrients';
import { useGroupStore } from '@/stores/group';

import { FoodSharingCard } from './FoodSharingCard';

// The server is replaced: each test says what it answers.
jest.mock('@/db/cloud/groups', () => ({
  fetchFlags: jest.fn(async () => ({ ok: true, value: [] })),
  flagFood: jest.fn(async () => ({ ok: true, value: null })),
  unflagFood: jest.fn(async () => ({ ok: true, value: null })),
  clearFlags: jest.fn(async () => ({ ok: true, value: null })),
}));

const family = {
  id: 'group-1',
  name: 'Family',
  inviteCode: 'K7MQ2P',
  members: [
    { userId: 'me', name: 'Mayank' },
    { userId: 'asha', name: 'Asha' },
    { userId: 'bela', name: 'Bela' },
  ],
  myUserId: 'me',
};

function food(sharing: FoodSharing | undefined): FoodDetail {
  return {
    foodSource: 'custom',
    foodId: 'food-1',
    name: "Mom's rajma",
    nameHi: null,
    brand: null,
    barcode: null,
    labelPhotoUri: null,
    offStatus: null,
    source: 'recipe',
    densityGPerMl: 1,
    defaultUnit: 'serving',
    defaultQty: 1,
    energyEstimated: false,
    nutrients: emptyNutrients(),
    oilStep: null,
    units: [{ unit: 'g', label: 'g', grams: 1, isDefault: true }],
    sharing,
  };
}

const setShare = jest.fn(async () => true);

beforeEach(() => {
  jest.clearAllMocks();
  useGroupStore.setState({ status: 'member', group: family, setShare });
});

describe('my own food', () => {
  it('shows nothing while I am in no group and it is not shared', async () => {
    useGroupStore.setState({ status: 'none', group: null });
    await render(
      <FoodSharingCard food={food({ kind: 'own', shareWithGroup: false, sharedAt: null })} />,
    );
    expect(screen.queryByText('Share with my group')).toBeNull();
  });

  it('shares it with my group', async () => {
    await render(
      <FoodSharingCard food={food({ kind: 'own', shareWithGroup: false, sharedAt: null })} />,
    );
    expect(screen.getByText(/Everyone in Family can find it/)).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('share-with-group'), 'valueChange', true);
    expect(setShare).toHaveBeenCalledWith('food-1', true);
  });

  it('says when the group doesn’t have it yet', async () => {
    await render(
      <FoodSharingCard food={food({ kind: 'own', shareWithGroup: true, sharedAt: null })} />,
    );
    expect(screen.getByText(/next time you're online/)).toBeOnTheScreen();
  });

  it('shows flags others put on it, and clears them once fixed', async () => {
    jest.mocked(fetchFlags).mockResolvedValueOnce({
      ok: true,
      value: [{ userId: 'bela', reason: 'kcal', note: 'Looks high' }],
    });
    await render(
      <FoodSharingCard food={food({ kind: 'own', shareWithGroup: true, sharedAt: 5 })} />,
    );
    expect(await screen.findByText('Bela: Calories')).toBeOnTheScreen();
    expect(screen.getByText('“Looks high”')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mark as fixed' }));
    expect(clearFlags).toHaveBeenCalledWith('food-1');
    expect(screen.queryByText('Bela: Calories')).toBeNull();
  });
});

describe("someone else's food", () => {
  const shared = food({ kind: 'group', addedBy: 'Asha' });

  it('says who shared it and that only they can change it', async () => {
    await render(<FoodSharingCard food={shared} />);
    expect(screen.getByText('Shared by Asha in your group')).toBeOnTheScreen();
    expect(screen.getByText(/Only the person who shared it/)).toBeOnTheScreen();
  });

  it('flags it as wrong, with a note', async () => {
    await render(<FoodSharingCard food={shared} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Something looks wrong?' }));

    // Nothing picked yet: Send waits.
    expect(screen.getByTestId('send-flag')).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Calories' }));
    await fireEvent.changeText(screen.getByLabelText('A note for Asha (optional)'), ' Too high ');
    jest.mocked(fetchFlags).mockResolvedValueOnce({
      ok: true,
      value: [{ userId: 'me', reason: 'kcal', note: 'Too high' }],
    });
    await fireEvent.press(screen.getByTestId('send-flag'));

    expect(flagFood).toHaveBeenCalledWith('food-1', 'kcal', 'Too high');
    expect(await screen.findByText('Thanks. Asha will see it.')).toBeOnTheScreen();
    expect(screen.getByText('1 person thinks something here is wrong.')).toBeOnTheScreen();
    expect(screen.getByText('You flagged this as wrong.')).toBeOnTheScreen();
  });

  it('takes my flag back', async () => {
    jest.mocked(fetchFlags).mockResolvedValueOnce({
      ok: true,
      value: [
        { userId: 'me', reason: 'name', note: null },
        { userId: 'bela', reason: 'kcal', note: null },
      ],
    });
    await render(<FoodSharingCard food={shared} />);
    expect(await screen.findByText('2 people think something here is wrong.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Take back my flag' }));
    expect(unflagFood).toHaveBeenCalledWith('food-1');
  });

  it('offers no flagging while the group can’t be reached', async () => {
    useGroupStore.setState({ status: 'unreachable' });
    await render(<FoodSharingCard food={shared} />);
    expect(screen.getByText('Shared by Asha in your group')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Something looks wrong?' })).toBeNull();
    expect(fetchFlags).not.toHaveBeenCalled();
  });
});
