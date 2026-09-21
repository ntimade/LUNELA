import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../db/database';
import { syncTable, deleteCycleRemote } from '../db/syncService';
import { useNotifications } from './useNotifications';

const NOTIF_PREF_KEY = 'lunela_notifications_enabled';

const PERIOD_COLOR  = '#EC4899';
const FERTILE_COLOR = '#6EE7B7';
const OVUL_COLOR    = '#FF6B35';

// Deux déclarations de règles à moins de X jours d'écart sont traitées comme
// la même période (re-déclarée/corrigée), pas comme deux cycles distincts —
// un vrai cycle ne peut physiologiquement pas être plus court que ça. Sans
// cette fusion, les deux entrées se chevauchent sur le calendrier et faussent
// la durée moyenne de cycle / la détection d'anomalies.
const SAME_PERIOD_MERGE_THRESHOLD_DAYS = 10;

// ─── Utilitaires de date en heure LOCALE ──────────────────────────────────────
// Un 'YYYY-MM-DD' seul est interprété comme minuit UTC par la spec JS (pas
// minuit local), et toISOString() fait l'inverse (local → UTC) : les deux
// peuvent décaler le jour calculé d'une unité selon le fuseau horaire de
// l'utilisatrice. On force systématiquement le passage par l'heure locale.
const parseLocalDate = (dateStr) => new Date(dateStr + 'T00:00:00');
const toLocalDateKey  = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─── Détection d'anomalies (inchangée) ───────────────────────────────────────
export const detectAnomalies = (cycles, settings) => {
  const anomalies = [];
  if (cycles.length === 0) return anomalies;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Retard de règles
  const lastDate     = parseLocalDate(cycles[0].startDate);
  const expectedNext = new Date(lastDate);
  expectedNext.setDate(expectedNext.getDate() + settings.cycleLength);
  const daysLate = Math.floor((today - expectedNext) / (1000 * 60 * 60 * 24));

  if (daysLate >= 5 && daysLate < 90) {
    anomalies.push({
      id:       `late_${cycles[0].startDate}`,
      type:     'LATE_PERIOD',
      severity: daysLate >= 14 ? 'high' : 'medium',
      title:    daysLate >= 14 ? 'Retard important' : 'Règles en retard',
      message:  `Vos règles ont ${daysLate} jour${daysLate > 1 ? 's' : ''} de retard.`,
      advice:   daysLate >= 14
        ? 'Un retard de plus de 2 semaines peut indiquer une grossesse ou un déséquilibre hormonal. Une consultation est recommandée.'
        : 'Un léger retard peut être dû au stress ou à un changement de mode de vie. Surveillez votre cycle.',
    });
  }

  // 2. Cycle trop court
  if (cycles.length >= 2) {
    const d1 = parseLocalDate(cycles[0].startDate);
    const d2 = parseLocalDate(cycles[1].startDate);
    const realInterval = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
    if (realInterval > 0 && realInterval < 21) {
      anomalies.push({
        id: `short_${cycles[0].startDate}`, type: 'SHORT_CYCLE', severity: 'medium',
        title:   'Cycle trop court',
        message: `Votre dernier cycle était de ${realInterval} jours (norme : 21-35 jours).`,
        advice:  'Un cycle très court peut indiquer une insuffisance lutéale ou un déséquilibre hormonal. Consultez un spécialiste.',
      });
    }
    // 3. Cycle trop long
    if (realInterval > 35) {
      anomalies.push({
        id: `long_${cycles[0].startDate}`, type: 'LONG_CYCLE', severity: 'low',
        title:   'Cycle long',
        message: `Votre dernier cycle était de ${realInterval} jours (norme : 21-35 jours).`,
        advice:  'Un cycle long peut être associé au SOPK ou à des troubles thyroïdiens. Un suivi médical est conseillé.',
      });
    }
  }

  // 4. Cycle irrégulier
  if (cycles.length >= 3) {
    const intervals = [];
    for (let i = 0; i < Math.min(cycles.length - 1, 5); i++) {
      const a    = parseLocalDate(cycles[i].startDate);
      const b    = parseLocalDate(cycles[i + 1].startDate);
      const diff = Math.floor((a - b) / (1000 * 60 * 60 * 24));
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length >= 2) {
      const max = Math.max(...intervals);
      const min = Math.min(...intervals);
      if (max - min > 7) {
        anomalies.push({
          id: `irregular_${cycles[0].startDate}`, type: 'IRREGULAR', severity: 'medium',
          title:   'Cycle irrégulier',
          message: `Variation de ${max - min} jours entre vos cycles récents.`,
          advice:  'Des cycles irréguliers peuvent être liés au stress, à un SOPK ou à des troubles hormonaux. Consultez un spécialiste.',
        });
      }
    }
  }

  // 5. Paramètres manuels anormaux
  if (settings.cycleLength < 21) {
    anomalies.push({
      id: 'settings_short', type: 'SETTINGS_SHORT', severity: 'medium',
      title:   'Durée de cycle inhabituelle',
      message: `Vous avez configuré un cycle de ${settings.cycleLength} jours (inférieur à 21 jours).`,
      advice:  'Vérifiez vos paramètres ou consultez un spécialiste si votre cycle est réellement aussi court.',
    });
  }
  if (settings.cycleLength > 35) {
    anomalies.push({
      id: 'settings_long', type: 'SETTINGS_LONG', severity: 'low',
      title:   'Cycle long configuré',
      message: `Vous avez configuré un cycle de ${settings.cycleLength} jours (supérieur à 35 jours).`,
      advice:  'Un cycle long mérite un suivi médical pour exclure un SOPK ou des troubles hormonaux.',
    });
  }

  return anomalies;
};

