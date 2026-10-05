import { create } from 'zustand';

import {
  createGroup,
  fetchMyGroup,
  fetchSharedFoods,
  joinGroup,
  leaveGroup,
  makeNewInviteCode,
  removeSharedFoods,
  sendSharedFoods,
  type GroupResult,
  type MyGroup,
} from '@/db/cloud/groups';
import {
  getOwnFoodsForSharing,
  listShareStates,
  markShared,
  removeGroupFoods,
  resetOwnSharing,
  saveGroupFoods,
  setShareWithGroup,
} from '@/db/user/groupFoods';
import { planShareUploads, toSharedFood, type GroupProblem } from '@/lib/group';

import { useLogStore } from './log';
import { useMyFoodsStore } from './myFoods';

// The person's group (Stage 11c). The server is the source of truth for who is in the group;
// user.db keeps the group's foods so search and logging work offline. `refresh` brings the two
// in step: it sends the person's own shared foods that changed, then downloads the group's.

export type GroupStatus =
  /** Not asked yet, or not signed in. */
  | 'unknown'
  | 'loading'
  /** Signed in, in no group. */
  | 'none'
  | 'member'
  /** The server couldn't be reached; `group` is the last one known, if any. */
  | 'unreachable';

type GroupState = {
  status: GroupStatus;
  group: MyGroup | null;
  /** Asks the server for the group, sends pending shares and downloads the group's foods. */
  refresh: () => Promise<void>;
  /** Sends the person's own foods that changed since the group last got them. */
  sendPending: () => Promise<boolean>;
  start: (groupName: string, myName: string) => Promise<GroupResult<null>>;
  join: (code: string, myName: string) => Promise<GroupResult<null>>;
  leave: () => Promise<GroupResult<null>>;
  newCode: () => Promise<GroupResult<null>>;
  /**
   * Turns *Share with my group* on or off for one of the person's foods, then tries to send it.
   * Answers whether the group has the change already (false = it goes when next online).
   */
  setShare: (foodId: string, on: boolean) => Promise<boolean>;
  /**
   * Forgets the group on this phone: its foods leave search (days they were logged on keep their
   * numbers). `ownShares`: the person's own foods are no longer shared either (they left the group
   * or deleted their account, so the server already removed them).
   */
  forget: (ownShares: boolean) => Promise<void>;
};

/** Search, the food screen and the Add food lists read their foods again. */
function foodsChanged() {
  useMyFoodsStore.setState((state) => ({ revision: state.revision + 1 }));
  useLogStore.setState((state) => ({ revision: state.revision + 1 }));
}

const fail = (problem: GroupProblem) => ({ ok: false, problem }) as const;

let refreshing: Promise<void> | null = null;

export const useGroupStore = create<GroupState>()((set, get) => {
  /** Downloads the group's foods (everyone's but the person's own) into user.db. */
  const downloadFoods = async (group: MyGroup): Promise<void> => {
    const foods = await fetchSharedFoods();
    if (!foods.ok) return;
    const names = new Map(group.members.map((m) => [m.userId, m.name]));
    const others = foods.value.filter((food) => food.createdBy !== group.myUserId);
    if (await saveGroupFoods(others, names)) foodsChanged();
  };

  /** After starting or joining a group: read it, and bring the foods in step. */
  const joined = async (): Promise<GroupResult<null>> => {
    await get().refresh();
    return get().status === 'member' ? { ok: true, value: null } : fail('offline');
  };

  return {
    status: 'unknown',
    group: null,

    refresh: () => {
      // One at a time: a second call while one runs waits for the same one.
      refreshing ??= (async () => {
        if (get().group === null) set({ status: 'loading' });
        const found = await fetchMyGroup();
        if (!found.ok) {
          set({ status: 'unreachable' });
          return;
        }
        if (found.value === null) {
          // Not in a group (maybe left on another phone): nothing of the group stays here.
          const hadGroup = get().group !== null;
          set({ status: 'none', group: null });
          if ((await removeGroupFoods()) || hadGroup) foodsChanged();
          await resetOwnSharing();
          return;
        }
        set({ status: 'member', group: found.value });
        await get().sendPending();
        await downloadFoods(found.value);
      })()
        .catch(() => set({ status: 'unreachable' }))
        .finally(() => {
          refreshing = null;
        });
      return refreshing;
    },

    sendPending: async () => {
      const group = get().group;
      if (get().status !== 'member' || group === null) return false;
      const states = await listShareStates();
      const { send, remove } = planShareUploads(states);
      const versions = new Map(states.map((s) => [s.id, s.updatedAt]));
      let allSent = true;
      if (send.length > 0) {
        const foods = await getOwnFoodsForSharing(send);
        const result = await sendSharedFoods(foods.map((food) => toSharedFood(food, group.id)));
        if (result.ok) for (const id of send) await markShared(id, versions.get(id)!);
        else allSent = false;
      }
      if (remove.length > 0) {
        const result = await removeSharedFoods(remove);
        if (result.ok) for (const id of remove) await markShared(id, null);
        else allSent = false;
      }
      if (send.length > 0 || remove.length > 0) foodsChanged();
      return allSent;
    },

    start: async (groupName, myName) => {
      const result = await createGroup(groupName, myName);
      return result.ok ? joined() : result;
    },

    join: async (code, myName) => {
      const result = await joinGroup(code, myName);
      return result.ok ? joined() : result;
    },

    leave: async () => {
      const result = await leaveGroup();
      if (!result.ok) return result;
      await get().forget(true);
      set({ status: 'none' });
      return result;
    },

    newCode: async () => {
      const result = await makeNewInviteCode();
      if (!result.ok) return result;
      const group = get().group;
      if (group) set({ group: { ...group, inviteCode: result.value } });
      return { ok: true, value: null };
    },

    setShare: async (foodId, on) => {
      await setShareWithGroup(foodId, on);
      foodsChanged();
      try {
        return await get().sendPending();
      } catch {
        return false;
      }
    },

    forget: async (ownShares) => {
      set({ status: 'unknown', group: null });
      const removed = await removeGroupFoods();
      if (ownShares) await resetOwnSharing();
      if (removed || ownShares) foodsChanged();
    },
  };
});
