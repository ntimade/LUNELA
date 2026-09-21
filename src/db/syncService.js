import NetInfo from '@react-native-community/netinfo';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db as firestore } from '../config/firebase';
import { getDb, getUnsynced, markSynced, markSettingsSynced } from './database';

// ─── Utilitaire réseau ────────────────────────────────────────────────────────

export const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
};

// ─── PUSH — Local → Firebase ─────────────────────────────────────────────────

const pushCycles = async (uid) => {
  const rows = await getUnsynced('cycles');
  for (const row of rows) {
    // ✅ Chemin correct : cycles/{uid}/entries/{entryId}
    await setDoc(
      doc(firestore, 'cycles', uid, 'entries', row.id),
      {
        id:        row.id,
        startDate: row.start_date,
        endDate:   row.end_date ?? null,
        createdAt: row.created_at,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await markSynced('cycles', row.id);
  }
};

// Supprime une entrée de cycle sur Firebase — nécessaire car `pushCycles` ne
// pousse que les lignes non synchronisées (nouvelles/modifiées) et n'a aucune
// notion de suppression : sans cet appel explicite, un cycle supprimé ou
// fusionné localement (ex: doublon de règles déclarées deux fois) reste
// visible pour toujours côté Firebase — et donc pour un partenaire ou un
// spécialiste qui lit les données partagées.
export const deleteCycleRemote = async (uid, cycleId) => {
  if (!uid || !cycleId) return;
  const online = await isOnline();
  if (!online) return;
  try {
    await deleteDoc(doc(firestore, 'cycles', uid, 'entries', cycleId));
  } catch (_) {
    // Silencieux — si hors-ligne ou erreur, la suppression reste locale ;
    // sans mécanisme de tombstone, elle ne se repropagera pas automatiquement
    // au prochain sync si l'utilisatrice revient en ligne plus tard.
  }
};

const pushCycleSettings = async (uid) => {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT * FROM cycle_settings WHERE id = 1 AND synced_at IS NULL`
  );
  if (!row) return;
  // ✅ Chemin correct : cycle_settings/{uid}
  await setDoc(
    doc(firestore, 'cycle_settings', uid),
    {
      cycleLength:  row.cycle_length,
      periodLength: row.period_length,
      updatedAt:    serverTimestamp(),
    },
    { merge: true }
  );
  await markSettingsSynced();
};

const pushSymptoms = async (uid) => {
  const rows = await getUnsynced('symptoms');
  for (const row of rows) {
    // ✅ Chemin correct : symptoms/{uid}/entries/{symId}
    await setDoc(
      doc(firestore, 'symptoms', uid, 'entries', row.id),
      {
        id:           row.id,
        date:         row.date,
        mood:         row.mood,
        pain:         !!row.pain,
        painIntensity:row.pain_intensity,
        fatigue:      row.fatigue,
        notes:        row.notes ?? '',
        createdAt:    row.created_at,
        updatedAt:    serverTimestamp(),
      }
    );
    await markSynced('symptoms', row.id);
  }
};

const pushHealthEntries = async (uid) => {
  const rows = await getUnsynced('health_entries');
  for (const row of rows) {
    // ✅ Chemin correct : health_entries/{uid}/entries/{entryId}
    await setDoc(
      doc(firestore, 'health_entries', uid, 'entries', row.id),
      {
        id:        row.id,
        date:      row.date,
        mood:      row.mood,
        stress:    row.stress,
        energy:    row.energy,
        notes:     row.notes ?? '',
        createdAt: row.created_at,
        updatedAt: serverTimestamp(),
      }
    );
    await markSynced('health_entries', row.id);
  }
};

const pushQuizProgress = async (uid) => {
  // quiz_progress : une seule ligne par uid (id = "qp_{uid}")
  const rows = await getUnsynced('quiz_progress');
  if (rows.length === 0 && (await getUnsynced('badges')).length === 0) return;

  const progRow  = await (await getDb()).getFirstAsync(
    `SELECT * FROM quiz_progress WHERE id = ?`, [`qp_${uid}`]
  );
  const badgeRows = await (await getDb()).getAllAsync(`SELECT * FROM badges`);

  if (progRow) {
    await setDoc(
      doc(firestore, 'quiz_progress', uid),
      {
        totalQuizzes:    progRow.total_quizzes,
        totalPoints:     progRow.total_points,
        perfectScores:   progRow.perfect_scores,
        streak:          progRow.streak,
        lastQuizDate:    progRow.last_quiz_date,
        completedTopics: JSON.parse(progRow.completed_topics ?? '[]'),
        earnedBadges:    JSON.parse(progRow.earned_badges    ?? '[]'),
        updatedAt:       serverTimestamp(),
      },
      { merge: true }
    );
    await markSynced('quiz_progress', progRow.id);
  }

  for (const badge of badgeRows.filter(b => b.synced_at == null)) {
    await setDoc(
      doc(firestore, 'badges', uid, 'items', badge.id),
      { badgeId: badge.badge_id, earnedAt: badge.earned_at },
      { merge: true }
    );
    await markSynced('badges', badge.id);
  }
};

// ─── PULL — Firebase → Local (cache) ─────────────────────────────────────────

const pullEducationalContent = async () => {
  const db = await getDb();

  // Ne re-télécharge pas si le cache a moins de 24h
  const latest = await db.getFirstAsync(
    `SELECT cached_at FROM educational_content ORDER BY cached_at DESC LIMIT 1`
  );
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (latest && Date.now() - latest.cached_at < oneDayMs) return;

  const snap = await getDocs(collection(firestore, 'educationalContent'));
  if (snap.empty) return;

  const now = Date.now();
  for (const d of snap.docs) {
    const data = d.data();
    await db.runAsync(
      `INSERT OR REPLACE INTO educational_content
        (id, target_profile, category, title, body, sort_order, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d.id, data.targetProfile ?? 'both', data.category ?? '', data.title ?? '',
       data.body ?? '', data.order ?? 0, now]
    );
  }
};

