import { addDays, dateRange, DateKey } from '../dates';
import {
  canUseJoker,
  computeJokerLedger,
  computeStreak,
  DayEntry,
  JokerUse,
  protectableDays,
  StreakInput,
} from '../streak';

const START = '2026-01-01';

function successes(from: DateKey, count: number): DayEntry[] {
  return dateRange(from, addDays(from, count - 1)).map((date) => ({ date, status: 'success' as const }));
}

function input(partial: Partial<StreakInput> & Pick<StreakInput, 'today'>): StreakInput {
  return { startDate: START, entries: [], jokerUses: [], ...partial };
}

describe('computeStreak', () => {
  it('démarre à zéro sans historique', () => {
    const summary = computeStreak(input({ today: START }));
    expect(summary.current).toBe(0);
    expect(summary.best).toBe(0);
    expect(summary.statusOf(START)).toBe('pending');
  });

  it('compte les journées réussies consécutives', () => {
    const summary = computeStreak(input({ today: '2026-01-05', entries: successes(START, 5) }));
    expect(summary.current).toBe(5);
    expect(summary.best).toBe(5);
    expect(summary.totalSuccess).toBe(5);
  });

  it("une journée non réussie interrompt la série mais le record reste acquis", () => {
    const entries: DayEntry[] = [
      ...successes(START, 4),
      { date: '2026-01-05', status: 'failure' },
      ...successes('2026-01-06', 2),
    ];
    const summary = computeStreak(input({ today: '2026-01-07', entries }));
    expect(summary.current).toBe(2);
    expect(summary.best).toBe(4);
    expect(summary.statusOf('2026-01-05')).toBe('failure');
  });

  it("aujourd'hui non renseigné n'interrompt pas la série", () => {
    const summary = computeStreak(input({ today: '2026-01-04', entries: successes(START, 3) }));
    expect(summary.statusOf('2026-01-04')).toBe('pending');
    expect(summary.current).toBe(3);
  });

  it('une journée vide reste en attente pendant 48 heures puis devient manquée', () => {
    const entries = [...successes(START, 3)];
    // 04/01 vide. Le 06/01, il est encore en attente (48 h après sa fin).
    let summary = computeStreak(input({ today: '2026-01-06', entries }));
    expect(summary.statusOf('2026-01-04')).toBe('pending');
    expect(summary.current).toBe(3);
    // Le 07/01, le délai est dépassé : la journée est manquée.
    summary = computeStreak(input({ today: '2026-01-07', entries }));
    expect(summary.statusOf('2026-01-04')).toBe('missed');
    expect(summary.current).toBe(0);
    expect(summary.best).toBe(3);
  });

  it("une journée en attente ne compte pas mais relie les jours qui l'entourent", () => {
    const entries: DayEntry[] = [...successes(START, 2), { date: '2026-01-04', status: 'success' }];
    const summary = computeStreak(input({ today: '2026-01-04', entries }));
    expect(summary.statusOf('2026-01-03')).toBe('pending');
    expect(summary.current).toBe(3);
  });

  it("ignore les jours avant le début du suivi et dans le futur", () => {
    const entries: DayEntry[] = [{ date: '2025-12-31', status: 'success' }, ...successes(START, 2)];
    const summary = computeStreak(input({ today: '2026-01-02', entries }));
    expect(summary.current).toBe(2);
    expect(summary.statusOf('2025-12-31')).toBe('inactive');
    expect(summary.statusOf('2026-01-03')).toBe('inactive');
  });

  it('traverse correctement les changements de mois, d’année et d’heure', () => {
    // Passage à l'heure d'été (29/03/2026) et d'hiver (25/10/2026) en France.
    const springEntries = successes('2026-03-27', 5);
    expect(computeStreak(input({ startDate: '2026-03-27', today: '2026-03-31', entries: springEntries })).current).toBe(5);
    const autumnEntries = successes('2026-10-23', 5);
    expect(computeStreak(input({ startDate: '2026-10-23', today: '2026-10-27', entries: autumnEntries })).current).toBe(5);
    const yearEntries = successes('2025-12-29', 6);
    expect(computeStreak(input({ startDate: '2025-12-29', today: '2026-01-03', entries: yearEntries })).current).toBe(6);
    const leapEntries = successes('2028-02-27', 4);
    expect(computeStreak(input({ startDate: '2028-02-27', today: '2028-03-01', entries: leapEntries })).current).toBe(4);
  });

  it('est déterministe : même historique dans un autre ordre, même résultat', () => {
    const entries = [...successes(START, 9), { date: '2026-01-10', status: 'failure' as const }];
    const a = computeStreak(input({ today: '2026-01-11', entries }));
    const b = computeStreak(input({ today: '2026-01-11', entries: [...entries].reverse() }));
    expect([a.current, a.best, a.totalSuccess, a.jokers.balance]).toEqual([
      b.current,
      b.best,
      b.totalSuccess,
      b.jokers.balance,
    ]);
  });

  it('une validation en double pour un même jour ne compte qu’une fois (la dernière fait foi)', () => {
    const entries: DayEntry[] = [
      { date: START, status: 'success' },
      { date: START, status: 'success' },
    ];
    expect(computeStreak(input({ today: START, entries })).current).toBe(1);
  });
});

