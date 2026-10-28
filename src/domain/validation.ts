/** Règles de la validation quotidienne. */
import { addDays, DateKey, maxDateKey, toDateKey } from './dates';
import { CORRECTION_WINDOW_DAYS, VALIDATION_OPEN_HOUR } from './rules';
import { EntryStatus, isWithinCorrectionWindow } from './streak';

export type RecordDecision =
  | { ok: true; kind: 'create' | 'correct' | 'unchanged' }
  | { ok: false; reason: 'future' | 'too-early' | 'expired' | 'before-start' };

/** La validation du jour en cours est-elle ouverte ? */
export function isTodayValidationOpen(now: Date): boolean {
  return now.getHours() >= VALIDATION_OPEN_HOUR;
}

/**
 * Décide si l'utilisateur peut enregistrer `status` pour `date`.
 * Une journée n'existe qu'une fois : un nouvel envoi devient une correction,
 * autorisée seulement pendant les 48 h qui suivent la fin de la journée.
 */
export function decideRecord(params: {
  date: DateKey;
  status: EntryStatus;
  existing: EntryStatus | null;
  startDate: DateKey;
  now: Date;
}): RecordDecision {
  const { date, status, existing, startDate, now } = params;
  const today = toDateKey(now);
  if (date > today) return { ok: false, reason: 'future' };
  if (date < startDate) return { ok: false, reason: 'before-start' };
  if (!isWithinCorrectionWindow(date, today)) return { ok: false, reason: 'expired' };
  if (date === today && !isTodayValidationOpen(now) && existing === null) {
    return { ok: false, reason: 'too-early' };
  }
  if (existing === null) return { ok: true, kind: 'create' };
  if (existing === status) return { ok: true, kind: 'unchanged' };
  return { ok: true, kind: 'correct' };
}

/** Journées encore à renseigner, de la plus ancienne à la plus récente. */
export function pendingValidationDays(params: {
  startDate: DateKey;
  now: Date;
  recordedDates: ReadonlySet<DateKey>;
}): DateKey[] {
  const { startDate, now, recordedDates } = params;
  const today = toDateKey(now);
  const result: DateKey[] = [];
  let date = maxDateKey(startDate, addDays(today, -CORRECTION_WINDOW_DAYS));
  for (; date < today; date = addDays(date, 1)) {
    if (!recordedDates.has(date)) result.push(date);
  }
  if (today >= startDate && isTodayValidationOpen(now) && !recordedDates.has(today)) {
    result.push(today);
  }
  return result;
}

export const RECORD_ERROR_MESSAGES: Record<Exclude<RecordDecision, { ok: true }>['reason'], string> = {
  future: "Cette journée n'a pas encore eu lieu.",
  'too-early': `La validation du jour s'ouvre à ${VALIDATION_OPEN_HOUR} h. Reviens ce soir !`,
  expired: 'Le délai de 48 heures pour renseigner ou corriger cette journée est dépassé.',
  'before-start': 'Cette journée précède le début de ton suivi.',
};
