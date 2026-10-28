/**
 * Accès aux données locales. Les opérations critiques passent par des
 * transactions exclusives : lecture de l'état, contrôle des règles métier
 * et écriture se font de façon atomique.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, DateKey, toDateKey } from '@/domain/dates';
import { CravingMoment, Goal, goalForDate, GoalType } from '@/domain/goals';
import { newlyReachedTiers, RewardTier } from '@/domain/rewards';
import { canUseJoker, computeStreak, DayEntry, EntryStatus, JokerEligibility, JokerUse } from '@/domain/streak';
import { decideRecord, RecordDecision } from '@/domain/validation';

export interface Profile {
  startDate: DateKey;
  onboardingCompleted: boolean;
  cravingMoment: CravingMoment;
  reminderHour: number;
  reminderMinute: number;
  notificationsEnabled: boolean;
}

export interface StoredDayEntry extends DayEntry {
  goalId: number | null;
  recordedAt: string;
  updatedAt: string;
  correctionCount: number;
}

export interface SosSession {
  id: number;
  date: DateKey;
  startedAt: string;
  endedAt: string;
  intensityBefore: number;
  intensityAfter: number | null;
  plannedSeconds: number;
  elapsedSeconds: number;
  completed: boolean;
}

export interface UnlockedReward {
  tierDays: number;
  unlockedAt: string;
  celebratedAt: string | null;
}

export interface Snapshot {
  profile: Profile | null;
  goals: Goal[];
  entries: StoredDayEntry[];
  jokerUses: JokerUse[];
  sosSessions: SosSession[];
  rewards: UnlockedReward[];
}

type ProfileRow = {
  start_date: string;
  onboarding_completed_at: string | null;
  craving_moment: CravingMoment;
  reminder_hour: number;
  reminder_minute: number;
  notifications_enabled: number;
};

export async function loadSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const profileRow = await db.getFirstAsync<ProfileRow>('SELECT * FROM profile WHERE id = 1');
  const goals = await db.getAllAsync<{ id: number; type: GoalType; custom_label: string | null; effective_from: string }>(
    'SELECT id, type, custom_label, effective_from FROM goals ORDER BY effective_from',
  );
  const entries = await db.getAllAsync<{
    date: string;
    status: EntryStatus;
    goal_id: number | null;
    recorded_at: string;
    updated_at: string;
    correction_count: number;
  }>('SELECT * FROM day_entries ORDER BY date');
  const jokers = await db.getAllAsync<{ protected_date: string; used_on: string }>(
    "SELECT protected_date, used_on FROM joker_movements WHERE kind = 'used' ORDER BY id",
  );
  const sessions = await db.getAllAsync<{
    id: number;
    date: string;
    started_at: string;
    ended_at: string;
    intensity_before: number;
    intensity_after: number | null;
    planned_seconds: number;
    elapsed_seconds: number;
    completed: number;
  }>('SELECT * FROM sos_sessions ORDER BY started_at');
  const rewards = await db.getAllAsync<{ tier_days: number; unlocked_at: string; celebrated_at: string | null }>(
    'SELECT * FROM rewards ORDER BY tier_days',
  );

  return {
    profile: profileRow
      ? {
          startDate: profileRow.start_date,
          onboardingCompleted: profileRow.onboarding_completed_at !== null,
          cravingMoment: profileRow.craving_moment,
          reminderHour: profileRow.reminder_hour,
          reminderMinute: profileRow.reminder_minute,
          notificationsEnabled: profileRow.notifications_enabled === 1,
        }
      : null,
    goals: goals.map((row) => ({
      id: row.id,
      type: row.type,
      customLabel: row.custom_label,
      effectiveFrom: row.effective_from,
    })),
    entries: entries.map((row) => ({
      date: row.date,
      status: row.status,
      goalId: row.goal_id,
      recordedAt: row.recorded_at,
      updatedAt: row.updated_at,
      correctionCount: row.correction_count,
    })),
    jokerUses: jokers.map((row) => ({ protectedDate: row.protected_date, usedOn: row.used_on })),
    sosSessions: sessions.map((row) => ({
      id: row.id,
      date: row.date,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      intensityBefore: row.intensity_before,
      intensityAfter: row.intensity_after,
      plannedSeconds: row.planned_seconds,
      elapsedSeconds: row.elapsed_seconds,
      completed: row.completed === 1,
    })),
    rewards: rewards.map((row) => ({
      tierDays: row.tier_days,
      unlockedAt: row.unlocked_at,
      celebratedAt: row.celebrated_at,
    })),
  };
}

export async function completeOnboarding(
  db: SQLiteDatabase,
  params: {
    goalType: GoalType;
    customLabel: string | null;
    cravingMoment: CravingMoment;
    reminderHour: number;
    reminderMinute: number;
    notificationsEnabled: boolean;
    now: Date;
  },
): Promise<void> {
  const nowIso = params.now.toISOString();
  const today = toDateKey(params.now);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO profile (id, created_at, start_date, onboarding_completed_at, craving_moment,
         reminder_hour, reminder_minute, notifications_enabled)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         onboarding_completed_at = excluded.onboarding_completed_at,
         craving_moment = excluded.craving_moment,
         reminder_hour = excluded.reminder_hour,
         reminder_minute = excluded.reminder_minute,
         notifications_enabled = excluded.notifications_enabled`,
      [
        nowIso,
        today,
        nowIso,
        params.cravingMoment,
        params.reminderHour,
        params.reminderMinute,
        params.notificationsEnabled ? 1 : 0,
      ],
    );
    await upsertGoal(txn, params.goalType, params.customLabel, today, nowIso);
  });
}

async function upsertGoal(
  db: SQLiteDatabase,
  type: GoalType,
  customLabel: string | null,
  effectiveFrom: DateKey,
  nowIso: string,
) {
  await db.runAsync(
    `INSERT INTO goals (type, custom_label, effective_from, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(effective_from) DO UPDATE SET type = excluded.type, custom_label = excluded.custom_label,
       created_at = excluded.created_at`,
    [type, type === 'custom' ? customLabel?.trim() || null : null, effectiveFrom, nowIso],
  );
}

/** Nouvel objectif, applicable à partir du lendemain. */
export async function scheduleGoalChange(
  db: SQLiteDatabase,
  params: { type: GoalType; customLabel: string | null; now: Date },
): Promise<DateKey> {
  const effectiveFrom = addDays(toDateKey(params.now), 1);
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Un seul changement programmé à la fois : le dernier choix fait foi.
    await txn.runAsync('DELETE FROM goals WHERE effective_from > ?', [effectiveFrom]);
    await upsertGoal(txn, params.type, params.customLabel, effectiveFrom, params.now.toISOString());
  });
  return effectiveFrom;
}

