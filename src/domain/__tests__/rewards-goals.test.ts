import { goalForDate, goalLabel, upcomingGoal } from '../goals';
import { canStartSosPause, FREE_ENTITLEMENTS } from '../premium';
import { newlyReachedTiers, nextTierProgress, REWARD_TIERS, tierForStreak } from '../rewards';
import { averageIntensities, intensityFeedback } from '../sos';

describe('récompenses', () => {
  it('définit les six paliers attendus', () => {
    expect(REWARD_TIERS.map((tier) => [tier.days, tier.name])).toEqual([
      [3, 'Étincelle'],
      [7, 'Petite flamme'],
      [14, 'Feu grandissant'],
      [30, 'Brasier'],
      [60, 'Feu violet'],
      [100, 'Flamme légendaire'],
    ]);
  });

  it('choisit l’apparence de la flamme selon la série', () => {
    expect(tierForStreak(0).id).toBe('braise');
    expect(tierForStreak(3).id).toBe('etincelle');
    expect(tierForStreak(29).id).toBe('feu-grandissant');
    expect(tierForStreak(150).id).toBe('legendaire');
  });

  it('calcule la progression vers le prochain palier', () => {
    expect(nextTierProgress(0)).toMatchObject({ remaining: 3, progress: 0 });
    expect(nextTierProgress(5)).toMatchObject({ remaining: 2, progress: 0.5 });
    expect(nextTierProgress(100)).toMatchObject({ next: null, progress: 1 });
  });

  it('détecte les nouveaux paliers sans redébloquer les badges acquis', () => {
    expect(newlyReachedTiers(8, new Set([3])).map((tier) => tier.days)).toEqual([7]);
    expect(newlyReachedTiers(2, new Set([3, 7]))).toEqual([]);
  });
});

describe('objectifs', () => {
  const goals = [
    { id: 1, type: 'desserts' as const, customLabel: null, effectiveFrom: '2026-10-01' },
    { id: 2, type: 'custom' as const, customLabel: 'Pas de soda', effectiveFrom: '2026-10-29' },
  ];

  it('un changement d’objectif prend effet à sa date', () => {
    expect(goalForDate(goals, '2026-10-28')?.id).toBe(1);
    expect(goalForDate(goals, '2026-10-29')?.id).toBe(2);
    expect(goalForDate(goals, '2026-09-30')).toBeNull();
    expect(upcomingGoal(goals, '2026-10-28')?.id).toBe(2);
    expect(goalLabel(goals[1]!)).toBe('Pas de soda');
  });
});

describe('SOS et offre gratuite', () => {
  it('limite la pause guidée gratuite à une par jour', () => {
    expect(canStartSosPause(FREE_ENTITLEMENTS, 0)).toBe(true);
    expect(canStartSosPause(FREE_ENTITLEMENTS, 1)).toBe(false);
    expect(canStartSosPause({ plan: 'premium' }, 5)).toBe(true);
  });

  it('formule un bilan sans promettre la disparition de l’envie', () => {
    for (const [before, after] of [
      [8, 3],
      [6, 5],
      [5, 5],
      [4, 7],
    ] as const) {
      const { message } = intensityFeedback(before, after);
      expect(message).not.toMatch(/dispar/i);
    }
  });

  it('calcule les moyennes en ignorant les sessions interrompues', () => {
    expect(
      averageIntensities([
        { intensityBefore: 8, intensityAfter: 4 },
        { intensityBefore: 6, intensityAfter: null },
        { intensityBefore: 6, intensityAfter: 4 },
      ]),
    ).toEqual({ before: 7, after: 4, count: 2 });
    expect(averageIntensities([])).toBeNull();
  });
});