const pullCycleDataFromFirebase = async (uid) => {
  const db = await getDb();

  // Ne pull que si la table cycles est vide (premier lancement ou nouvel appareil)
  const existing = await db.getFirstAsync(`SELECT id FROM cycles LIMIT 1`);
  if (existing) return;

  const now = Date.now();

  // ✅ Chemin correct : cycles/{uid}/entries/
  try {
    const entriesSnap = await getDocs(
      collection(firestore, 'cycles', uid, 'entries')
    );
    for (const d of entriesSnap.docs) {
      const c = d.data();
      await db.runAsync(
        `INSERT OR IGNORE INTO cycles (id, start_date, end_date, created_at, synced_at)
         VALUES (?, ?, ?, ?, ?)`,
        [c.id ?? d.id, c.startDate, c.endDate ?? null, c.createdAt ?? now, now]
      );
    }
  } catch (_) {}

  // ✅ Chemin correct : cycle_settings/{uid}
  try {
    const settingsSnap = await getDoc(doc(firestore, 'cycle_settings', uid));
    if (settingsSnap.exists()) {
      const s = settingsSnap.data();
      await db.runAsync(
        `INSERT OR REPLACE INTO cycle_settings (id, cycle_length, period_length, updated_at, synced_at)
         VALUES (1, ?, ?, ?, ?)`,
        [s.cycleLength ?? 28, s.periodLength ?? 5, now, now]
      );
    }
  } catch (_) {}
};

// ─── SYNC ALL ─────────────────────────────────────────────────────────────────

export const syncAll = async (uid) => {
  if (!uid) return { success: false, reason: 'no_user' };

  const online = await isOnline();
  if (!online) return { success: false, reason: 'offline' };

  try {
    // Pull d'abord (initialisation si besoin)
    await pullCycleDataFromFirebase(uid);
    await pullEducationalContent();

    // Push ensuite (données locales non synchronisées)
    await pushCycles(uid);
    await pushCycleSettings(uid);
    await pushSymptoms(uid);
    await pushHealthEntries(uid);
    await pushQuizProgress(uid);

    return { success: true };
  } catch (e) {
    return { success: false, reason: e.message };
  }
};

// Push immédiat d'une seule table (appelé après chaque écriture locale)
export const syncTable = async (uid, table) => {
  if (!uid) return;
  const online = await isOnline();
  if (!online) return;

  try {
    switch (table) {
      case 'cycles':         await pushCycles(uid);        break;
      case 'cycle_settings': await pushCycleSettings(uid); break;
      case 'symptoms':       await pushSymptoms(uid);      break;
      case 'health_entries': await pushHealthEntries(uid); break;
      case 'quiz_progress':  await pushQuizProgress(uid);  break;
    }
  } catch (_) {
    // Silencieux — les données non sync seront poussées au prochain syncAll
  }
};
