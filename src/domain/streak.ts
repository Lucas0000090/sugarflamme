/**
 * Moteur des séries et des jokers.
 *
 * Tout est recalculé à partir de l'historique (validations + utilisations de
 * jokers) et de la date du jour : le résultat est déterministe et ne dépend
 * d'aucun compteur stocké qui pourrait se désynchroniser.
 */
import { addDays, compareDateKeys, dateRange, DateKey, diffDays } from './dates';
import {
  CORRECTION_WINDOW_DAYS,
  JOKER_EARN_EVERY,
  JOKER_MAX_BALANCE,
  JOKER_WINDOW_DAYS,
} from './rules';

export type EntryStatus = 'success' | 'failure';

export interface DayEntry {
  date: DateKey;
  status: EntryStatus;
}

export interface JokerUse {
  /** Journée protégée. */
  protectedDate: DateKey;
  /** Jour (local) où l'utilisateur a utilisé le joker. */
  usedOn: DateKey;
}

/**
 * - success : objectif respecté
 * - failure : « pas aujourd'hui »
 * - protected : journée manquée couverte par un joker (ne compte pas comme réussie)
 * - pending : non renseignée, encore modifiable (48 h)
 * - missed : non renseignée et délai dépassé
 * - inactive : avant le début du suivi ou dans le futur
 */
export type DayStatus = 'success' | 'failure' | 'protected' | 'pending' | 'missed' | 'inactive';

export interface StreakInput {
  /** Premier jour suivi (jour de fin de l'onboarding). */
  startDate: DateKey;
  today: DateKey;
  entries: readonly DayEntry[];
  jokerUses: readonly JokerUse[];
}

export interface JokerLedger {
  /** Jokers disponibles maintenant. */
  balance: number;
  /** Total gagné (après plafonnement). */
  earned: number;
  /** Utilisations valides (le joker était disponible au moment de l'utilisation). */
  validUses: JokerUse[];
}

export interface StreakSummary {
  current: number;
  best: number;
  totalSuccess: number;
  jokers: JokerLedger;
  statusOf: (date: DateKey) => DayStatus;
}

/** Une journée est-elle encore modifiable / en attente ? */
export function isWithinCorrectionWindow(date: DateKey, today: DateKey): boolean {
  const age = diffDays(date, today);
  return age >= 0 && age <= CORRECTION_WINDOW_DAYS;
}

/**
 * Rejoue chronologiquement les gains et utilisations de jokers.
 * - Un joker est gagné au jour de chaque 7e, 14e, 21e… journée réussie.
 * - Le solde est plafonné : un gain au-delà du maximum est perdu.
 * - Une utilisation sans joker disponible à cette date est ignorée.
 * À date égale, les gains passent avant les utilisations.
 */
export function computeJokerLedger(
  entries: readonly DayEntry[],
  jokerUses: readonly JokerUse[],
): JokerLedger {
  type Event = { date: DateKey; order: 0 | 1; use?: JokerUse };
  const events: Event[] = [];

  const successDates = entries
    .filter((entry) => entry.status === 'success')
    .map((entry) => entry.date)
    .sort(compareDateKeys);
  successDates.forEach((date, index) => {
    if ((index + 1) % JOKER_EARN_EVERY === 0) events.push({ date, order: 0 });
  });
  for (const use of jokerUses) events.push({ date: use.usedOn, order: 1, use });

  events.sort(
    (a, b) =>
      compareDateKeys(a.date, b.date) ||
      a.order - b.order ||
      compareDateKeys(a.use?.protectedDate ?? '', b.use?.protectedDate ?? ''),
  );

  let balance = 0;
  let earned = 0;
  const validUses: JokerUse[] = [];
  for (const event of events) {
    if (event.order === 0) {
      if (balance < JOKER_MAX_BALANCE) {
        balance += 1;
        earned += 1;
      }
    } else if (event.use && balance > 0) {
      balance -= 1;
      validUses.push(event.use);
    }
  }
  return { balance, earned, validUses };
}

export function computeStreak(input: StreakInput): StreakSummary {
  const { startDate, today, entries, jokerUses } = input;
  const entryByDate = new Map<DateKey, EntryStatus>();
  for (const entry of entries) entryByDate.set(entry.date, entry.status);

  const jokers = computeJokerLedger(entries, jokerUses);
  const protectedDates = new Set(jokers.validUses.map((use) => use.protectedDate));

  const statusOf = (date: DateKey): DayStatus => {
    if (date < startDate || date > today) return 'inactive';
    const status = entryByDate.get(date);
    if (status === 'success') return 'success';
    if (protectedDates.has(date)) return 'protected';
    if (status === 'failure') return 'failure';
    return isWithinCorrectionWindow(date, today) ? 'pending' : 'missed';
  };

  let best = 0;
  let run = 0;
  let totalSuccess = 0;
  if (startDate <= today) {
    for (const date of dateRange(startDate, today)) {
      const status = statusOf(date);
      if (status === 'success') {
        run += 1;
        totalSuccess += 1;
        best = Math.max(best, run);
      } else if (status === 'failure' || status === 'missed') {
        run = 0;
      }
      // protected / pending : ni progression, ni interruption.
    }
  }

  return { current: run, best, totalSuccess, jokers, statusOf };
}

export type JokerEligibility =
  | { ok: true }
  | { ok: false; reason: 'no-joker' | 'not-missed' | 'too-old' | 'future' | 'before-start' };

/**
 * Peut-on utiliser un joker pour protéger cette journée ?
 * Seules les journées manquées (« pas aujourd'hui » ou non renseignées après
 * 48 h) des 7 derniers jours sont éligibles, y compris aujourd'hui si
 * l'utilisateur a déjà répondu « pas aujourd'hui ».
 */
export function canUseJoker(input: StreakInput, date: DateKey): JokerEligibility {
  if (date < input.startDate) return { ok: false, reason: 'before-start' };
  if (date > input.today) return { ok: false, reason: 'future' };
  if (diffDays(date, input.today) > JOKER_WINDOW_DAYS) return { ok: false, reason: 'too-old' };
  const summary = computeStreak(input);
  const status = summary.statusOf(date);
  if (status !== 'failure' && status !== 'missed') return { ok: false, reason: 'not-missed' };
  if (summary.jokers.balance <= 0) return { ok: false, reason: 'no-joker' };
  return { ok: true };
}

/** Journées récentes qu'un joker pourrait protéger (de la plus récente à la plus ancienne). */
export function protectableDays(input: StreakInput): DateKey[] {
  const result: DateKey[] = [];
  for (let offset = 0; offset <= JOKER_WINDOW_DAYS; offset += 1) {
    const date = addDays(input.today, -offset);
    if (date < input.startDate) break;
    if (canUseJoker(input, date).ok) result.push(date);
  }
  return result;
}

/** Les N derniers jours (le plus ancien en premier), aujourd'hui inclus. */
export function lastDays(summary: StreakSummary, today: DateKey, count: number) {
  return dateRange(addDays(today, -(count - 1)), today).map((date) => ({
    date,
    status: summary.statusOf(date),
  }));
}
