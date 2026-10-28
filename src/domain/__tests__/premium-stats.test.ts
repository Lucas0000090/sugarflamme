import { addDays, dateRange } from '../dates';
import { canStartSosPause, hasFeature, yearlySavingsPercent } from '../premium';
import { BASE_TIER, displayedTier } from '../rewards';
import {
  cravingsByPeriod,
  hardestWeekday,
  peakPeriod,
  periodOfHour,
  successRate,
  weekdayRates,
} from '../stats';
import { computeStreak, DayEntry } from '../streak';

describe('offre Premium', () => {
  it('débloque les fonctions Premium pour les abonnés uniquement', () => {
    expect(hasFeature({ plan: 'free' }, 'detailed-stats')).toBe(false);
    expect(hasFeature({ plan: 'premium' }, 'detailed-stats')).toBe(true);
    expect(canStartSosPause({ plan: 'premium' }, 12)).toBe(true);
    expect(canStartSosPause({ plan: 'free' }, 1)).toBe(false);
  });

  it("calcule l'économie de l'abonnement annuel", () => {
    expect(yearlySavingsPercent(3.99, 24.99)).toBe(48);
    expect(yearlySavingsPercent(3.99, 47.88)).toBeNull();
    expect(yearlySavingsPercent(0, 24.99)).toBeNull();
  });
});

describe('personnalisation de la flamme', () => {
  const unlocked = new Set([3, 7]);

  it('suit la série par défaut', () => {
    expect(displayedTier({ streak: 8, preference: null, unlocked, canCustomize: true }).days).toBe(7);
  });

  it('applique le choix d’un abonné parmi les flammes débloquées', () => {
    expect(displayedTier({ streak: 8, preference: 3, unlocked, canCustomize: true }).days).toBe(3);
    expect(displayedTier({ streak: 8, preference: 0, unlocked, canCustomize: true })).toBe(BASE_TIER);
  });

  it('ignore un choix non débloqué ou sans abonnement actif', () => {
    expect(displayedTier({ streak: 8, preference: 30, unlocked, canCustomize: true }).days).toBe(7);
    expect(displayedTier({ streak: 8, preference: 3, unlocked, canCustomize: false }).days).toBe(7);
  });
});

describe('statistiques détaillées', () => {
  // 05/10/2026 est un lundi.
  const start = '2026-10-05';
  const today = '2026-10-18';
  const entries: DayEntry[] = [
    ...dateRange(start, today).map((date) => ({ date, status: 'success' as const })),
  ].map((entry) =>
    // Les deux samedis sont des échecs.
    entry.date === '2026-10-10' || entry.date === '2026-10-17' ? { ...entry, status: 'failure' as const } : entry,
  );
  const summary = computeStreak({ startDate: start, today, entries, jokerUses: [] });

  it('calcule le taux de réussite sur une période', () => {
    expect(successRate(summary, start, today, 7)).toEqual({ success: 6, total: 7, rate: 6 / 7 });
    // La période est limitée au début du suivi.
    expect(successRate(summary, start, today, 30)).toMatchObject({ success: 12, total: 14 });
  });

  it('ignore les journées en attente', () => {
    const partial = computeStreak({ startDate: start, today: addDays(today, 1), entries, jokerUses: [] });
    expect(successRate(partial, start, addDays(today, 1), 1)).toEqual({ success: 0, total: 0, rate: null });
  });

  it('identifie le jour de la semaine le plus difficile', () => {
    const rates = weekdayRates(summary, start, today);
    expect(rates[5]).toEqual({ success: 0, total: 2, rate: 0 });
    expect(rates[0]).toEqual({ success: 2, total: 2, rate: 1 });
    expect(hardestWeekday(rates)).toBe(5);
  });

  it('classe les envies par moment de la journée', () => {
    expect(periodOfHour(4)).toBe('night');
    expect(periodOfHour(9)).toBe('morning');
    expect(periodOfHour(16)).toBe('afternoon');
    expect(periodOfHour(23)).toBe('night');
    const counts = cravingsByPeriod([
      { startedAt: '2026-10-12T16:30:00' },
      { startedAt: '2026-10-13T15:10:00' },
      { startedAt: '2026-10-13T21:00:00' },
      { startedAt: 'invalide' },
    ]);
    expect(counts).toEqual({ morning: 0, midday: 0, afternoon: 2, evening: 1, night: 0 });
    expect(peakPeriod(counts)).toBe('afternoon');
    expect(peakPeriod(cravingsByPeriod([]))).toBeNull();
  });
});
