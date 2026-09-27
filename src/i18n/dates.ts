// Dates and times as words, through i18next (SPEC §7: every string comes from en.json).

import type { TFunction } from 'i18next';

import { parseDay, relativeDay, timeParts, weekday } from '@/lib/day';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

/** "Sun, 27 Sep" — with the year when it isn't this year's: "Sun, 27 Sep 2025". */
export function formatDate(t: TFunction, day: string, today: string): string {
  const { year, month, date } = parseDay(day);
  const values = {
    weekday: t(`date.weekdays.${WEEKDAYS[weekday(day)]}`),
    date,
    month: t(`date.months.${MONTHS[month - 1]}`),
    year,
  };
  return year === parseDay(today).year ? t('date.short', values) : t('date.withYear', values);
}

/** "Today", "Yesterday", "Tomorrow", or the date for any other day. */
export function formatDayName(t: TFunction, day: string, today: string): string {
  const relative = relativeDay(day, today);
  return relative ? t(`date.${relative}`) : formatDate(t, day, today);
}

/** A clock minute as "1:30 pm". */
export function formatTime(t: TFunction, minute: number): string {
  const { hour, minutes, period } = timeParts(minute);
  return t(`time.${period}`, { hour, minutes });
}

/** Just the hour: "4 am", "12 pm". */
export function formatHour(t: TFunction, hour: number): string {
  const { hour: h, period } = timeParts(hour * 60);
  return t(`time.hour_${period}`, { hour: h });
}
