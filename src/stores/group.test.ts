import * as cloud from '@/db/cloud/groups';
import { saveProduct } from '@/db/user/customFoods';
import { listGroupFoods, listShareStates } from '@/db/user/groupFoods';
import { emptyNutrients } from '@/lib/nutrients';

import { useGroupStore } from './group';
import { useMyFoodsStore } from './myFoods';

// The server is replaced: each test says what it answers. user.db is real (in memory).
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
jest.mock('@/db/cloud/groups', () => ({
  fetchMyGroup: jest.fn(),
  fetchSharedFoods: jest.fn(),
  sendSharedFoods: jest.fn(async () => ({ ok: true, value: null })),
  removeSharedFoods: jest.fn(async () => ({ ok: true, value: null })),
  createGroup: jest.fn(),
  joinGroup: jest.fn(),
  leaveGroup: jest.fn(async () => ({ ok: true, value: null })),
  makeNewInviteCode: jest.fn(),
}));
const server = jest.mocked(cloud);

const family: cloud.MyGroup = {
  id: 'group-1',
  name: 'Family',
  inviteCode: 'K7MQ2P',
  members: [
    { userId: 'me', name: 'Asha' },
    { userId: 'bela', name: 'Bela' },
  ],
  myUserId: 'me',
};

const shared = (id: string, createdBy: string, name: string) => ({
  id,
  createdBy,
  kind: 'recipe' as const,
  name,
  brand: null,
  barcode: null,
  servingG: null,
  densityGPerMl: 1,
  cookedWithFat: false,
  nutrients: { ...emptyNutrients(), energy_kcal: 100 },
  units: [],
  updatedAt: 1000,
});

let myFood: string;

beforeAll(async () => {
  myFood = await saveProduct({
    barcode: '8901234567894',
    name: 'Marie biscuits',
    brand: null,
    servingG: 20,
    densityGPerMl: 1,
    offStatus: 'found',
    offFetchedAt: 1,
    labelPhotoUri: null,
    nutrients: { ...emptyNutrients(), energy_kcal: 440 },
    units: [],
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  useGroupStore.setState({ status: 'unknown', group: null });
});

describe('group store', () => {
  it('downloads the group foods of others, not my own', async () => {
    server.fetchMyGroup.mockResolvedValue({ ok: true, value: family });
    server.fetchSharedFoods.mockResolvedValue({
      ok: true,
      value: [shared('food-b', 'bela', "Bela's poha"), shared(myFood, 'me', 'Marie biscuits')],
    });
    const before = useMyFoodsStore.getState().revision;

    await useGroupStore.getState().refresh();

    expect(useGroupStore.getState()).toMatchObject({ status: 'member', group: family });
    expect((await listGroupFoods()).map((f) => [f.name, f.addedBy])).toEqual([
      ["Bela's poha", 'Bela'],
    ]);
    expect(useMyFoodsStore.getState().revision).toBeGreaterThan(before);
  });

  it('sends a food when it is shared, and takes it out when unshared', async () => {
    useGroupStore.setState({ status: 'member', group: family });

    expect(await useGroupStore.getState().setShare(myFood, true)).toBe(true);
    expect(server.sendSharedFoods).toHaveBeenCalledWith([
      expect.objectContaining({ id: myFood, group_id: 'group-1', name: 'Marie biscuits' }),
    ]);

    // Nothing changed since: nothing more to send.
    expect(await useGroupStore.getState().sendPending()).toBe(true);
    expect(server.sendSharedFoods).toHaveBeenCalledTimes(1);

    expect(await useGroupStore.getState().setShare(myFood, false)).toBe(true);
    expect(server.removeSharedFoods).toHaveBeenCalledWith([myFood]);
    expect(await listShareStates()).toEqual([]);
  });

  it('keeps a change for later when the server can’t be reached', async () => {
    useGroupStore.setState({ status: 'member', group: family });
    server.sendSharedFoods.mockResolvedValueOnce({ ok: false, problem: 'offline' });

    expect(await useGroupStore.getState().setShare(myFood, true)).toBe(false);
    expect((await listShareStates())[0]).toMatchObject({ shareWithGroup: true, sharedAt: null });

    // Back online: the next refresh sends it.
    server.fetchMyGroup.mockResolvedValue({ ok: true, value: family });
    server.fetchSharedFoods.mockResolvedValue({ ok: true, value: [] });
    await useGroupStore.getState().refresh();
    expect(server.sendSharedFoods).toHaveBeenCalledTimes(2);
    expect((await listShareStates())[0].sharedAt).not.toBeNull();
  });

  it('shows the server as unreachable, keeping what the phone has', async () => {
    useGroupStore.setState({ status: 'member', group: family });
    server.fetchMyGroup.mockResolvedValue({ ok: false, problem: 'offline' });
    await useGroupStore.getState().refresh();
    expect(useGroupStore.getState()).toMatchObject({ status: 'unreachable', group: family });
  });

  it('leaving forgets the group foods and my sharing', async () => {
    useGroupStore.setState({ status: 'member', group: family });
    server.fetchSharedFoods.mockResolvedValue({
      ok: true,
      value: [shared('food-b', 'bela', "Bela's poha")],
    });
    server.fetchMyGroup.mockResolvedValue({ ok: true, value: family });
    await useGroupStore.getState().refresh();
    expect(await listGroupFoods()).toHaveLength(1);

    expect((await useGroupStore.getState().leave()).ok).toBe(true);
    expect(useGroupStore.getState()).toMatchObject({ status: 'none', group: null });
    expect(await listGroupFoods()).toEqual([]);
    expect(await listShareStates()).toEqual([]);
  });

  it('joining with a wrong code says so', async () => {
    server.joinGroup.mockResolvedValue({ ok: false, problem: 'wrongCode' });
    expect(await useGroupStore.getState().join('ZZZZZZ', 'Asha')).toEqual({
      ok: false,
      problem: 'wrongCode',
    });
    expect(server.fetchMyGroup).not.toHaveBeenCalled();
  });

  it('removed from the group on another phone: nothing of it stays here', async () => {
    server.fetchMyGroup.mockResolvedValue({ ok: true, value: family });
    server.fetchSharedFoods.mockResolvedValue({
      ok: true,
      value: [shared('food-b', 'bela', "Bela's poha")],
    });
    await useGroupStore.getState().refresh();
    expect(await listGroupFoods()).toHaveLength(1);

    server.fetchMyGroup.mockResolvedValue({ ok: true, value: null });
    await useGroupStore.getState().refresh();
    expect(useGroupStore.getState().status).toBe('none');
    expect(await listGroupFoods()).toEqual([]);
  });
});