export async function cancelScheduledGoalChange(db: SQLiteDatabase, now: Date): Promise<void> {
  await db.runAsync('DELETE FROM goals WHERE effective_from > ?', [toDateKey(now)]);
}

async function readHistory(db: SQLiteDatabase) {
  const profile = await db.getFirstAsync<{ start_date: string }>('SELECT start_date FROM profile WHERE id = 1');
  if (!profile) throw new Error('Profil introuvable');
  const entries = await db.getAllAsync<DayEntry>('SELECT date, status FROM day_entries');
  const uses = await db.getAllAsync<{ protected_date: string; used_on: string }>(
    "SELECT protected_date, used_on FROM joker_movements WHERE kind = 'used'",
  );
  return {
    startDate: profile.start_date,
    entries,
    jokerUses: uses.map((row) => ({ protectedDate: row.protected_date, usedOn: row.used_on })),
  };
}

/** Débloque de façon permanente les badges atteints par le record. */
async function syncRewards(db: SQLiteDatabase, now: Date): Promise<RewardTier[]> {
  const history = await readHistory(db);
  const { best } = computeStreak({ ...history, today: toDateKey(now) });
  const unlocked = await db.getAllAsync<{ tier_days: number }>('SELECT tier_days FROM rewards');
  const tiers = newlyReachedTiers(best, new Set(unlocked.map((row) => row.tier_days)));
  for (const tier of tiers) {
    await db.runAsync('INSERT OR IGNORE INTO rewards (tier_days, unlocked_at) VALUES (?, ?)', [
      tier.days,
      now.toISOString(),
    ]);
  }
  return tiers;
}

export type RecordResult = { decision: RecordDecision; newTiers: RewardTier[]; refundedJoker: boolean };

/**
 * Enregistre (ou corrige) le bilan d'une journée.
 * Une seule ligne par jour (clé primaire sur la date).
 */
