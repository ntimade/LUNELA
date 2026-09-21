import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../db/database';
import { syncTable } from '../db/syncService';

// ─── Conversion SQLite row → objet interne ───────────────────────────────────
const rowToEntry = (row) => ({
  id:        row.id,
  date:      row.date,
  mood:      row.mood,
  stress:    row.stress,
  energy:    row.energy,
  notes:     row.notes ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useHealthEntries = () => {
  const { user } = useAuth();

  const [todayEntry, setTodayEntry] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadData();
  }, [user?.uid]);

  // ── Chargement : entrée du jour + 30 dernières ────────────────────────────
  const loadData = async () => {
    try {
      const db = await getDb();

      const todayRow = await db.getFirstAsync(
        `SELECT * FROM health_entries WHERE date = ? LIMIT 1`,
        [today]
      );
      setTodayEntry(todayRow ? rowToEntry(todayRow) : null);

      const rows = await db.getAllAsync(
        `SELECT * FROM health_entries ORDER BY date DESC LIMIT 30`
      );
      setRecentEntries(rows.map(rowToEntry));
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  // ── Ajouter ou mettre à jour une entrée ───────────────────────────────────
  // data : { mood (0-10), stress (0-10), energy (0-10), notes }
  const addEntry = useCallback(async (date, data) => {
    const id  = `health_${date}`;
    const now = Date.now();

    const entry = {
      id,
      date,
      mood:   data.mood   ?? 5,
      stress: data.stress ?? 5,
      energy: data.energy ?? 5,
      notes:  data.notes  ?? '',
      createdAt: now,
      updatedAt: now,
    };

    // Mise à jour optimiste UI
    if (date === today) setTodayEntry(entry);
    setRecentEntries((prev) => {
      const filtered = prev.filter((e) => e.date !== date);
      return [entry, ...filtered].slice(0, 30);
    });

    try {
      const db = await getDb();
      const existing = await db.getFirstAsync(
        `SELECT created_at FROM health_entries WHERE id = ?`, [id]
      );
      await db.runAsync(
        `INSERT OR REPLACE INTO health_entries
           (id, date, mood, stress, energy, notes, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id, date,
          entry.mood, entry.stress, entry.energy, entry.notes,
          existing?.created_at ?? now,
          now,
        ]
      );
    } catch (_) {}

    syncTable(user?.uid, 'health_entries').catch(() => {});
  }, [user?.uid, today]);

  // ── Récupérer N dernières entrées ─────────────────────────────────────────
  const getEntries = useCallback(async (limit = 30) => {
    try {
      const db   = await getDb();
      const rows = await db.getAllAsync(
        `SELECT * FROM health_entries ORDER BY date DESC LIMIT ?`, [limit]
      );
      return rows.map(rowToEntry);
    } catch (_) {
      return [];
    }
  }, []);

  // ── Récupérer l'entrée d'une date précise ─────────────────────────────────
  const getEntryByDate = useCallback(async (date) => {
    try {
      const db  = await getDb();
      const row = await db.getFirstAsync(
        `SELECT * FROM health_entries WHERE date = ? LIMIT 1`, [date]
      );
      return row ? rowToEntry(row) : null;
    } catch (_) {
      return null;
    }
  }, []);

  // ── Calcul des moyennes sur N derniers jours ──────────────────────────────
  const getAverages = useCallback(async (days = 7) => {
    try {
      const db   = await getDb();
      const from = new Date();
      from.setDate(from.getDate() - days);
      const fromStr = from.toISOString().split('T')[0];

      const row = await db.getFirstAsync(
        `SELECT
           ROUND(AVG(mood),   1) as avgMood,
           ROUND(AVG(stress), 1) as avgStress,
           ROUND(AVG(energy), 1) as avgEnergy,
           COUNT(*) as count
         FROM health_entries
         WHERE date >= ?`,
        [fromStr]
      );
      return row ?? { avgMood: null, avgStress: null, avgEnergy: null, count: 0 };
    } catch (_) {
      return { avgMood: null, avgStress: null, avgEnergy: null, count: 0 };
    }
  }, []);

  return {
    todayEntry,
    recentEntries,
    loading,
    addEntry,
    getEntries,
    getEntryByDate,
    getAverages,
    reload: loadData,
  };
};