describe('jokers', () => {
  it('un joker est gagné tous les sept jours réussis', () => {
    expect(computeJokerLedger(successes(START, 6), []).balance).toBe(0);
    expect(computeJokerLedger(successes(START, 7), []).balance).toBe(1);
    expect(computeJokerLedger(successes(START, 14), []).balance).toBe(2);
  });

  it('les jours réussis se cumulent même après une interruption', () => {
    const entries: DayEntry[] = [
      ...successes(START, 4),
      { date: '2026-01-05', status: 'failure' },
      ...successes('2026-01-06', 3),
    ];
    expect(computeJokerLedger(entries, []).balance).toBe(1);
  });

  it('le solde est plafonné à deux jokers', () => {
    const ledger = computeJokerLedger(successes(START, 28), []);
    expect(ledger.balance).toBe(2);
    expect(ledger.earned).toBe(2);
  });

  it('un joker protège une journée manquée sans la compter comme réussie', () => {
    const entries: DayEntry[] = [
      ...successes(START, 7),
      { date: '2026-01-08', status: 'failure' },
      ...successes('2026-01-09', 2),
    ];
    const jokerUses: JokerUse[] = [{ protectedDate: '2026-01-08', usedOn: '2026-01-09' }];
    const summary = computeStreak(input({ today: '2026-01-10', entries, jokerUses }));
    expect(summary.statusOf('2026-01-08')).toBe('protected');
    expect(summary.current).toBe(9);
    expect(summary.totalSuccess).toBe(9);
    expect(summary.jokers.balance).toBe(0);
  });

  it('un joker peut protéger une journée non renseignée après le délai de 48 h', () => {
    const entries: DayEntry[] = [...successes(START, 7), ...successes('2026-01-09', 3)];
    const base = input({ today: '2026-01-11', entries });
    expect(computeStreak(base).statusOf('2026-01-08')).toBe('missed');
    expect(canUseJoker(base, '2026-01-08')).toEqual({ ok: true });
    const summary = computeStreak({ ...base, jokerUses: [{ protectedDate: '2026-01-08', usedOn: '2026-01-11' }] });
    expect(summary.statusOf('2026-01-08')).toBe('protected');
    expect(summary.current).toBe(10);
  });

  it('une utilisation sans joker disponible est ignorée', () => {
    const entries: DayEntry[] = [...successes(START, 3), { date: '2026-01-04', status: 'failure' }];
    const jokerUses: JokerUse[] = [{ protectedDate: '2026-01-04', usedOn: '2026-01-05' }];
    const summary = computeStreak(input({ today: '2026-01-05', entries, jokerUses }));
    expect(summary.jokers.validUses).toHaveLength(0);
    expect(summary.statusOf('2026-01-04')).toBe('failure');
    expect(summary.current).toBe(0);
  });

  it('un joker gagné le jour même peut être utilisé ce jour-là', () => {
    const entries: DayEntry[] = [
      ...successes(START, 6),
      { date: '2026-01-07', status: 'failure' },
      { date: '2026-01-08', status: 'success' },
    ];
    // 7e réussite le 08/01, joker utilisé le 08/01 pour protéger le 07/01.
    const jokerUses: JokerUse[] = [{ protectedDate: '2026-01-07', usedOn: '2026-01-08' }];
    const summary = computeStreak(input({ today: '2026-01-08', entries, jokerUses }));
    expect(summary.jokers.validUses).toHaveLength(1);
    expect(summary.current).toBe(7);
  });

  it('refuse un joker sur une journée réussie, en attente, trop ancienne ou future', () => {
    const entries: DayEntry[] = [...successes(START, 7)];
    const base = input({ today: '2026-01-09', entries });
    expect(canUseJoker(base, '2026-01-07')).toEqual({ ok: false, reason: 'not-missed' });
    expect(canUseJoker(base, '2026-01-08')).toEqual({ ok: false, reason: 'not-missed' }); // en attente
    expect(canUseJoker(base, '2026-01-09')).toEqual({ ok: false, reason: 'future' });
    expect(canUseJoker(base, '2025-12-31')).toEqual({ ok: false, reason: 'before-start' });
    const later = input({ today: '2026-01-30', entries });
    expect(canUseJoker(later, '2026-01-10')).toEqual({ ok: false, reason: 'too-old' });
  });

  it('refuse un joker quand le solde est vide', () => {
    const entries: DayEntry[] = [...successes(START, 3), { date: '2026-01-04', status: 'failure' }];
    expect(canUseJoker(input({ today: '2026-01-05', entries }), '2026-01-04')).toEqual({ ok: false, reason: 'no-joker' });
  });

  it('liste les journées protégeables', () => {
    const entries: DayEntry[] = [
      ...successes(START, 7),
      { date: '2026-01-08', status: 'failure' },
      { date: '2026-01-09', status: 'success' },
    ];
    expect(protectableDays(input({ today: '2026-01-10', entries }))).toEqual(['2026-01-08']);
  });
});

describe('corrections', () => {
  it('corriger un échec en réussite rétablit la série', () => {
    const before: DayEntry[] = [...successes(START, 3), { date: '2026-01-04', status: 'failure' }];
    expect(computeStreak(input({ today: '2026-01-04', entries: before })).current).toBe(0);
    const after: DayEntry[] = [...successes(START, 3), { date: '2026-01-04', status: 'success' }];
    expect(computeStreak(input({ today: '2026-01-04', entries: after })).current).toBe(4);
  });

  it('corriger une réussite en échec peut retirer un joker non utilisé', () => {
    const entries = successes(START, 7);
    expect(computeStreak(input({ today: '2026-01-07', entries })).jokers.balance).toBe(1);
    const corrected: DayEntry[] = [...successes(START, 6), { date: '2026-01-07', status: 'failure' }];
    expect(computeStreak(input({ today: '2026-01-07', entries: corrected })).jokers.balance).toBe(0);
  });
});
