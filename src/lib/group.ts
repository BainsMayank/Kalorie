// Groups and shared foods (Stage 11c, SPEC §4.3): reading what is typed on the My group screen,
// sorting server errors into a few kinds, turning a food into the row the group sees (and back),
// and working out which foods still need to reach the group.

import { accountProblem } from './account';
import { NUTRIENT_KEYS, emptyNutrients, type NutrientValues } from './nutrients';

// --- Invite codes and names --------------------------------------------------------------------

/** The characters a code is made of: no 0 O 1 I L, which are easy to mix up (same as the server). */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

/**
 * The invite code typed or pasted, in capitals without spaces or dashes ("k7m q2p" → "K7MQ2P"),
 * or `null` if it can't be a code.
 */
export function readInviteCode(text: string): string | null {
  const code = text.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== INVITE_CODE_LENGTH) return null;
  return [...code].every((c) => INVITE_ALPHABET.includes(c)) ? code : null;
}

/** "K7MQ2P" → "K7M Q2P": easier to read out and copy by eye. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Longest group name and name-in-the-group (the server checks the same). */
export const GROUP_NAME_MAX = 40;
export const MEMBER_NAME_MAX = 30;

/** A name typed in, with extra spaces removed; `null` if empty or longer than `max`. */
export function readName(text: string, max: number): string | null {
  const name = text.trim().replace(/\s+/g, ' ');
  return name === '' || name.length > max ? null : name;
}

// --- Problems ----------------------------------------------------------------------------------

/** What went wrong with a group action — each has its own line in en.json (`group.problems`). */
export type GroupProblem =
  'offline' | 'wrongCode' | 'alreadyInGroup' | 'tooManyTries' | 'full' | 'notInGroup' | 'other';

/** The server's own codes (supabase/migrations/20260928110000_groups.sql, step 5). */
const SERVER_CODES: Record<string, GroupProblem> = {
  KG001: 'alreadyInGroup',
  KG002: 'tooManyTries',
  KG003: 'full',
  KG004: 'notInGroup',
};

/** Sorts an error from supabase-js into a {@link GroupProblem}. */
export function groupProblem(error: unknown): GroupProblem {
  const { code } = (error ?? {}) as { code?: unknown };
  if (typeof code === 'string' && code in SERVER_CODES) return SERVER_CODES[code];
  return accountProblem(error) === 'offline' ? 'offline' : 'other';
}

// --- Shared foods ------------------------------------------------------------------------------

export type SharedFoodKind = 'custom' | 'product' | 'recipe';

/** A unit of a shared food, as stored online (snake_case, like the database). */
export interface SharedUnit {
  unit: string;
  label: string;
  grams: number;
  is_default: boolean;
}

/** A row of `shared_foods` as the app sends it (the server adds the times and `created_by`). */
export interface SharedFoodUpload {
  id: string;
  group_id: string;
  kind: SharedFoodKind;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_g: number | null;
  density_g_per_ml: number;
  cooked_with_fat: boolean;
  /** Per 100 g; every nutrient is there, `null` = unknown (never 0 for unknown). */
  nutrients: NutrientValues;
  units: SharedUnit[];
}

/** One of the person's own foods, with what the group needs of it. */
export interface OwnFood {
  id: string;
  kind: SharedFoodKind;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingG: number | null;
  densityGPerMl: number;
  cookedWithFat: boolean;
  nutrients: NutrientValues;
  units: readonly { unit: string; label: string; grams: number; isDefault: boolean }[];
}

/** The row the group sees for one of the person's foods. Label photos stay on the phone. */
export function toSharedFood(food: OwnFood, groupId: string): SharedFoodUpload {
  return {
    id: food.id,
    group_id: groupId,
    kind: food.kind,
    name: food.name.slice(0, 120),
    brand: food.brand?.slice(0, 120) || null,
    barcode: food.barcode,
    serving_g: food.servingG,
    density_g_per_ml: food.densityGPerMl,
    cooked_with_fat: food.cookedWithFat,
    nutrients: { ...food.nutrients },
    units: food.units
      .slice(0, 20)
      .map((u) => ({ unit: u.unit, label: u.label, grams: u.grams, is_default: u.isDefault })),
  };
}

