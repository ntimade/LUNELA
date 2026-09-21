import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Configuration du handler (affiche la notif même si l'app est au premier plan)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

// ─── IDs stables pour pouvoir annuler/remplacer sans doublon ─────────────────
const NOTIF_IDS = {
  PERIOD_REMINDER:  'lunela_period_reminder',
  FERTILE_REMINDER: 'lunela_fertile_reminder',
  DAILY_TIP:        'lunela_daily_tip',
};

// ─── Conseils éducatifs quotidiens ───────────────────────────────────────────
const DAILY_TIPS = [
  'Boire 1,5 L d\'eau par jour aide à réduire les crampes menstruelles.',
  'L\'exercice léger pendant les règles libère des endorphines naturelles.',
  'Le magnésium peut aider à réduire les symptômes du SPM.',
  'Tenir un journal de cycle aide à mieux comprendre son corps.',
  'La chaleur sur le bas-ventre soulage naturellement les douleurs menstruelles.',
  'Le sommeil régulier stabilise les hormones et équilibre le cycle.',
  'Réduire le sel avant les règles limite les ballonnements.',
  'Le yoga et la méditation réduisent le stress lié au cycle.',
  'Un cycle entre 21 et 35 jours est considéré comme normal.',
  'L\'ovulation survient environ 14 jours avant les prochaines règles.',
  'Le fer est important pendant les règles pour éviter la fatigue.',
  'Les oméga-3 (poissons gras, noix) réduisent l\'inflammation menstruelle.',
  'La caféine peut aggraver les douleurs menstruelles chez certaines femmes.',
  'Un suivi régulier de ton cycle te permet de détecter des irrégularités tôt.',
  'Parler de sa santé reproductive à un professionnel n\'est jamais anodin.',
  'Les crampes très intenses méritent toujours un avis médical.',
  'La fenêtre fertile dure environ 6 jours par cycle.',
  'Chaque corps est différent — compare-toi à toi-même, pas aux autres.',
  'Le stress intense peut retarder ou perturber l\'ovulation.',
  'L\'activité physique régulière améliore la santé hormonale sur le long terme.',
];

const getTodayTip = () => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
};

