/**
 * Dates « locales » au format AAAA-MM-JJ.
 *
 * Toutes les règles métier manipulent des clés de jour plutôt que des
 * timestamps : un jour reste le même quel que soit le fuseau ou un passage
 * à l'heure d'été. L'arithmétique est faite en UTC pour éviter les décalages.
 */
export type DateKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

export function isDateKey(value: string): value is DateKey {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(key: DateKey): Date {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) throw new Error(`Date invalide : ${key}`);
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): DateKey {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Jour local (fuseau de l'appareil) correspondant à un instant. */
export function toDateKey(instant: Date): DateKey {
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après `from`). */
export function diffDays(from: DateKey, to: DateKey): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDateKey(a: DateKey, b: DateKey): DateKey {
  return a > b ? a : b;
}

/** Liste inclusive des jours entre deux dates. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const result: DateKey[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) result.push(key);
  return result;
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayIndex(key: DateKey): number {
  return (toUtc(key).getUTCDay() + 6) % 7;
}

export function dayOfMonth(key: DateKey): number {
  return toUtc(key).getUTCDate();
}

export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

export function addMonths(monthStart: DateKey, months: number): DateKey {
  const date = toUtc(startOfMonth(monthStart));
  date.setUTCMonth(date.getUTCMonth() + months);
  return fromUtc(date);
}

export function daysInMonth(key: DateKey): number {
  const date = toUtc(startOfMonth(key));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.getUTCDate();
}

const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEKDAYS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function weekdayShort(key: DateKey): string {
  return WEEKDAYS_SHORT[weekdayIndex(key)] ?? '';
}

export const WEEKDAY_HEADERS = WEEKDAYS_SHORT;

export function formatMonthTitle(key: DateKey): string {
  const date = toUtc(key);
  const month = MONTHS[date.getUTCMonth()] ?? '';
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getUTCFullYear()}`;
}

/** « mardi 28 octobre » */
export function formatLongDate(key: DateKey): string {
  const date = toUtc(key);
  return `${WEEKDAYS_LONG[weekdayIndex(key)]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** « aujourd'hui », « hier », ou la date longue. */
export function formatRelativeDay(key: DateKey, today: DateKey): string {
  const diff = diffDays(key, today);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  if (diff === 2) return 'avant-hier';
  return formatLongDate(key);
}

export function formatTime(hour: number, minute: number): string {
  return `${hour} h ${pad(minute)}`;
}

/** Complément « de » élidé : « d'aujourd'hui », « d'hier », « du mardi 28 octobre ». */
export function formatOfDay(key: DateKey, today: DateKey): string {
  const diff = diffDays(key, today);
  if (diff === 0) return "d'aujourd'hui";
  if (diff === 1) return "d'hier";
  if (diff === 2) return "d'avant-hier";
  return `du ${formatLongDate(key)}`;
}

/** « aujourd'hui », « hier », « avant-hier » ou « le mardi 28 octobre ». */
export function formatOnDay(key: DateKey, today: DateKey): string {
  const diff = diffDays(key, today);
  return diff >= 0 && diff <= 2 ? formatRelativeDay(key, today) : `le ${formatLongDate(key)}`;
}
