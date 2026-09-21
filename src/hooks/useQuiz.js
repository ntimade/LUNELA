import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db as firestore } from '../config/firebase';
import { getDb } from '../db/database';
import { syncTable } from '../db/syncService';

// ─── Définition des badges ────────────────────────────────────────────────────
export const BADGES = [
  { id: 'first_quiz',   label: 'Premier Pas',    icon: '🎯', desc: 'Terminer votre premier quiz',         threshold: 1,   type: 'quizzes' },
  { id: 'quiz_5',       label: 'Curieux',         icon: '🔍', desc: 'Terminer 5 quiz',                    threshold: 5,   type: 'quizzes' },
  { id: 'quiz_10',      label: 'Explorateur',     icon: '🚀', desc: 'Terminer 10 quiz',                   threshold: 10,  type: 'quizzes' },
  { id: 'perfect',      label: 'Parfait',         icon: '⭐', desc: 'Score parfait sur un quiz',          threshold: 1,   type: 'perfect' },
  { id: 'perfect_3',    label: 'Maître',          icon: '👑', desc: '3 scores parfaits',                  threshold: 3,   type: 'perfect' },
  { id: 'points_50',    label: 'Collectionneur',  icon: '💎', desc: 'Accumuler 50 points',                threshold: 50,  type: 'points'  },
  { id: 'points_200',   label: 'Champion',        icon: '🏆', desc: 'Accumuler 200 points',               threshold: 200, type: 'points'  },
  { id: 'streak_3',     label: 'Régulier',        icon: '🔥', desc: 'Quiz 3 jours consécutifs',           threshold: 3,   type: 'streak'  },
  { id: 'all_topics',   label: 'Encyclopédiste',  icon: '📚', desc: 'Répondre à toutes les catégories',   threshold: 1,   type: 'topics'  },
];

// ─── Catégories de quiz (métadonnées seules — les questions vivent dans
// Firestore, gérées par l'administrateur via useQuizQuestions) ───────────────
export const QUIZ_TOPICS = [
  { id: 'cycle_basics',  label: 'Le Cycle Menstruel', icon: '🔄', color: '#EC4899' },
  { id: 'fertility',     label: 'Fertilité & Conception', icon: '🌱', color: '#10B981' },
  { id: 'hygiene',       label: 'Hygiène & Santé',    icon: '🧼', color: '#3B82F6' },
  { id: 'emotions',      label: 'Émotions & SPM',     icon: '💭', color: '#8B5CF6' },
  { id: 'contraception', label: 'Contraception',      icon: '🛡️', color: '#F59E0B' },
];

