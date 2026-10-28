import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migrations versionnées. Ne jamais modifier une migration publiée :
 * ajouter une nouvelle entrée à la fin du tableau.
 */
export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        created_at TEXT NOT NULL,
        start_date TEXT NOT NULL,
        onboarding_completed_at TEXT,
        craving_moment TEXT NOT NULL DEFAULT 'variable'
          CHECK (craving_moment IN ('morning', 'after-lunch', 'afternoon', 'evening', 'variable')),
        reminder_hour INTEGER NOT NULL DEFAULT 21 CHECK (reminder_hour BETWEEN 18 AND 23),
        reminder_minute INTEGER NOT NULL DEFAULT 0 CHECK (reminder_minute BETWEEN 0 AND 59),
        notifications_enabled INTEGER NOT NULL DEFAULT 0 CHECK (notifications_enabled IN (0, 1))
      );

      CREATE TABLE goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('between-meals', 'desserts', 'drinks', 'custom')),
        custom_label TEXT,
        effective_from TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE day_entries (
        date TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
        goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        recorded_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        correction_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE sos_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        intensity_before INTEGER NOT NULL CHECK (intensity_before BETWEEN 1 AND 10),
        intensity_after INTEGER CHECK (intensity_after IS NULL OR intensity_after BETWEEN 1 AND 10),
        planned_seconds INTEGER NOT NULL,
        elapsed_seconds INTEGER NOT NULL,
        completed INTEGER NOT NULL CHECK (completed IN (0, 1))
      );
      CREATE INDEX idx_sos_sessions_date ON sos_sessions(date);

      -- Mouvements de jokers. Les gains sont recalculés depuis l'historique
      -- (voir src/domain/streak.ts) ; seules les utilisations, qui sont des
      -- actions explicites, sont stockées.
      CREATE TABLE joker_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('used')),
        protected_date TEXT NOT NULL UNIQUE,
        used_on TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE rewards (
        tier_days INTEGER PRIMARY KEY NOT NULL,
        unlocked_at TEXT NOT NULL,
        celebrated_at TEXT
      );
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/** Applique les migrations manquantes, chacune dans sa propre transaction. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const row = await db.getFirstAsync<{ version: number | null }>('SELECT MAX(version) AS version FROM schema_migrations');
  const current = row?.version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.sql);
      await txn.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
        migration.version,
        new Date().toISOString(),
      ]);
    });
  }
}
