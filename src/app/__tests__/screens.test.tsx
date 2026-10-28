/* eslint-disable @typescript-eslint/no-require-imports -- les écrans sont chargés après la mise en place des mocks */
/**
 * Tests de fumée : chaque écran se rend sans erreur avec un état réaliste,
 * et les actions principales déclenchent les bonnes opérations.
 */
import { cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type { Snapshot } from '@/db/repository';
import { addDays, dateRange, toDateKey } from '@/domain/dates';
import { goalForDate, upcomingGoal } from '@/domain/goals';
import { FREE_ENTITLEMENTS } from '@/domain/premium';
import { nextTierProgress, tierByDays, tierForStreak } from '@/domain/rewards';
import { computeStreak, protectableDays } from '@/domain/streak';
import { pendingValidationDays } from '@/domain/validation';

// expo-router/testing-library remplace Reanimated par son mock officiel, qui
// échoue sous Jest avec cette version et laisse un module vide : on le
// complète avec le mock local (voir jest/reanimated-mock.js).
Object.assign(require('react-native-reanimated'), require('../../../jest/reanimated-mock'));

jest.mock('@/services/notifications', () => ({
  getPermissionState: jest.fn(async () => 'granted'),
  requestPermission: jest.fn(async () => 'granted'),
  parseNotificationResponse: jest.fn(),
  dismissNotification: jest.fn(),
}));

const now = new Date();
const today = toDateKey(now);
const start = addDays(today, -20);

function buildApp(overrides: Partial<Snapshot> = {}) {
  const snapshot: Snapshot = {
    profile: {
      startDate: start,
      onboardingCompleted: true,
      cravingMoment: 'evening',
      reminderHour: 21,
      reminderMinute: 0,
      notificationsEnabled: true,
    },
    goals: [{ id: 1, type: 'desserts', customLabel: null, effectiveFrom: start }],
    entries: [
      ...dateRange(addDays(today, -12), addDays(today, -4)).map((date) => ({
        date,
        status: 'success' as const,
        goalId: 1,
        recordedAt: '',
        updatedAt: '',
        correctionCount: 0,
      })),
      { date: addDays(today, -3), status: 'failure', goalId: 1, recordedAt: '', updatedAt: '', correctionCount: 0 },
    ],
    jokerUses: [],
    sosSessions: [
      {
        id: 1,
        date: addDays(today, -2),
        startedAt: now.toISOString(),
        endedAt: now.toISOString(),
        intensityBefore: 8,
        intensityAfter: 4,
        plannedSeconds: 90,
        elapsedSeconds: 90,
        completed: true,
      },
    ],
    rewards: [{ tierDays: 3, unlockedAt: now.toISOString(), celebratedAt: now.toISOString() }],
    ...overrides,
  };
  const profile = snapshot.profile;
  const input = { startDate: profile?.startDate ?? today, today, entries: snapshot.entries, jokerUses: snapshot.jokerUses };
  const streak = profile ? computeStreak(input) : null;
  return {
    ready: true,
    error: null,
    snapshot,
    now,
    today,
    entitlements: FREE_ENTITLEMENTS,
    profile,
    streak,
    currentGoal: goalForDate(snapshot.goals, today),
    scheduledGoal: upcomingGoal(snapshot.goals, today),
    flameTier: tierForStreak(streak?.current ?? 0),
    next: nextTierProgress(streak?.current ?? 0),
    pendingDays: profile
      ? pendingValidationDays({
          startDate: profile.startDate,
          now,
          recordedDates: new Set(snapshot.entries.map((entry) => entry.date)),
        })
      : [],
    protectable: profile ? protectableDays(input) : [],
    unlockedTierDays: new Set(snapshot.rewards.map((reward) => reward.tierDays)),
    uncelebrated: snapshot.rewards
      .filter((reward) => !reward.celebratedAt)
      .map((reward) => tierByDays(reward.tierDays)!)
      .filter(Boolean),
    sosToday: 0,
    canStartSos: true,
    refresh: jest.fn(),
    completeOnboarding: jest.fn(async () => undefined),
    record: jest.fn(async () => ({ decision: { ok: true, kind: 'create' }, newTiers: [], refundedJoker: false })),
    postpone: jest.fn(async () => null),
    applyJoker: jest.fn(async () => ({ eligibility: { ok: true }, newTiers: [] })),
    saveSos: jest.fn(async () => undefined),
    setReminderTime: jest.fn(async () => undefined),
    setNotificationsEnabled: jest.fn(async () => 'granted'),
    changeGoal: jest.fn(async () => addDays(today, 1)),
    cancelGoalChange: jest.fn(async () => undefined),
    markCelebrated: jest.fn(async () => undefined),
    resetAll: jest.fn(async () => undefined),
  };
}

let mockApp = buildApp();
jest.mock('@/state/AppProvider', () => ({ useApp: () => mockApp }));

const routes = {
  index: require('../index').default,
  onboarding: require('../onboarding').default,
  sos: require('../sos').default,
  validation: require('../validation').default,
  celebration: require('../celebration').default,
  progress: require('../progress').default,
  rewards: require('../rewards').default,
  settings: require('../settings').default,
  rules: require('../rules').default,
  legal: require('../legal').default,
};

beforeEach(() => {
  mockApp = buildApp();
});

afterEach(async () => {
  await cleanup();
});

describe('écrans', () => {
  it("l'accueil affiche la série, le bouton SOS et les accès", async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText("J'ai envie de sucre")).toBeTruthy();
    expect(screen.getByText('Les 7 derniers jours')).toBeTruthy();
    expect(screen.getByText('Progression')).toBeTruthy();
    expect(screen.getByText('Récompenses')).toBeTruthy();
    // Le 3e jour avant aujourd'hui est un « pas aujourd'hui » : la série repart de 0.
    expect(screen.getByText('0 jour')).toBeTruthy();
  });

  it("redirige vers l'onboarding sans profil", async () => {
    mockApp = buildApp({ profile: null });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Réduis tes envies de sucre, un jour à la fois.')).toBeTruthy();
  });

  it("l'onboarding parcourt les cinq étapes", async () => {
    mockApp = buildApp({ profile: null });
    await renderRouter(routes, { initialUrl: '/onboarding' });
    await fireEvent.press(await screen.findByText('Commencer'));
    await fireEvent.press(await screen.findByText('Réduire les boissons sucrées'));
    await fireEvent.press(screen.getByText('Continuer'));
    await fireEvent.press(await screen.findByText('Le soir'));
    await fireEvent.press(screen.getByText('Continuer'));
    expect(await screen.findByText('Les jokers')).toBeTruthy();
    await fireEvent.press(screen.getByText('Continuer'));
    expect(await screen.findByText('21 h 00')).toBeTruthy();
    expect(screen.getByText('Activer le rappel')).toBeTruthy();
  });

  it('le SOS demande l’intensité avant de lancer la pause', async () => {
    await renderRouter(routes, { initialUrl: '/sos' });
    expect(await screen.findByText('Une envie de sucre ?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('7 sur 10'));
    await fireEvent.press(screen.getByText('Commencer la pause'));
    expect(await screen.findByText('1:30')).toBeTruthy();
    expect(screen.getByText('Pause')).toBeTruthy();
  });

  it('le SOS gratuit est limité à une pause guidée par jour', async () => {
    mockApp = { ...buildApp(), canStartSos: false };
    await renderRouter(routes, { initialUrl: '/sos' });
    expect(await screen.findByText('Ta pause guidée du jour est déjà utilisée')).toBeTruthy();
  });

  it('la validation enregistre la réponse choisie', async () => {
    const yesterday = addDays(today, -1);
    await renderRouter(routes, { initialUrl: `/validation?date=${yesterday}` });
    await fireEvent.press(await screen.findByText('Oui, objectif respecté'));
    expect(await screen.findByText('Bravo, objectif respecté !')).toBeTruthy();
    expect(mockApp.record).toHaveBeenCalledWith(yesterday, 'success');
  });

  it('la validation affiche le résultat d’une action rapide de notification', async () => {
    await renderRouter(routes, { initialUrl: `/validation?date=${addDays(today, -1)}&saved=failure` });
    expect(await screen.findByText('Merci pour ton honnêteté')).toBeTruthy();
  });

  it('la progression affiche les statistiques et le calendrier', async () => {
    await renderRouter(routes, { initialUrl: '/progress' });
    expect(await screen.findByText('Série actuelle')).toBeTruthy();
    expect(screen.getByText('Pauses SOS')).toBeTruthy();
    expect(screen.getByText(/En moyenne, ton envie passe de/)).toBeTruthy();
  });

  it('la progression gère l’absence de données', async () => {
    mockApp = buildApp({ entries: [], sosSessions: [], rewards: [] });
    await renderRouter(routes, { initialUrl: '/progress' });
    expect(await screen.findByText('Aucune pause pour le moment')).toBeTruthy();
    expect(screen.getByText('Pas encore de badge')).toBeTruthy();
  });

  it('les récompenses listent les six paliers', async () => {
    await renderRouter(routes, { initialUrl: '/rewards' });
    for (const name of ['Étincelle', 'Petite flamme', 'Feu grandissant', 'Brasier', 'Feu violet', 'Flamme légendaire']) {
      expect(await screen.findByText(name)).toBeTruthy();
    }
  });

  it('les réglages proposent objectif, rappel, règles et suppression', async () => {
    await renderRouter(routes, { initialUrl: '/settings' });
    expect(await screen.findByText('Modifier l’objectif')).toBeTruthy();
    expect(screen.getByText('Notification quotidienne')).toBeTruthy();
    expect(screen.getByText('Règles des séries')).toBeTruthy();
    expect(screen.getByText('Supprimer mes données')).toBeTruthy();
  });

  it('la célébration affiche le nouveau palier', async () => {
    mockApp = buildApp({ rewards: [{ tierDays: 7, unlockedAt: now.toISOString(), celebratedAt: null }] });
    await renderRouter(routes, { initialUrl: '/celebration' });
    expect(await screen.findByText('Petite flamme')).toBeTruthy();
  });

  it('les pages d’information s’affichent', async () => {
    await renderRouter(routes, { initialUrl: '/rules' });
    expect(await screen.findByText('Les jokers')).toBeTruthy();
    await renderRouter(routes, { initialUrl: '/legal?doc=privacy' });
    expect(await screen.findByText('Données stockées')).toBeTruthy();
  });
});
