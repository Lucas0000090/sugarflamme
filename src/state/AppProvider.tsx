import { useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import * as repo from '@/db/repository';
import { DateKey, toDateKey } from '@/domain/dates';
import { CravingMoment, Goal, goalForDate, GoalType, upcomingGoal } from '@/domain/goals';
import { canStartSosPause, Entitlements, FREE_ENTITLEMENTS, hasFeature } from '@/domain/premium';
import { displayedTier, nextTierProgress, RewardTier, tierByDays } from '@/domain/rewards';
import { computeStreak, EntryStatus, protectableDays, StreakInput, StreakSummary } from '@/domain/streak';
import { pendingValidationDays } from '@/domain/validation';
import * as notifications from '@/services/notifications';
import * as purchases from '@/services/purchases';

interface AppContextValue {
  ready: boolean;
  error: Error | null;
  snapshot: repo.Snapshot;
  now: Date;
  today: DateKey;
  entitlements: Entitlements;
  isPremium: boolean;
  /** Les achats intégrés sont-ils configurés sur cette version ? */
  purchasesAvailable: boolean;
  /** Met à jour les droits (après un achat ou une restauration). */
  setEntitlements: (entitlements: Entitlements) => void;
  setFlamePreference: (tierDays: number | null) => Promise<void>;
  profile: repo.Profile | null;
  streak: StreakSummary | null;
  currentGoal: Goal | null;
  scheduledGoal: Goal | null;
  flameTier: RewardTier;
  next: ReturnType<typeof nextTierProgress>;
  pendingDays: DateKey[];
  protectable: DateKey[];
  unlockedTierDays: ReadonlySet<number>;
  uncelebrated: RewardTier[];
  sosToday: number;
  canStartSos: boolean;
  refresh: () => Promise<void>;
  completeOnboarding: (params: {
    goalType: GoalType;
    customLabel: string | null;
    cravingMoment: CravingMoment;
    reminderHour: number;
    reminderMinute: number;
    notificationsEnabled: boolean;
  }) => Promise<void>;
  record: (date: DateKey, status: EntryStatus) => Promise<repo.RecordResult>;
  postpone: (date: DateKey) => Promise<Date | null>;
  applyJoker: (date: DateKey) => Promise<Awaited<ReturnType<typeof repo.applyJoker>>>;
  saveSos: (session: Omit<repo.SosSession, 'id'>) => Promise<void>;
  setReminderTime: (hour: number, minute: number) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<notifications.PermissionState>;
  changeGoal: (type: GoalType, customLabel: string | null) => Promise<DateKey>;
  cancelGoalChange: () => Promise<void>;
  markCelebrated: (tierDays: number[]) => Promise<void>;
  resetAll: () => Promise<void>;
}

const EMPTY_SNAPSHOT: repo.Snapshot = {
  profile: null,
  goals: [],
  entries: [],
  jokerUses: [],
  sosSessions: [],
  rewards: [],
};

const AppContext = createContext<AppContextValue | null>(null);

/** Horloge qui suit le passage à minuit et le retour au premier plan. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Ne change d'identité qu'au changement de minute : évite des rendus inutiles.
    const tick = () =>
      setNow((previous) => {
        const next = new Date();
        return Math.floor(next.getTime() / 60_000) === Math.floor(previous.getTime() / 60_000) ? previous : next;
      });
    const interval = setInterval(tick, 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
  return now;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<repo.Snapshot>(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const now = useNow();
  const [entitlements, setEntitlements] = useState<Entitlements>(FREE_ENTITLEMENTS);
  const [purchasesReady, setPurchasesReady] = useState(false);

  // Abonnement : état initial (mis en cache par RevenueCat, disponible hors ligne) puis mises à jour.
  useEffect(() => {
    if (!purchases.configurePurchases()) return;
    let active = true;
    void purchases.fetchEntitlements().then((value) => {
      if (!active) return;
      setEntitlements(value);
      setPurchasesReady(true);
    });
    const unsubscribe = purchases.onEntitlementsChange((value) => {
      if (active) setEntitlements(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const today = toDateKey(now);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await repo.loadSnapshot(db));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setReady(true);
    }
  }, [db]);

  useEffect(() => {
    void notifications.configureNotifications();
    let cancelled = false;
    repo.loadSnapshot(db).then(
      (loaded) => {
        if (cancelled) return;
        setSnapshot(loaded);
        setReady(true);
      },
      (caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  const { profile } = snapshot;

  const recordedDates = useMemo(() => new Set(snapshot.entries.map((entry) => entry.date)), [snapshot.entries]);

  // Les rappels suivent toujours l'état réel de la base.
  useEffect(() => {
    if (!profile?.onboardingCompleted) return;
    void notifications.syncReminders({
      enabled: profile.notificationsEnabled,
      hour: profile.reminderHour,
      minute: profile.reminderMinute,
      startDate: profile.startDate,
      recordedDates,
      now: new Date(),
    });
  }, [profile, recordedDates, today]);

  const derived = useMemo(() => {
    const instant = new Date();
    const streakInput: StreakInput | null = profile
      ? { startDate: profile.startDate, today, entries: snapshot.entries, jokerUses: snapshot.jokerUses }
      : null;
    const streak = streakInput ? computeStreak(streakInput) : null;
    const current = streak?.current ?? 0;
    const unlockedTierDays = new Set(snapshot.rewards.map((reward) => reward.tierDays));
    const uncelebrated = snapshot.rewards
      .filter((reward) => reward.celebratedAt === null)
      .map((reward) => tierByDays(reward.tierDays))
      .filter((tier): tier is RewardTier => tier !== undefined);
    const sosToday = snapshot.sosSessions.filter((session) => session.date === today).length;
    const flameTier = displayedTier({
      streak: current,
      preference: profile?.flamePreference ?? null,
      unlocked: unlockedTierDays,
      canCustomize: hasFeature(entitlements, 'flame-customization'),
    });
    return {
      streak,
      currentGoal: goalForDate(snapshot.goals, today),
      scheduledGoal: upcomingGoal(snapshot.goals, today),
      flameTier,
      next: nextTierProgress(current),
      pendingDays: profile ? pendingValidationDays({ startDate: profile.startDate, now: instant, recordedDates }) : [],
      protectable: streakInput ? protectableDays(streakInput) : [],
      unlockedTierDays,
      uncelebrated,
      sosToday,
      canStartSos: canStartSosPause(entitlements, sosToday),
    };
    // `now` force le recalcul à chaque minute (ouverture de la validation à 18 h).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, profile, today, recordedDates, now, entitlements]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      error,
      snapshot,
      now,
      today,
      entitlements,
      isPremium: entitlements.plan === 'premium',
      purchasesAvailable: purchasesReady || purchases.purchasesAvailable(),
      setEntitlements,
      setFlamePreference: async (tierDays) => {
        await repo.setFlamePreference(db, tierDays);
        await refresh();
      },
      profile,
      ...derived,
      refresh,
      completeOnboarding: async (params) => {
        await repo.completeOnboarding(db, { ...params, now: new Date() });
        await refresh();
      },
      record: async (date, status) => {
        const result = await repo.recordDay(db, { date, status, now: new Date() });
        if (result.decision.ok) await notifications.cancelLaterReminder(date);
        await refresh();
        return result;
      },
      postpone: (date) => notifications.scheduleLaterReminder(date, new Date()),
      applyJoker: async (date) => {
        const result = await repo.applyJoker(db, { date, now: new Date() });
        await refresh();
        return result;
      },
      saveSos: async (session) => {
        await repo.saveSosSession(db, session);
        await refresh();
      },
      setReminderTime: async (hour, minute) => {
        await repo.updateReminder(db, { hour, minute });
        await refresh();
      },
      setNotificationsEnabled: async (enabled) => {
        if (!enabled) {
          await repo.updateReminder(db, { enabled: false });
          await notifications.cancelAllReminders();
          await refresh();
          return notifications.getPermissionState();
        }
        const permission = await notifications.requestPermission();
        await repo.updateReminder(db, { enabled: permission === 'granted' });
        await refresh();
        return permission;
      },
      changeGoal: async (type, customLabel) => {
        const effectiveFrom = await repo.scheduleGoalChange(db, { type, customLabel, now: new Date() });
        await refresh();
        return effectiveFrom;
      },
      cancelGoalChange: async () => {
        await repo.cancelScheduledGoalChange(db, new Date());
        await refresh();
      },
      markCelebrated: async (tierDays) => {
        await repo.markRewardsCelebrated(db, tierDays, new Date());
        await refresh();
      },
      resetAll: async () => {
        await notifications.cancelAllReminders();
        await repo.resetAllData(db);
        await refresh();
      },
    }),
    [ready, error, snapshot, now, today, profile, derived, refresh, db, entitlements, purchasesReady],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp doit être utilisé dans <AppProvider>');
  return context;
}