// ─── Helpers SQLite → format interne ─────────────────────────────────────────
const rowToCycle = (row) => ({
  id:        row.id,
  startDate: row.start_date,
  endDate:   row.end_date ?? null,
});

const rowToSettings = (row) => ({
  cycleLength:  row.cycle_length,
  periodLength: row.period_length,
});

const DEFAULT_SETTINGS = { cycleLength: 28, periodLength: 5 };

// ─── Hook principal ───────────────────────────────────────────────────────────
export const useCycle = () => {
  const { user } = useAuth();
  const [cycles,    setCycles]    = useState([]);
  const [settings,  setSettings]  = useState(DEFAULT_SETTINGS);
  const [anomalies, setAnomalies] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const { schedulePeriodReminder, scheduleFertileReminder, scheduleDailyTip } = useNotifications();
  // Ref pour éviter de replanifier à chaque render
  const tipsScheduled = useRef(false);

  // ── Chargement initial depuis SQLite ───────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadFromSQLite();
    // Conseil quotidien planifié une seule fois par session (si activé dans les préférences)
    if (!tipsScheduled.current) {
      tipsScheduled.current = true;
      AsyncStorage.getItem(NOTIF_PREF_KEY).then(v => {
        if (v !== 'false') scheduleDailyTip(8).catch(() => {});
      });
    }
  }, [user?.uid]);

  const loadFromSQLite = async () => {
    try {
      const db = await getDb();

      // Cycles : triés du plus récent au plus ancien
      const cycleRows = await db.getAllAsync(
        `SELECT * FROM cycles ORDER BY start_date DESC LIMIT 12`
      );
      const loadedCycles = cycleRows.map(rowToCycle);

      // Paramètres
      const settingsRow = await db.getFirstAsync(
        `SELECT * FROM cycle_settings WHERE id = 1`
      );
      const loadedSettings = settingsRow ? rowToSettings(settingsRow) : DEFAULT_SETTINGS;

      setCycles(loadedCycles);
      setSettings(loadedSettings);
      setAnomalies(detectAnomalies(loadedCycles, loadedSettings));

      // Planifier les rappels avec les dates calculées
      scheduleReminders(loadedCycles, loadedSettings);
    } catch (_) {
      // SQLite indisponible — état initial vide
    } finally {
      setLoading(false);
    }
  };

  // ── Planification des rappels (interne) ───────────────────────────────────
  const scheduleReminders = useCallback(async (cycleList, cfg) => {
    if (cycleList.length === 0) return;
    const enabled = await AsyncStorage.getItem(NOTIF_PREF_KEY);
    if (enabled === 'false') return;

    // Calcul inline pour éviter la dépendance circulaire avec les fonctions get*
    const last = parseLocalDate(cycleList[0].startDate);

    const nextPeriod = new Date(last);
    nextPeriod.setDate(nextPeriod.getDate() + cfg.cycleLength);

    const ovulation = new Date(last);
    ovulation.setDate(ovulation.getDate() + cfg.cycleLength - 14);

    const fertileStart = new Date(ovulation);
    fertileStart.setDate(fertileStart.getDate() - 5);

    schedulePeriodReminder(nextPeriod).catch(() => {});
    scheduleFertileReminder(fertileStart).catch(() => {});
  }, [schedulePeriodReminder, scheduleFertileReminder]);

  // ── Ajouter un cycle ───────────────────────────────────────────────────────
  const addCycle = useCallback(async (startDate) => {
    const id  = Date.now().toString();
    const now = Date.now();
    const newStart = parseLocalDate(startDate);

    // Toute déclaration existante à moins de SAME_PERIOD_MERGE_THRESHOLD_DAYS
    // de la nouvelle date est la MÊME période re-déclarée (doigt qui glisse,
    // correction de date...) — on la fusionne (remplace) au lieu d'empiler
    // deux cycles qui se chevaucheraient.
    const isSamePeriod = (otherStartDate) => {
      const diff = Math.abs(Math.round((parseLocalDate(otherStartDate) - newStart) / (1000 * 60 * 60 * 24)));
      return diff < SAME_PERIOD_MERGE_THRESHOLD_DAYS;
    };

    // Mise à jour optimiste de l'UI
    const newCycle = { id, startDate, endDate: null };
    let mergedAwayIds = [];
    setCycles((prev) => {
      mergedAwayIds = prev.filter((c) => isSamePeriod(c.startDate)).map((c) => c.id);
      const filtered = prev.filter((c) => !isSamePeriod(c.startDate));
      // Trié du plus récent au plus ancien (pas juste ajouté en tête) : sinon,
      // enregistrer une date de règles ANTÉRIEURE aux cycles déjà connus (ex.
      // rattraper un oubli) placerait ce cycle plus ancien en position [0], et
      // tous les calculs qui supposent que cycles[0] est le plus récent
      // (prochaines règles, ovulation, détection de retard) se baseraient
      // alors sur la mauvaise date.
      const updated = [newCycle, ...filtered]
        .sort((a, b) => (a.startDate > b.startDate ? -1 : 1))
        .slice(0, 12);
      setAnomalies(detectAnomalies(updated, settings));
      return updated;
    });

    try {
      const db = await getDb();
      // Supprimer toute déclaration proche (même période re-déclarée), pas
      // seulement un doublon exact sur la même date.
      const existingRows = await db.getAllAsync(`SELECT start_date FROM cycles`);
      for (const row of existingRows) {
        if (isSamePeriod(row.start_date)) {
          await db.runAsync(`DELETE FROM cycles WHERE start_date = ?`, [row.start_date]);
        }
      }
      // Insérer le nouveau (synced_at = NULL → à synchroniser)
      await db.runAsync(
        `INSERT INTO cycles (id, start_date, end_date, created_at, synced_at)
         VALUES (?, ?, NULL, ?, NULL)`,
        [id, startDate, now]
      );
      // Garder seulement les 12 derniers
      await db.runAsync(
        `DELETE FROM cycles WHERE id NOT IN (
           SELECT id FROM cycles ORDER BY start_date DESC LIMIT 12
         )`
      );
    } catch (_) {}

    // Push vers Firebase en arrière-plan, et retirer les entrées fusionnées
    // (sinon elles restent visibles pour toujours côté partenaire/spécialiste).
    syncTable(user?.uid, 'cycles').catch(() => {});
    mergedAwayIds.forEach((mergedId) => deleteCycleRemote(user?.uid, mergedId).catch(() => {}));

    // Replanifier les rappels avec le nouveau cycle
    setCycles((latest) => {
      scheduleReminders(latest, settings);
      return latest;
    });
  }, [settings, user?.uid, scheduleReminders]);

  // ── Supprimer un cycle ─────────────────────────────────────────────────────
  const removeCycle = useCallback(async (id) => {
    setCycles((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      setAnomalies(detectAnomalies(updated, settings));
      return updated;
    });

    try {
      const db = await getDb();
      await db.runAsync(`DELETE FROM cycles WHERE id = ?`, [id]);
    } catch (_) {}

    syncTable(user?.uid, 'cycles').catch(() => {});
    deleteCycleRemote(user?.uid, id).catch(() => {});
  }, [settings, user?.uid]);

  // ── Enregistrer les paramètres ─────────────────────────────────────────────
  const saveSettings = useCallback(async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    setAnomalies((prev) => detectAnomalies(cycles, merged));

    try {
      const db  = await getDb();
      const now = Date.now();
      await db.runAsync(
        `INSERT OR REPLACE INTO cycle_settings
           (id, cycle_length, period_length, updated_at, synced_at)
         VALUES (1, ?, ?, ?, NULL)`,
        [merged.cycleLength, merged.periodLength, now]
      );
    } catch (_) {}

    syncTable(user?.uid, 'cycle_settings').catch(() => {});

    // Replanifier avec les nouveaux paramètres
    scheduleReminders(cycles, merged);
  }, [settings, cycles, user?.uid, scheduleReminders]);

  // ── Calculs ────────────────────────────────────────────────────────────────

  // Durée moyenne basée sur les vrais intervalles entre cycles
  const getAverageCycleLength = useCallback(() => {
    if (cycles.length < 2) return settings.cycleLength;
    const intervals = [];
    for (let i = 0; i < Math.min(cycles.length - 1, 6); i++) {
      const a = parseLocalDate(cycles[i].startDate);
      const b = parseLocalDate(cycles[i + 1].startDate);
      const d = Math.floor((a - b) / (1000 * 60 * 60 * 24));
      if (d >= 15 && d <= 60) intervals.push(d);
    }
    if (!intervals.length) return settings.cycleLength;
    return Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }, [cycles, settings.cycleLength]);

  // Historique des durées de cycle (du plus ancien au plus récent), pour une
  // courbe d'évolution — un point par écart réel entre deux cycles consécutifs.
  const getCycleLengthHistory = useCallback(() => {
    if (cycles.length < 2) return [];
    const chronological = [...cycles].slice().reverse(); // le plus ancien d'abord
    const history = [];
    for (let i = 0; i < chronological.length - 1; i++) {
      const a = parseLocalDate(chronological[i].startDate);
      const b = parseLocalDate(chronological[i + 1].startDate);
      const days = Math.floor((b - a) / (1000 * 60 * 60 * 24));
      if (days > 0) history.push({ value: days, label: `C${i + 1}` });
    }
    return history;
  }, [cycles]);

  // Durée de cycle affichée dans les paramètres toujours synchronisée sur la
  // vraie moyenne dès qu'il y a au moins 2 cycles enregistrés — sinon
  // "Paramètres du cycle" resterait figé sur la valeur manuelle initiale
  // même une fois l'historique réel disponible.
  useEffect(() => {
    if (cycles.length < 2) return;
    const avg = getAverageCycleLength();
    if (avg !== settings.cycleLength) {
      saveSettings({ cycleLength: avg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles, getAverageCycleLength]);

  const getNextPeriod = useCallback(() => {
    if (cycles.length === 0) return null;
    const last = parseLocalDate(cycles[0].startDate);
    const next = new Date(last);
    next.setDate(next.getDate() + getAverageCycleLength());
    return next;
  }, [cycles, getAverageCycleLength]);

  const getOvulationDate = useCallback(() => {
    if (cycles.length === 0) return null;
    const last = parseLocalDate(cycles[0].startDate);
    const ovul = new Date(last);
    ovul.setDate(ovul.getDate() + getAverageCycleLength() - 14);
    return ovul;
  }, [cycles, getAverageCycleLength]);

  const getFertileWindow = useCallback(() => {
    const ovul = getOvulationDate();
    if (!ovul) return null;
    const start = new Date(ovul); start.setDate(start.getDate() - 5);
    const end   = new Date(ovul); end.setDate(end.getDate() + 1);
    return { start, end };
  }, [getOvulationDate]);

  const getMarkedDates = useCallback(() => {
    const marked = {};

    cycles.forEach((cycle) => {
      for (let i = 0; i < settings.periodLength; i++) {
        const d = parseLocalDate(cycle.startDate);
        d.setDate(d.getDate() + i);
        marked[toLocalDateKey(d)] = {
          selected: true, selectedColor: PERIOD_COLOR,
        };
      }
    });

    const fertile = getFertileWindow();
    if (fertile) {
      let d = new Date(fertile.start);
      while (d <= fertile.end) {
        const key = toLocalDateKey(d);
        if (!marked[key]) marked[key] = { selected: true, selectedColor: FERTILE_COLOR };
        d.setDate(d.getDate() + 1);
      }
    }

    const ovul = getOvulationDate();
    if (ovul) {
      marked[toLocalDateKey(ovul)] = {
        selected: true, selectedColor: OVUL_COLOR,
      };
    }

    return marked;
  }, [cycles, settings, getFertileWindow, getOvulationDate]);

  return {
    cycles, settings, anomalies, loading,
    addCycle, removeCycle, saveSettings,
    getNextPeriod, getOvulationDate, getFertileWindow, getMarkedDates,
    getAverageCycleLength, getCycleLengthHistory,
    reload: loadFromSQLite,
  };
};
