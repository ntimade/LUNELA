import * as SQLite from 'expo-sqlite';

const DB_NAME    = 'lunela.db';
const DB_VERSION = 2;          // ← bumped à 2 pour corriger quiz_progress & badges

let _db = null;

export const getDb = async () => {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await initSchema(_db);
  return _db;
};

// ─── Schéma ───────────────────────────────────────────────────────────────────
const initSchema = async (db) => {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const row            = await db.getFirstAsync(`SELECT version FROM schema_version LIMIT 1`);
  const currentVersion = row?.version ?? 0;

  if (currentVersion < DB_VERSION) {
    await runMigrations(db, currentVersion);
    await db.runAsync(
      `INSERT OR REPLACE INTO schema_version (version) VALUES (?)`,
      [DB_VERSION]
    );
  }
};

// ─── Migrations ───────────────────────────────────────────────────────────────
const runMigrations = async (db, fromVersion) => {
  if (fromVersion < 1) await migrate_v1(db);
  if (fromVersion < 2) await migrate_v2(db);
};

// ── v1 : tables de base ───────────────────────────────────────────────────────
const migrate_v1 = async (db) => {
  await db.execAsync(`

    -- Cycles menstruels (profil fille)
    CREATE TABLE IF NOT EXISTS cycles (
      id          TEXT PRIMARY KEY,
      start_date  TEXT NOT NULL,
      end_date    TEXT,
      notes       TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL DEFAULT 0,
      synced_at   INTEGER
    );

    -- Paramètres du cycle (profil fille)
    CREATE TABLE IF NOT EXISTS cycle_settings (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      cycle_length   INTEGER NOT NULL DEFAULT 28,
      period_length  INTEGER NOT NULL DEFAULT 5,
      remind_before  INTEGER NOT NULL DEFAULT 2,
      updated_at     INTEGER NOT NULL,
      synced_at      INTEGER
    );

    -- Journal de symptômes (profil fille)
    CREATE TABLE IF NOT EXISTS symptoms (
      id              TEXT PRIMARY KEY,
      date            TEXT NOT NULL,
      mood            TEXT,
      pain            INTEGER NOT NULL DEFAULT 0,
      pain_intensity  INTEGER NOT NULL DEFAULT 0,
      fatigue         INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      synced_at       INTEGER
    );

    -- Suivi quotidien santé (profil garçon)
    CREATE TABLE IF NOT EXISTS health_entries (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      mood        INTEGER NOT NULL DEFAULT 5,
      stress      INTEGER NOT NULL DEFAULT 5,
      energy      INTEGER NOT NULL DEFAULT 5,
      notes       TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      synced_at   INTEGER
    );

    -- Cache contenu éducatif (fille + garçon + professionnel)
    CREATE TABLE IF NOT EXISTS educational_content (
      id              TEXT PRIMARY KEY,
      target_profile  TEXT NOT NULL,
      category        TEXT NOT NULL,
      title           TEXT NOT NULL,
      body            TEXT NOT NULL,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      cached_at       INTEGER NOT NULL
    );

  `);
};

// ── v2 : correction schéma quiz_progress & badges ─────────────────────────────
// Les colonnes de v1 étaient incorrectes par rapport à useQuiz.js.
// On DROP + RECREATE (pas de données utilisateur à préserver au premier lancement).
const migrate_v2 = async (db) => {
  await db.execAsync(`

    -- Suppression de l'ancienne table quiz_progress si elle existe
    DROP TABLE IF EXISTS quiz_progress;

    -- Progression quiz globale par utilisateur (profil garçon)
    -- Une seule ligne par uid : id = "qp_{uid}"
    CREATE TABLE IF NOT EXISTS quiz_progress (
      id                TEXT PRIMARY KEY,
      total_quizzes     INTEGER NOT NULL DEFAULT 0,
      total_points      INTEGER NOT NULL DEFAULT 0,
      perfect_scores    INTEGER NOT NULL DEFAULT 0,
      streak            INTEGER NOT NULL DEFAULT 0,
      last_quiz_date    TEXT,
      completed_topics  TEXT NOT NULL DEFAULT '[]',   -- JSON array de topic IDs
      earned_badges     TEXT NOT NULL DEFAULT '[]',   -- JSON array de badge IDs
      created_at        INTEGER NOT NULL DEFAULT 0,
      updated_at        INTEGER NOT NULL DEFAULT 0,
      synced_at         INTEGER
    );

    -- Suppression de l'ancienne table badges si elle existe
    DROP TABLE IF EXISTS badges;

    -- Badges individuels gagnés (profil garçon)
    -- id = "badge_{uid}_{badgeId}"
    CREATE TABLE IF NOT EXISTS badges (
      id          TEXT PRIMARY KEY,
      badge_id    TEXT NOT NULL,
      earned_at   INTEGER NOT NULL,
      synced_at   INTEGER
    );

  `);
};

// ─── Helpers CRUD génériques ──────────────────────────────────────────────────

export const dbGetAll = async (table, whereClause = '', params = []) => {
  const db  = await getDb();
  const sql = whereClause
    ? `SELECT * FROM ${table} WHERE ${whereClause}`
    : `SELECT * FROM ${table}`;
  return db.getAllAsync(sql, params);
};

export const dbGetOne = async (table, whereClause, params = []) => {
  const db = await getDb();
  return db.getFirstAsync(`SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`, params);
};

export const dbRun = async (sql, params = []) => {
  const db = await getDb();
  return db.runAsync(sql, params);
};

// Retourne tous les enregistrements non synchronisés d'une table
export const getUnsynced = async (table) => {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM ${table} WHERE synced_at IS NULL`);
};

// Marque un enregistrement comme synchronisé
export const markSynced = async (table, id) => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE ${table} SET synced_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
};

// Marque les paramètres du cycle comme synchronisés (id fixe = 1)
export const markSettingsSynced = async () => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE cycle_settings SET synced_at = ? WHERE id = 1`,
    [Date.now()]
  );
};

export default getDb;