// ─── Demande de permission ────────────────────────────────────────────────────
const requestPermission = async () => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ─── Annuler une notification par identifiant (robuste) ──────────────────────
const cancelById = async (id) => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier === id) {
        await Notifications.cancelScheduledNotificationAsync(id);
        break;
      }
    }
  } catch (_) {}
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useNotifications = () => {
  const permGranted = useRef(false);

  useEffect(() => {
    // Canal Android requis
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('lunela', {
        name:       'LUNELA',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      }).catch(() => {});
      // Canal dédié aux messages de chat (priorité max)
      Notifications.setNotificationChannelAsync('lunela_chat', {
        name:       'Messages Chat',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        sound: 'default',
      }).catch(() => {});
    }

    requestPermission().then((granted) => {
      permGranted.current = granted;
    });
  }, []);

  // ── Rappel règles : 2 jours avant la date prévue ──────────────────────────
  const schedulePeriodReminder = useCallback(async (nextPeriodDate) => {
    if (!nextPeriodDate) return;
    const granted = permGranted.current || await requestPermission();
    if (!granted) return;

    const triggerDate = new Date(nextPeriodDate);
    triggerDate.setDate(triggerDate.getDate() - 2);
    triggerDate.setHours(8, 0, 0, 0);

    // N'enregistre que si la date est dans le futur
    if (triggerDate <= new Date()) return;

    await cancelById(NOTIF_IDS.PERIOD_REMINDER);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.PERIOD_REMINDER,
      content: {
        title: '🌸 Tes règles arrivent bientôt',
        body:  'Dans 2 jours environ. Pense à te préparer et à te ménager.',
        data:  { type: 'period_reminder' },
      },
      trigger: {
        type:    Notifications.SchedulableTriggerInputTypes.DATE,
        date:    triggerDate,
        channelId: 'lunela',
      },
    }).catch(() => {});
  }, []);

  // ── Rappel fenêtre fertile ─────────────────────────────────────────────────
  const scheduleFertileReminder = useCallback(async (fertileStart) => {
    if (!fertileStart) return;
    const granted = permGranted.current || await requestPermission();
    if (!granted) return;

    const triggerDate = new Date(fertileStart);
    triggerDate.setHours(8, 0, 0, 0);

    if (triggerDate <= new Date()) return;

    await cancelById(NOTIF_IDS.FERTILE_REMINDER);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.FERTILE_REMINDER,
      content: {
        title: '🌿 Ta période fertile commence',
        body:  'Ta fenêtre fertile débute aujourd\'hui. Pense à en tenir compte selon tes projets.',
        data:  { type: 'fertile_reminder' },
      },
      trigger: {
        type:    Notifications.SchedulableTriggerInputTypes.DATE,
        date:    triggerDate,
        channelId: 'lunela',
      },
    }).catch(() => {});
  }, []);

  // ── Conseil éducatif quotidien (récurrent à heure fixe) ───────────────────
  const scheduleDailyTip = useCallback(async (hour = 8) => {
    const granted = permGranted.current || await requestPermission();
    if (!granted) return;

    // Vérifier si déjà planifié pour éviter les doublons
    const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    const alreadySet = scheduled.some((n) => n.identifier === NOTIF_IDS.DAILY_TIP);
    if (alreadySet) return;

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.DAILY_TIP,
      content: {
        title: '💡 Conseil santé du jour',
        body:  getTodayTip(),
        data:  { type: 'daily_tip' },
      },
      trigger: {
        type:      Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute:    0,
        channelId: 'lunela',
      },
    }).catch(() => {});
  }, []);

  // ── Annuler toutes les notifications LUNELA ────────────────────────────────
  const cancelAll = useCallback(async () => {
    await Promise.all([
      cancelById(NOTIF_IDS.PERIOD_REMINDER),
      cancelById(NOTIF_IDS.FERTILE_REMINDER),
      cancelById(NOTIF_IDS.DAILY_TIP),
    ]);
  }, []);

  // ── Annuler uniquement les rappels cycle (pas le conseil quotidien) ─────────
  const cancelCycleReminders = useCallback(async () => {
    await Promise.all([
      cancelById(NOTIF_IDS.PERIOD_REMINDER),
      cancelById(NOTIF_IDS.FERTILE_REMINDER),
    ]);
  }, []);

  // ── Enregistrer le token push dans Firestore ──────────────────────────────
  const registerPushToken = useCallback(async (uid) => {
    if (!uid) return;
    if (!Device.isDevice) return; // émulateur — pas de token réel
    try {
      const granted = permGranted.current || await requestPermission();
      if (!granted) return;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'lunela-b80f3', // ton Expo project ID (slug dans app.json)
      });
      const token = tokenData.data;
      if (!token) return;

      // Sauvegarder dans Firestore users/{uid}
      await setDoc(doc(db, 'users', uid), { pushToken: token }, { merge: true });
    } catch (_) {}
  }, []);

  // ── Envoyer une notification push à quelqu'un (via Expo Push API) ─────────
  const sendPushToUser = useCallback(async (recipientUid, title, body, data = {}) => {
    if (!recipientUid) return;
    try {
      // Récupérer le token du destinataire
      const snap = await getDoc(doc(db, 'users', recipientUid));
      if (!snap.exists()) return;
      const token = snap.data()?.pushToken;
      if (!token || !token.startsWith('ExponentPushToken')) return;

      // Appel à l'API Expo Push
      await fetch('https://exp.host/--/api/v2/push/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          to:    token,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high',
          channelId: 'lunela_chat',
        }),
      });
    } catch (_) {}
  }, []);

  // ── Notification push pour spécialiste (token stocké dans 'specialists') ──
  const sendPushToSpecialist = useCallback(async (specialistUid, title, body, data = {}) => {
    if (!specialistUid) return;
    try {
      const snap = await getDoc(doc(db, 'specialists', specialistUid));
      if (!snap.exists()) return;
      const token = snap.data()?.pushToken;
      if (!token || !token.startsWith('ExponentPushToken')) return;

      await fetch('https://exp.host/--/api/v2/push/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          to:    token,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high',
          channelId: 'lunela_chat',
        }),
      });
    } catch (_) {}
  }, []);

  return {
    schedulePeriodReminder,
    scheduleFertileReminder,
    scheduleDailyTip,
    cancelAll,
    cancelCycleReminders,
    registerPushToken,
    sendPushToUser,
    sendPushToSpecialist,
  };
};