// ─── Questions par défaut (servent uniquement à préremplir Firestore au
// premier lancement — l'administrateur peut ensuite tout ajouter/modifier/
// supprimer depuis QuizManagerScreen) ─────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  {
    topicId: 'cycle_basics',
    questions: [
      {
        id: 'q_cb_1',
        text: 'Combien de jours dure en moyenne un cycle menstruel ?',
        options: ['14 jours', '21 jours', '28 jours', '35 jours'],
        correct: 2,
        explanation: 'Un cycle dure en moyenne 28 jours, mais peut varier de 21 à 35 jours selon les femmes.',
      },
      {
        id: 'q_cb_2',
        text: "Quelle hormone déclenche l'ovulation ?",
        options: ['Estrogène', 'Progestérone', 'LH (Hormone Lutéinisante)', 'FSH'],
        correct: 2,
        explanation: "Un pic de LH (Hormone Lutéinisante) provoque la libération de l'ovule lors de l'ovulation.",
      },
      {
        id: 'q_cb_3',
        text: 'Combien de phases compte le cycle menstruel ?',
        options: ['2', '3', '4', '5'],
        correct: 2,
        explanation: 'Le cycle se divise en 4 phases : menstruation, phase folliculaire, ovulation et phase lutéale.',
      },
      {
        id: 'q_cb_4',
        text: "Quand se produit généralement l'ovulation dans un cycle de 28 jours ?",
        options: ['Jour 7', 'Jour 14', 'Jour 21', 'Jour 28'],
        correct: 1,
        explanation: "Dans un cycle de 28 jours, l'ovulation survient généralement autour du 14ème jour.",
      },
      {
        id: 'q_cb_5',
        text: 'La phase lutéale dure en moyenne combien de jours ?',
        options: ['5–7 jours', '10–14 jours', '16–20 jours', '21–28 jours'],
        correct: 1,
        explanation: "La phase lutéale dure typiquement 10 à 14 jours, après l'ovulation jusqu'aux règles.",
      },
      {
        id: 'q_cb_6',
        text: 'Combien de jours durent en moyenne les règles ?',
        options: ['1–2 jours', '3–7 jours', '10–12 jours', '15 jours'],
        correct: 1,
        explanation: 'Les règles durent en moyenne entre 3 et 7 jours, mais cela peut varier selon les femmes.',
      },
      {
        id: 'q_cb_7',
        text: "Quelle hormone est responsable de l'épaississement de la muqueuse utérine ?",
        options: ['Testostérone', 'Estrogène', 'Insuline', 'Adrénaline'],
        correct: 1,
        explanation: "L'estrogène épaissit la muqueuse utérine (endomètre) en préparation d'une éventuelle grossesse.",
      },
      {
        id: 'q_cb_8',
        text: 'Un cycle est considéré irrégulier à partir de quelle variation ?',
        options: [
          'Quelques heures de décalage',
          'Plus de 7-9 jours de variation d\'un mois à l\'autre',
          'Il n\'existe pas de cycle irrégulier',
          '1 jour de décalage',
        ],
        correct: 1,
        explanation: "Une variation de plus de 7 à 9 jours entre les cycles peut être considérée comme une irrégularité à surveiller.",
      },
    ],
  },
  {
    topicId: 'fertility',
    questions: [
      {
        id: 'q_f_1',
        text: "Combien de jours un ovule reste-t-il viable après l'ovulation ?",
        options: ['6–12 heures', '12–24 heures', '48–72 heures', '5–7 jours'],
        correct: 1,
        explanation: "L'ovule reste viable seulement 12 à 24 heures. La fenêtre fertile tient compte de la survie des spermatozoïdes (5 jours).",
      },
      {
        id: 'q_f_2',
        text: 'Combien de jours les spermatozoïdes peuvent-ils survivre dans le corps féminin ?',
        options: ['12 heures', '1 jour', '3 à 5 jours', '7 jours'],
        correct: 2,
        explanation: 'Les spermatozoïdes peuvent survivre 3 à 5 jours dans le tractus reproducteur féminin.',
      },
      {
        id: 'q_f_3',
        text: 'Quelle est la période la plus fertile du cycle ?',
        options: ['Pendant les règles', "2–3 jours avant et après l'ovulation", 'Phase lutéale', '1 semaine après les règles'],
        correct: 1,
        explanation: "Les 2–3 jours entourant l'ovulation constituent la fenêtre fertile maximale.",
      },
      {
        id: 'q_f_4',
        text: 'Peut-on tomber enceinte pendant les règles ?',
        options: ['Jamais', 'Oui, surtout avec un cycle court', 'Seulement le dernier jour', 'Uniquement sans préservatif'],
        correct: 1,
        explanation: 'Avec un cycle court, l\'ovulation peut survenir peu après la fin des règles, rendant une grossesse possible.',
      },
      {
        id: 'q_f_5',
        text: 'Quel signe corporel peut indiquer une ovulation proche ?',
        options: [
          'Une glaire cervicale transparente et filante',
          'Une baisse de température corporelle stable',
          'Une perte totale de libido',
          'Aucun signe n\'existe',
        ],
        correct: 0,
        explanation: 'La glaire cervicale devient transparente, filante (comme du blanc d\'œuf) autour de l\'ovulation.',
      },
    ],
  },
  {
    topicId: 'hygiene',
    questions: [
      {
        id: 'q_h_1',
        text: 'À quelle fréquence faut-il changer une serviette hygiénique ?',
        options: ['Toutes les 12 h', 'Toutes les 8 h', 'Toutes les 3–4 h', 'Une fois par jour'],
        correct: 2,
        explanation: "Changer la serviette toutes les 3 à 4 heures réduit les risques d'irritation et d'infection.",
      },
      {
        id: 'q_h_2',
        text: 'Un tampon peut-il être porté toute une nuit (8 h) ?',
        options: ['Oui, sans problème', 'Non, risque de syndrome du choc toxique', 'Seulement si flux faible', 'Oui, si coton bio'],
        correct: 1,
        explanation: 'Porter un tampon plus de 6–8 h augmente le risque de syndrome du choc toxique. Préférer une serviette la nuit.',
      },
      {
        id: 'q_h_3',
        text: "Quelle pratique est déconseillée pour l'hygiène intime ?",
        options: ['Eau tiède et savon doux', 'Douche vaginale interne', 'Sous-vêtements en coton', 'Changer quotidiennement'],
        correct: 1,
        explanation: "La douche vaginale interne perturbe la flore naturelle et augmente les risques d'infection.",
      },
      {
        id: 'q_h_4',
        text: 'La coupe menstruelle peut être portée combien de temps maximum ?',
        options: ['2 heures', '4 heures', '12 heures', '24 heures'],
        correct: 2,
        explanation: 'La coupe menstruelle peut être portée jusqu\'à 12 heures avant de devoir être vidée et nettoyée.',
      },
      {
        id: 'q_h_5',
        text: 'Quel type de sous-vêtement est recommandé au quotidien ?',
        options: ['Synthétique ajusté', 'Coton respirant', 'Sans sous-vêtement', 'Peu importe la matière'],
        correct: 1,
        explanation: 'Le coton laisse respirer la peau et limite l\'humidité, réduisant les risques d\'irritation ou d\'infection.',
      },
    ],
  },
  {
    topicId: 'emotions',
    questions: [
      {
        id: 'q_e_1',
        text: "Qu'est-ce que le SPM ?",
        options: [
          'Syndrome post-menstruel',
          'Syndrome pré-menstruel',
          'Symptômes pendant les règles',
          'Syndrome de phases multiples',
        ],
        correct: 1,
        explanation: 'Le SPM (Syndrome Pré-Menstruel) regroupe les symptômes physiques et émotionnels qui surviennent 1 à 2 semaines avant les règles.',
      },
      {
        id: 'q_e_2',
        text: 'Quelle hormone chute brutalement juste avant les règles ?',
        options: ['Testostérone', 'Cortisol', 'Progestérone', 'Dopamine'],
        correct: 2,
        explanation: 'La chute de progestérone en fin de phase lutéale est responsable de nombreux symptômes du SPM.',
      },
      {
        id: 'q_e_3',
        text: "L'exercice physique peut-il atténuer les douleurs menstruelles ?",
        options: ['Non, il les aggrave', 'Oui, il libère des endorphines', 'Seulement le yoga', 'Aucun effet prouvé'],
        correct: 1,
        explanation: "L'exercice modéré libère des endorphines qui ont un effet analgésique naturel et réduisent les crampes.",
      },
      {
        id: 'q_e_4',
        text: 'Le SPM concerne combien de femmes environ ?',
        options: ['Moins de 5 %', 'Environ 20 %', 'Jusqu\'à 75 %', 'Toutes sans exception'],
        correct: 2,
        explanation: 'Le SPM affecte jusqu\'à 75 % des femmes à des degrés variables, de léger à très invalidant.',
      },
      {
        id: 'q_e_5',
        text: 'Que faire face à des sautes d\'humeur liées au cycle ?',
        options: [
          'Les ignorer complètement',
          'En parler, dormir suffisamment et bouger régulièrement',
          'Éviter tout contact social',
          'Arrêter de manger',
        ],
        correct: 1,
        explanation: 'Communiquer, bien dormir et pratiquer une activité physique aident à mieux vivre les variations hormonales.',
      },
    ],
  },
  {
    topicId: 'contraception',
    questions: [
      {
        id: 'q_c_1',
        text: "Quelle est l'efficacité du préservatif masculin utilisé correctement ?",
        options: ['72 %', '85 %', '98 %', '100 %'],
        correct: 2,
        explanation: 'Utilisé correctement et systématiquement, le préservatif masculin est efficace à 98 %. Il protège aussi des IST.',
      },
      {
        id: 'q_c_2',
        text: 'La pilule contraceptive protège-t-elle des IST ?',
        options: ['Oui, complètement', 'Partiellement', 'Non', 'Seulement certaines IST'],
        correct: 2,
        explanation: 'La pilule empêche la grossesse mais ne protège pas des infections sexuellement transmissibles.',
      },
      {
        id: 'q_c_3',
        text: "Qu'est-ce que la contraception d'urgence ?",
        options: [
          "Un préservatif d'urgence",
          'Une pilule prise dans les 72 h après un rapport non protégé',
          'Une injection mensuelle',
          'Un DIU posé après les règles',
        ],
        correct: 1,
        explanation: "La contraception d'urgence (pilule du lendemain) doit être prise dans les 72 h (idéalement 24 h) pour être efficace.",
      },
      {
        id: 'q_c_4',
        text: 'Quelle méthode protège à la fois des grossesses non désirées ET des IST ?',
        options: ['La pilule seule', 'Le stérilet seul', 'La double protection (préservatif + autre méthode)', 'L\'implant seul'],
        correct: 2,
        explanation: 'La double protection combine préservatif (IST) et une méthode hormonale ou un DIU (grossesse) pour une sécurité maximale.',
      },
      {
        id: 'q_c_5',
        text: 'La décision contraceptive doit être :',
        options: [
          'Uniquement celle de la femme',
          'Une responsabilité partagée entre les partenaires',
          'Décidée sans en parler',
          'Uniquement celle de l\'homme',
        ],
        correct: 1,
        explanation: 'La contraception concerne les deux partenaires ; en discuter ouvertement renforce la confiance et la responsabilité mutuelle.',
      },
    ],
  },
];

