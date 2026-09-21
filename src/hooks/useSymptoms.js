import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../db/database';
import { syncTable } from '../db/syncService';

const rowToSymptom = (row) => ({
  id:            row.id,
  date:          row.date,
  mood:          row.mood,
  pain:          !!row.pain,
  painIntensity: row.pain_intensity,
  fatigue:       row.fatigue,
  notes:         row.notes ?? '',
  createdAt:     row.created_at,
  updatedAt:     row.updated_at,
});

export const useSymptoms = () => {
  const { user } = useAuth();
  const [todaySymptom,   setTodaySymptom]   = useState(null);
  const [recentSymptoms, setRecentSymptoms] = useState([]); // 14 derniers jours
  const [loading,        setLoading]        = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadAll();
  }, [user?.uid]);

  const loadAll = async () => {
    try {
      const db = await getDb();
      // Entrée du jour
      const row = await db.getFirstAsync(
        `SELECT * FROM symptoms WHERE date = ? LIMIT 1`, [today]
      );
      setTodaySymptom(row ? rowToSymptom(row) : null);
      // 14 derniers jours
      const from = new Date();
      from.setDate(from.getDate() - 13);
      const fromStr = from.toISOString().split('T')[0];
      const rows = await db.getAllAsync(
        `SELECT * FROM symptoms WHERE date BETWEEN ? AND ? ORDER BY date DESC`,
        [fromStr, today]
      );
      setRecentSymptoms(rows.map(rowToSymptom));
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  // Ajoute ou met à jour le symptôme d'une date
  // data : { mood, pain, painIntensity, fatigue, notes }
  const addSymptom = useCallback(async (date, data) => {
    const now = Date.now();
    const id  = `sym_${date}`;

    const record = {
      id,
      date,
      mood:          data.mood          ?? null,
      pain:          data.pain          ? 1 : 0,
      pain_intensity:data.painIntensity ?? 0,
      fatigue:       data.fatigue       ?? 0,
      notes:         data.notes         ?? '',
      created_at:    now,
      updated_at:    now,
    };

    // Mise à jour optimiste
    if (date === today) {
      setTodaySymptom({
        id, date,
        mood:          data.mood          ?? null,
        pain:          !!data.pain,
        painIntensity: data.painIntensity ?? 0,
        fatigue:       data.fatigue       ?? 0,
        notes:         data.notes         ?? '',
        createdAt:     now,
        updatedAt:     now,
      });
    }

    try {
      const db = await getDb();
      // Vérifier si l'entrée existe déjà pour préserver created_at
      const existing = await db.getFirstAsync(
        `SELECT created_at FROM symptoms WHERE id = ?`, [id]
      );
      await db.runAsync(
        `INSERT OR REPLACE INTO symptoms
           (id, date, mood, pain, pain_intensity, fatigue, notes, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id, date,
          record.mood,
          record.pain,
          record.pain_intensity,
          record.fatigue,
          record.notes,
          existing?.created_at ?? now,
          now,
        ]
      );
    } catch (_) {}

    syncTable(user?.uid, 'symptoms').catch(() => {});
  }, [user?.uid, today]);

  // Récupère les symptômes entre deux dates (YYYY-MM-DD)
  const getSymptoms = useCallback(async (fromDate, toDate) => {
    try {
      const db   = await getDb();
      const rows = await db.getAllAsync(
        `SELECT * FROM symptoms WHERE date BETWEEN ? AND ? ORDER BY date DESC`,
        [fromDate, toDate]
      );
      return rows.map(rowToSymptom);
    } catch (_) {
      return [];
    }
  }, []);

  // Récupère le symptôme d'une date précise
  const getSymptomByDate = useCallback(async (date) => {
    try {
      const db  = await getDb();
      const row = await db.getFirstAsync(
        `SELECT * FROM symptoms WHERE date = ? LIMIT 1`, [date]
      );
      return row ? rowToSymptom(row) : null;
    } catch (_) {
      return null;
    }
  }, []);

  return {
    todaySymptom, recentSymptoms, loading,
    addSymptom, getSymptoms, getSymptomByDate,
    reload: loadAll,
  };
};
