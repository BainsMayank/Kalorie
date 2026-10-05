import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fromSharedFood,
  groupProblem,
  type FlagReason,
  type GroupFood,
  type GroupProblem,
  type SharedFoodUpload,
} from '@/lib/group';

import { getSupabase } from './client';

// Groups and shared foods online (Stage 11c; the tables and their rules are in
// supabase/migrations/20260928110000_groups.sql). Like auth.ts, every call answers
// { ok: true, value } or { ok: false, problem } and never throws, so a screen only picks a line.
// Row Level Security on the server decides what each call may see or change; nothing here is
// trusted to keep people apart.

export type GroupResult<T> = { ok: true; value: T } | { ok: false; problem: GroupProblem };

export interface GroupMember {
  userId: string;
  name: string;
}

export interface MyGroup {
  id: string;
  name: string;
  inviteCode: string;
  /** Everyone in the group, in the order they joined. */
  members: GroupMember[];
  /** The signed-in person's own id, to tell their foods and flags from others'. */
  myUserId: string;
}

/** A flag someone put on a shared food. */
export interface FoodFlag {
  userId: string;
  reason: FlagReason;
  note: string | null;
}

type Answer<T> = { data: T; error: unknown };

async function run<T, R = T>(
  action: (supabase: SupabaseClient) => PromiseLike<Answer<T>>,
  read: (data: T) => R = (data) => data as unknown as R,
): Promise<GroupResult<R>> {
  const supabase = getSupabase();
  if (supabase === null) return { ok: false, problem: 'other' };
  try {
    const { data, error } = await action(supabase);
    if (error) return { ok: false, problem: groupProblem(error) };
    return { ok: true, value: read(data) };
  } catch (error) {
    return { ok: false, problem: groupProblem(error) };
  }
}

/** The signed-in person's id, from the session kept on the phone (no network needed). */
async function myUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** The person's group with everyone in it, or `null` when they are in none. */
export async function fetchMyGroup(): Promise<GroupResult<MyGroup | null>> {
  const supabase = getSupabase();
  if (supabase === null) return { ok: false, problem: 'other' };
  try {
    const me = await myUserId(supabase);
    if (me === null) return { ok: false, problem: 'other' };
    // Row Level Security shows only the person's own group and its members.
    const group = await supabase.from('groups').select('id, name, invite_code').maybeSingle();
    if (group.error) return { ok: false, problem: groupProblem(group.error) };
    if (group.data === null) return { ok: true, value: null };
    const members = await supabase
      .from('group_members')
      .select('user_id, display_name')
      .order('joined_at');
    if (members.error) return { ok: false, problem: groupProblem(members.error) };
    return {
      ok: true,
      value: {
        id: group.data.id as string,
        name: group.data.name as string,
        inviteCode: group.data.invite_code as string,
        members: (members.data ?? []).map((m) => ({
          userId: m.user_id as string,
          name: m.display_name as string,
        })),
        myUserId: me,
      },
    };
  } catch (error) {
    return { ok: false, problem: groupProblem(error) };
  }
}

/** Starts a group; the person is its first member. */
export function createGroup(groupName: string, myName: string): Promise<GroupResult<string>> {
  return run((supabase) =>
    supabase.rpc('create_group', { group_name: groupName, member_name: myName }),
  );
}

/** Joins the group with this code. A code no group has is the problem `wrongCode`. */
export async function joinGroup(code: string, myName: string): Promise<GroupResult<string>> {
  const result = await run<string | null>((supabase) =>
    supabase.rpc('join_group', { code, member_name: myName }),
  );
  if (result.ok && result.value === null) return { ok: false, problem: 'wrongCode' };
  return result as GroupResult<string>;
}

/** Leaves the group. The person's shared foods and flags leave with them (the server does it). */
export function leaveGroup(): Promise<GroupResult<null>> {
  return run((supabase) => supabase.rpc('leave_group'));
}

/** A new invite code for the group; the old one stops working. */
export function makeNewInviteCode(): Promise<GroupResult<string>> {
  return run((supabase) => supabase.rpc('new_invite_code'));
}

/** Every food shared in the person's group (rows that can't be read are left out). */
export function fetchSharedFoods(): Promise<GroupResult<GroupFood[]>> {
  return run(
    (supabase) => supabase.from('shared_foods').select('*'),
    (rows: unknown[] | null) =>
      (rows ?? []).map(fromSharedFood).filter((food): food is GroupFood => food !== null),
  );
}

/** Adds or replaces the person's own foods in the group. */
export function sendSharedFoods(rows: readonly SharedFoodUpload[]): Promise<GroupResult<null>> {
  return run((supabase) => supabase.from('shared_foods').upsert([...rows], { onConflict: 'id' }));
}

/** Takes the person's own foods out of the group. */
export function removeSharedFoods(ids: readonly string[]): Promise<GroupResult<null>> {
  return run((supabase) =>
    supabase
      .from('shared_foods')
      .delete()
      .in('id', [...ids]),
  );
}

/** The flags on one shared food. */
export function fetchFlags(foodId: string): Promise<GroupResult<FoodFlag[]>> {
  return run(
    (supabase) =>
      supabase
        .from('shared_food_flags')
        .select('user_id, reason, note')
        .eq('shared_food_id', foodId)
        .order('created_at'),
    (rows: { user_id: string; reason: FlagReason; note: string | null }[] | null) =>
      (rows ?? []).map((r) => ({ userId: r.user_id, reason: r.reason, note: r.note })),
  );
}

/** Flags someone else's shared food as wrong (or changes the person's flag on it). */
export function flagFood(
  foodId: string,
  reason: FlagReason,
  note: string | null,
): Promise<GroupResult<null>> {
  return run((supabase) =>
    supabase
      .from('shared_food_flags')
      .upsert({ shared_food_id: foodId, reason, note }, { onConflict: 'shared_food_id,user_id' }),
  );
}

/** Takes back the person's own flag. */
export async function unflagFood(foodId: string): Promise<GroupResult<null>> {
  const supabase = getSupabase();
  const me = supabase ? await myUserId(supabase).catch(() => null) : null;
  if (me === null) return { ok: false, problem: 'other' };
  return run((client) =>
    client.from('shared_food_flags').delete().eq('shared_food_id', foodId).eq('user_id', me),
  );
}

/** Clears every flag on a food the person shared (*Mark as fixed*). */
export function clearFlags(foodId: string): Promise<GroupResult<null>> {
  return run((supabase) =>
    supabase.from('shared_food_flags').delete().eq('shared_food_id', foodId),
  );
}
