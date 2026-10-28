/** Statistiques détaillées (Premium). Fonctions pures. */
import { addDays, DateKey, dateRange, maxDateKey, weekdayIndex } from './dates';
import { StreakSummary } from './streak';

export interface Rate {
  success: number;
  total: number;
  /** 0 → 1, ou null s'il n'y a aucune journée comptée. */
  rate: number | null;
}

const rate = (success: number, total: number): Rate => ({ success, total, rate: total > 0 ? success / total : null });

/** Les journées en attente, hors suivi ou futures ne sont pas comptées. */
function counted(summary: StreakSummary, date: DateKey) {
  const status = summary.statusOf(date);
  return { counts: status !== 'pending' && status !== 'inactive', success: status === 'success' };
}

/** Taux de réussite sur les `days` derniers jours (aujourd'hui inclus). */
export function successRate(summary: StreakSummary, startDate: DateKey, today: DateKey, days: number): Rate {
  let success = 0;
  let total = 0;
  const from = maxDateKey(startDate, addDays(today, -(days - 1)));
  if (from > today) return rate(0, 0);
  for (const date of dateRange(from, today)) {
    const day = counted(summary, date);
    if (!day.counts) continue;
    total += 1;
    if (day.success) success += 1;
  }
  return rate(success, total);
}

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Taux de réussite par jour de la semaine (0 = lundi), sur tout l'historique. */
export function weekdayRates(summary: StreakSummary, startDate: DateKey, today: DateKey): Rate[] {
  const success = Array<number>(7).fill(0);
  const total = Array<number>(7).fill(0);
  if (startDate <= today) {
    for (const date of dateRange(startDate, today)) {
      const day = counted(summary, date);
      if (!day.counts) continue;
      const index = weekdayIndex(date);
      total[index] = (total[index] ?? 0) + 1;
      if (day.success) success[index] = (success[index] ?? 0) + 1;
    }
  }
  return total.map((count, index) => rate(success[index] ?? 0, count));
}

/** Jour de la semaine le plus difficile (au moins 2 journées comptées). */
export function hardestWeekday(rates: readonly Rate[]): number | null {
  let result: number | null = null;
  rates.forEach((item, index) => {
    if (item.rate === null || item.total < 2) return;
    const current = result === null ? null : rates[result]?.rate;
    if (current === null || current === undefined || item.rate < current) result = index;
  });
  return result;
}

export type DayPeriod = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export const DAY_PERIODS: readonly { id: DayPeriod; label: string; hours: string }[] = [
  { id: 'morning', label: 'Matin', hours: '5 h – 11 h' },
  { id: 'midday', label: 'Midi', hours: '11 h – 14 h' },
  { id: 'afternoon', label: 'Après-midi', hours: '14 h – 18 h' },
  { id: 'evening', label: 'Soir', hours: '18 h – 22 h' },
  { id: 'night', label: 'Nuit', hours: '22 h – 5 h' },
];

export function periodOfHour(hour: number): DayPeriod {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** Nombre de pauses SOS par moment de la journée (heure locale de début). */
export function cravingsByPeriod(sessions: readonly { startedAt: string }[]): Record<DayPeriod, number> {
  const result: Record<DayPeriod, number> = { morning: 0, midday: 0, afternoon: 0, evening: 0, night: 0 };
  for (const session of sessions) {
    const date = new Date(session.startedAt);
    if (Number.isNaN(date.getTime())) continue;
    result[periodOfHour(date.getHours())] += 1;
  }
  return result;
}

/** Moment de la journée le plus fréquent, ou null sans session. */
export function peakPeriod(counts: Record<DayPeriod, number>): DayPeriod | null {
  let best: DayPeriod | null = null;
  for (const period of DAY_PERIODS) {
    if (counts[period.id] > 0 && (best === null || counts[period.id] > counts[best])) best = period.id;
  }
  return best;
}