/** A food someone else in the group shared, ready to keep on this phone as a group food. */
export interface GroupFood {
  id: string;
  createdBy: string;
  kind: SharedFoodKind;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingG: number | null;
  densityGPerMl: number;
  cookedWithFat: boolean;
  nutrients: NutrientValues;
  units: { unit: string; label: string; grams: number; isDefault: boolean }[];
  /** When it was last changed, from the server's clock (epoch ms). */
  updatedAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null;
/** A number that makes sense as an amount: finite, not below 0, not absurd. */
const amount = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;

/** Biggest believable value per 100 g, so a typo can't make one food count for a whole year. */
const MAX_PER_100G = 100_000;
const MAX_UNIT_GRAMS = 10_000;

/**
 * Reads a `shared_foods` row that came from the server, checking every field: it was typed by
 * someone else, possibly on an older or newer app. Unknown nutrients stay unknown; anything that
 * isn't a sensible number becomes unknown too. Returns `null` for a row that can't be used.
 */
export function fromSharedFood(row: unknown): GroupFood | null {
  if (!isRecord(row)) return null;
  const id = text(row.id, 64);
  const createdBy = text(row.created_by, 64);
  const name = text(row.name, 120);
  const kind = row.kind;
  const updatedAt = typeof row.updated_at === 'string' ? Date.parse(row.updated_at) : NaN;
  if (!id || !createdBy || !name || Number.isNaN(updatedAt)) return null;
  if (kind !== 'custom' && kind !== 'product' && kind !== 'recipe') return null;

  const nutrients = emptyNutrients();
  if (isRecord(row.nutrients)) {
    for (const key of NUTRIENT_KEYS) nutrients[key] = amount(row.nutrients[key], MAX_PER_100G);
  }

  const units: GroupFood['units'] = [];
  for (const u of Array.isArray(row.units) ? row.units.slice(0, 20) : []) {
    if (!isRecord(u)) continue;
    const unit = text(u.unit, 40);
    const label = text(u.label, 40);
    const grams = amount(u.grams, MAX_UNIT_GRAMS);
    // `g` is always added by the app itself; a second one would show twice.
    if (!unit || !label || !grams || unit === 'g' || units.some((x) => x.unit === unit)) continue;
    units.push({ unit, label, grams, isDefault: u.is_default === true });
  }
  // At most one default unit: the first one marked.
  const firstDefault = units.findIndex((u) => u.isDefault);
  units.forEach((u, i) => (u.isDefault = i === firstDefault));

  const barcode =
    typeof row.barcode === 'string' && /^\d{8,14}$/.test(row.barcode) ? row.barcode : null;
  return {
    id,
    createdBy,
    kind,
    name,
    brand: text(row.brand, 120),
    barcode,
    servingG: amount(row.serving_g, MAX_UNIT_GRAMS) || null,
    densityGPerMl: amount(row.density_g_per_ml, 10) || 1,
    cookedWithFat: row.cooked_with_fat === true,
    nutrients,
    units,
    updatedAt,
  };
}

/** What the phone knows about one of the person's own foods, for {@link planShareUploads}. */
export interface ShareState {
  id: string;
  shareWithGroup: boolean;
  /** `updated_at` of the version the group has; null = the group doesn't have it. */
  sharedAt: number | null;
  updatedAt: number;
  deletedAt: number | null;
}

/**
 * Which of the person's own foods must be sent to the group (shared and changed since the group
 * last got it) and which must be taken out (no longer shared, or deleted, but the group still has
 * it). Everything else is already right. Works offline: whatever doesn't go through stays in the
 * plan for next time.
 */
export function planShareUploads(foods: readonly ShareState[]): {
  send: string[];
  remove: string[];
} {
  const send: string[] = [];
  const remove: string[] = [];
  for (const food of foods) {
    const wanted = food.shareWithGroup && food.deletedAt === null;
    if (wanted && (food.sharedAt === null || food.updatedAt > food.sharedAt)) send.push(food.id);
    else if (!wanted && food.sharedAt !== null) remove.push(food.id);
  }
  return { send, remove };
}

// --- Flags -------------------------------------------------------------------------------------

/** Why someone thinks a shared food is wrong. */
export const FLAG_REASONS = ['kcal', 'nutrients', 'name', 'other'] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
export const FLAG_NOTE_MAX = 200;
