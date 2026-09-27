// Days, times and meal slots (SPEC §5.8).
//
// A "logical day" starts at 4:00 am, so a snack at 1 am still belongs to the evening before.
// Days are written as 'YYYY-MM-DD' text. Times of day are "clock minutes": minutes after
// midnight on the phone's clock (0–1439), e.g. 13:30 → 810.

/** The day starts at 4:00 am. */
export const DAY_START_MIN = 4 * 60;

const MIN_PER_DAY = 24 * 60;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A local calendar date → 'YYYY-MM-DD'. */
function dateToDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' → year, month (1–12) and day of month. */
export function parseDay(day: string): { year: number; month: number; date: number } {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, date };
}

/** The logical day a moment belongs to: the calendar date of (time − 4 hours). */
export function logicalDay(timeMs: number): string {
  const date = new Date(timeMs);
  // Step back 4 hours on the clock (not in milliseconds), so clock changes can't shift it.
  date.setHours(date.getHours() - DAY_START_MIN / 60);
  return dateToDay(date);
}

/** The day `n` days after `day` (negative for earlier days). */
export function addDays(day: string, n: number): string {
  const { year, month, date } = parseDay(day);
  return dateToDay(new Date(year, month - 1, date + n));
}

/** Day of the week for a day: 0 = Sunday … 6 = Saturday. */
export function weekday(day: string): number {
  const { year, month, date } = parseDay(day);
  return new Date(year, month - 1, date).getDay();
}

/** Minutes after midnight on the phone's clock (0–1439). */
export function clockMinute(timeMs: number): number {
  const date = new Date(timeMs);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * The moment at `minute` (clock minutes) within a logical day. Times before 4 am fall on the
 * next calendar date: 1:00 am on logical day 27 Sep is 28 Sep 01:00.
 */
export function timeOnDay(day: string, minute: number): number {
  const { year, month, date } = parseDay(day);
  const nextDate = minute < DAY_START_MIN ? 1 : 0;
  return new Date(year, month - 1, date + nextDate, 0, minute).getTime();
}

/** Where a clock minute falls in a logical day: 4:00 am → 0, 3:59 am → 1439. */
export function minuteOfLogicalDay(minute: number): number {
  return (minute - DAY_START_MIN + MIN_PER_DAY) % MIN_PER_DAY;
}

/** The 24 hours of a logical day in order, as clock hours: 4, 5, … 23, 0, 1, 2, 3. */
export const LOGICAL_DAY_HOURS: readonly number[] = Array.from(
  { length: 24 },
  (_, i) => (DAY_START_MIN / 60 + i) % 24,
);

/** Changes the hour of a clock minute and keeps its minutes: (13:30, 20) → 20:30. */
export function withHour(minute: number, hour: number): number {
  return hour * 60 + (minute % 60);
}

/** Changes the minutes of a clock minute and keeps its hour: (13:05, 30) → 13:30. */
export function withMinutes(minute: number, minutes: number): number {
  return Math.floor(minute / 60) * 60 + minutes;
}

/** The parts needed to show a clock minute as "1:30 pm". */
export function timeParts(minute: number): { hour: number; minutes: string; period: 'am' | 'pm' } {
  const hour24 = Math.floor(minute / 60) % 24;
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour, minutes: pad(minute % 60), period: hour24 < 12 ? 'am' : 'pm' };
}

/** How a day relates to today, for labels like "Yesterday". `null` for any other day. */
export function relativeDay(day: string, today: string): 'today' | 'yesterday' | 'tomorrow' | null {
  if (day === today) return 'today';
  if (day === addDays(today, -1)) return 'yesterday';
  if (day === addDays(today, 1)) return 'tomorrow';
  return null;
}

// ─── Meal slots ────────────────────────────────────────────────────────────────

/** The parts of a meal slot that choosing a slot by time needs. */
export interface SlotWindow {
  id: string;
  position: number;
  startMin: number;
  endMin: number;
  isHidden: boolean;
}

/** True if a clock minute is inside a slot's window [start, end). Windows may wrap midnight. */
export function isInWindow(minute: number, slot: Pick<SlotWindow, 'startMin' | 'endMin'>): boolean {
  if (slot.startMin === slot.endMin) return true; // a window covering the whole day
  if (slot.startMin < slot.endMin) return minute >= slot.startMin && minute < slot.endMin;
  return minute >= slot.startMin || minute < slot.endMin; // wraps past midnight
}

/** Visible slots in their order on screen. */
export function visibleSlots<T extends SlotWindow>(slots: readonly T[]): T[] {
  return slots.filter((s) => !s.isHidden).sort((a, b) => a.position - b.position);
}

/**
 * The slot a food is logged to by default (SPEC §5.8): the first visible slot whose window
 * contains the time; if none does, the last visible slot. `undefined` only if every slot is hidden.
 */
export function autoSlot<T extends SlotWindow>(slots: readonly T[], minute: number): T | undefined {
  const visible = visibleSlots(slots);
  return visible.find((s) => isInWindow(minute, s)) ?? visible[visible.length - 1];
}

/**
 * The time a new entry starts with: now, unless the user tapped "+ Add" on a slot whose window
 * doesn't include now — then the slot's start time (tapping Dinner at 1 pm → 7:00 pm).
 */
export function defaultEntryMinute(
  nowMs: number,
  slot?: Pick<SlotWindow, 'startMin' | 'endMin'>,
): number {
  const now = clockMinute(nowMs);
  if (!slot || isInWindow(now, slot)) return now;
  return slot.startMin;
}