export async function recordDay(
  db: SQLiteDatabase,
  params: { date: DateKey; status: EntryStatus; now: Date },
): Promise<RecordResult> {
  const { date, status, now } = params;
  let result: RecordResult = { decision: { ok: false, reason: 'expired' }, newTiers: [], refundedJoker: false };

  await db.withExclusiveTransactionAsync(async (txn) => {
    const profile = await txn.getFirstAsync<{ start_date: string }>('SELECT start_date FROM profile WHERE id = 1');
    if (!profile) throw new Error('Profil introuvable');
    const existing = await txn.getFirstAsync<{ status: EntryStatus }>('SELECT status FROM day_entries WHERE date = ?', [
      date,
    ]);
    const decision = decideRecord({ date, status, existing: existing?.status ?? null, startDate: profile.start_date, now });
    result = { decision, newTiers: [], refundedJoker: false };
    if (!decision.ok || decision.kind === 'unchanged') return;

    const nowIso = now.toISOString();
    if (decision.kind === 'create') {
      const goals = await txn.getAllAsync<{ id: number; effective_from: string }>('SELECT id, effective_from FROM goals');
      const goal = goalForDate(
        goals.map((row) => ({ id: row.id, effectiveFrom: row.effective_from })),
        date,
      );
      await txn.runAsync(
        'INSERT INTO day_entries (date, status, goal_id, recorded_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [date, status, goal?.id ?? null, nowIso, nowIso],
      );
    } else {
      await txn.runAsync(
        'UPDATE day_entries SET status = ?, updated_at = ?, correction_count = correction_count + 1 WHERE date = ?',
        [status, nowIso, date],
      );
    }

    // Une journée corrigée en réussite n'a plus besoin de joker : il est rendu.
    if (status === 'success') {
      const deleted = await txn.runAsync('DELETE FROM joker_movements WHERE protected_date = ?', [date]);
      result.refundedJoker = deleted.changes > 0;
    }
    result.newTiers = await syncRewards(txn, now);
  });

  return result;
}

export async function applyJoker(
  db: SQLiteDatabase,
  params: { date: DateKey; now: Date },
): Promise<{ eligibility: JokerEligibility; newTiers: RewardTier[] }> {
  let outcome: { eligibility: JokerEligibility; newTiers: RewardTier[] } = {
    eligibility: { ok: false, reason: 'no-joker' },
    newTiers: [],
  };
  await db.withExclusiveTransactionAsync(async (txn) => {
    const history = await readHistory(txn);
    const today = toDateKey(params.now);
    const eligibility = canUseJoker({ ...history, today }, params.date);
    outcome = { eligibility, newTiers: [] };
    if (!eligibility.ok) return;
    await txn.runAsync(
      "INSERT INTO joker_movements (kind, protected_date, used_on, created_at) VALUES ('used', ?, ?, ?)",
      [params.date, today, params.now.toISOString()],
    );
    outcome.newTiers = await syncRewards(txn, params.now);
  });
  return outcome;
}

export async function saveSosSession(db: SQLiteDatabase, session: Omit<SosSession, 'id'>): Promise<void> {
  await db.runAsync(
    `INSERT INTO sos_sessions (date, started_at, ended_at, intensity_before, intensity_after,
       planned_seconds, elapsed_seconds, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.date,
      session.startedAt,
      session.endedAt,
      session.intensityBefore,
      session.intensityAfter,
      session.plannedSeconds,
      session.elapsedSeconds,
      session.completed ? 1 : 0,
    ],
  );
}

export async function updateReminder(
  db: SQLiteDatabase,
  params: { hour?: number; minute?: number; enabled?: boolean },
): Promise<void> {
  const sets: string[] = [];
  const values: (number | string)[] = [];
  if (params.hour !== undefined) {
    sets.push('reminder_hour = ?');
    values.push(params.hour);
  }
  if (params.minute !== undefined) {
    sets.push('reminder_minute = ?');
    values.push(params.minute);
  }
  if (params.enabled !== undefined) {
    sets.push('notifications_enabled = ?');
    values.push(params.enabled ? 1 : 0);
  }
  if (sets.length === 0) return;
  await db.runAsync(`UPDATE profile SET ${sets.join(', ')} WHERE id = 1`, values);
}

export async function markRewardsCelebrated(db: SQLiteDatabase, tierDays: readonly number[], now: Date) {
  if (tierDays.length === 0) return;
  await db.runAsync(
    `UPDATE rewards SET celebrated_at = ? WHERE celebrated_at IS NULL AND tier_days IN (${tierDays.map(() => '?').join(',')})`,
    [now.toISOString(), ...tierDays],
  );
}

/** Supprime toutes les données de l'utilisateur (le schéma est conservé). */
export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      DELETE FROM day_entries;
      DELETE FROM joker_movements;
      DELETE FROM sos_sessions;
      DELETE FROM rewards;
      DELETE FROM goals;
      DELETE FROM profile;
    `);
  });
}