// ─── Questions gérées par l'administrateur (Firestore) ───────────────────────
// Même schéma que useContraceptives : on seed les questions par défaut au
// premier lancement, puis l'admin peut tout ajouter/modifier/supprimer via
// QuizManagerScreen. Chaque question stocke topicId pour être regroupée avec
// QUIZ_TOPICS côté écran de quiz.
export const useQuizQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const colRef = collection(firestore, 'quiz_questions');

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(colRef);
      if (snap.empty) {
        await seedInitialData();
      } else {
        setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      // Firestore inaccessible : questions par défaut locales
      const flat = DEFAULT_QUESTIONS.flatMap(topic =>
        topic.questions.map(q => ({ ...q, topicId: topic.topicId }))
      );
      setQuestions(flat);
    } finally {
      setLoading(false);
    }
  };

  const seedInitialData = async () => {
    const flat = DEFAULT_QUESTIONS.flatMap(topic =>
      topic.questions.map(({ id: _discard, ...q }) => ({ ...q, topicId: topic.topicId }))
    );
    try {
      const refs = await Promise.all(flat.map(q => addDoc(colRef, q)));
      setQuestions(refs.map((r, i) => ({ id: r.id, ...flat[i] })));
    } catch (e) {
      setQuestions(flat.map((q, i) => ({ id: String(i), ...q })));
    }
  };

  useEffect(() => { load(); }, []);

  const addQuestion = async (question) => {
    const ref = await addDoc(colRef, question);
    setQuestions(prev => [...prev, { id: ref.id, ...question }]);
  };

  const updateQuestion = async (id, updates) => {
    await updateDoc(doc(firestore, 'quiz_questions', id), updates);
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = async (id) => {
    await deleteDoc(doc(firestore, 'quiz_questions', id));
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Regroupe les questions par catégorie pour reconstituer la forme attendue
  // par QuizScreen : [{ id, label, icon, color, questions: [...] }]
  const topics = QUIZ_TOPICS.map(meta => ({
    ...meta,
    questions: questions.filter(q => q.topicId === meta.id),
  }));

  return { questions, topics, loading, addQuestion, updateQuestion, deleteQuestion, reload: load };
};

// ─── Calcul des badges gagnés ──────────────────────────────────────────────────
export const computeNewBadges = (progress, newStats) => {
  const earned = [];
  const { totalQuizzes, totalPoints, perfectScores, streak, completedTopics } = newStats;

  for (const badge of BADGES) {
    if (progress.earnedBadges?.includes(badge.id)) continue;

    let earned_ = false;
    if (badge.type === 'quizzes' && totalQuizzes >= badge.threshold) earned_ = true;
    if (badge.type === 'points'  && totalPoints  >= badge.threshold) earned_ = true;
    if (badge.type === 'perfect' && perfectScores >= badge.threshold) earned_ = true;
    if (badge.type === 'streak'  && streak        >= badge.threshold) earned_ = true;
    if (badge.type === 'topics'  && completedTopics >= QUIZ_TOPICS.length) earned_ = true;

    if (earned_) earned.push(badge.id);
  }
  return earned;
};

// ─── Hook ──────────────────────────────────────────────────────────────────────
export const useQuiz = () => {
  const { user } = useAuth();

  const [progress, setProgress] = useState({
    totalQuizzes:    0,
    totalPoints:     0,
    perfectScores:   0,
    streak:          0,
    lastQuizDate:    null,
    completedTopics: [],
    earnedBadges:    [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadProgress();
  }, [user?.uid]);

  // ── Chargement ───────────────────────────────────────────────────────────────
  const loadProgress = async () => {
    try {
      const db = await getDb();

      // quiz_progress : une ligne par uid
      const row = await db.getFirstAsync(
        `SELECT * FROM quiz_progress WHERE id = ?`, [`qp_${user.uid}`]
      );

      if (row) {
        setProgress({
          totalQuizzes:    row.total_quizzes    ?? 0,
          totalPoints:     row.total_points     ?? 0,
          perfectScores:   row.perfect_scores   ?? 0,
          streak:          row.streak           ?? 0,
          lastQuizDate:    row.last_quiz_date   ?? null,
          completedTopics: JSON.parse(row.completed_topics ?? '[]'),
          earnedBadges:    JSON.parse(row.earned_badges    ?? '[]'),
        });
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  // ── Enregistrer le résultat d'un quiz ────────────────────────────────────────
  // score : nombre de bonnes réponses, total : nombre de questions
  const saveQuizResult = useCallback(async (topicId, score, total) => {
    const points   = score * 10;
    const isPerfect = score === total;
    const today    = new Date().toISOString().split('T')[0];

    // Calcul streak
    let newStreak = progress.streak ?? 0;
    if (progress.lastQuizDate) {
      const last = new Date(progress.lastQuizDate);
      const diff = Math.floor((Date.now() - last.getTime()) / 86400000);
      newStreak = diff === 1 ? newStreak + 1 : diff === 0 ? newStreak : 1;
    } else {
      newStreak = 1;
    }

    const completedTopics = progress.completedTopics.includes(topicId)
      ? progress.completedTopics
      : [...progress.completedTopics, topicId];

    const newStats = {
      totalQuizzes:    progress.totalQuizzes + 1,
      totalPoints:     progress.totalPoints  + points,
      perfectScores:   progress.perfectScores + (isPerfect ? 1 : 0),
      streak:          newStreak,
      lastQuizDate:    today,
      completedTopics,
      earnedBadges:    progress.earnedBadges,
    };

    // Badges gagnés cette session
    const newBadgeIds = computeNewBadges(progress, newStats);
    newStats.earnedBadges = [...progress.earnedBadges, ...newBadgeIds];

    setProgress(newStats);

    try {
      const db  = await getDb();
      const id  = `qp_${user.uid}`;
      const now = Date.now();
      await db.runAsync(
        `INSERT OR REPLACE INTO quiz_progress
           (id, total_quizzes, total_points, perfect_scores, streak,
            last_quiz_date, completed_topics, earned_badges,
            created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(
           (SELECT created_at FROM quiz_progress WHERE id = ?), ?
         ), ?, NULL)`,
        [
          id,
          newStats.totalQuizzes,
          newStats.totalPoints,
          newStats.perfectScores,
          newStats.streak,
          newStats.lastQuizDate,
          JSON.stringify(newStats.completedTopics),
          JSON.stringify(newStats.earnedBadges),
          id, now,
          now,
        ]
      );

      // Badges → table badges
      for (const badgeId of newBadgeIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO badges (id, badge_id, earned_at, synced_at)
           VALUES (?, ?, ?, NULL)`,
          [`badge_${user.uid}_${badgeId}`, badgeId, now]
        );
      }
    } catch (_) {}

    syncTable(user?.uid, 'quiz_progress').catch(() => {});
    syncTable(user?.uid, 'badges').catch(() => {});

    return { points, isPerfect, newBadges: newBadgeIds };
  }, [progress, user?.uid]);

  return { progress, loading, saveQuizResult, reload: loadProgress };
};
