import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, getDocs, onSnapshot,
  doc, updateDoc, getDoc, setDoc, serverTimestamp,
  orderBy, limit,
} from 'firebase/firestore';
import { db as firestoreDb } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Helpers de date en heure LOCALE ──────────────────────────────────────────
// Un 'YYYY-MM-DD' seul est interprété comme minuit UTC par la spec JS (pas
// minuit local), et toISOString() fait l'inverse (local → UTC) : les deux
// décalent le jour calculé d'une unité dans les fuseaux horaires en avance
// sur UTC. Mêmes helpers que useCycle.js/CycleCalendar.js côté fille — sans
// ça, le garçon voit un jour de cycle / une date différente de sa partenaire.
const parseLocalDate = (dateStr) => new Date(dateStr + 'T00:00:00');
const toLocalDateKey  = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const today = () => toLocalDateKey(new Date());

/** Calcule le jour du cycle à partir de la dernière date de début */
const cycleDay = (lastStart) => {
  if (!lastStart) return null;
  const diff = Math.floor((Date.now() - parseLocalDate(lastStart).getTime()) / 86400000);
  return diff + 1;
};

/** Prédit la prochaine date de règles */
const nextPeriod = (lastStart, cycleLength = 28) => {
  if (!lastStart) return null;
  const d = parseLocalDate(lastStart);
  d.setDate(d.getDate() + cycleLength);
  return toLocalDateKey(d);
};

/** Phase du cycle selon le jour */
const getPhase = (day, cycleLength = 28, periodLength = 5, t = (k) => k, pinkColor = '#EC4899') => {
  if (!day) return null;
  const ovulation   = Math.round(cycleLength / 2);
  const fertileStart = ovulation - 5;
  if (day <= periodLength)                  return { label: t('phase_menstruation'), color: pinkColor, icon: '🩸', tip: t('phase_tip_menstruation') };
  if (day < fertileStart)                   return { label: t('phase_follicular'), color: '#10B981', icon: '🌱', tip: t('phase_tip_follicular') };
  if (day >= fertileStart && day <= ovulation + 1) return { label: t('phase_ovulation'),  color: '#F59E0B', icon: '⭐', tip: t('phase_tip_ovulation') };
  return { label: t('phase_luteal'),    color: '#8B5CF6', icon: '🌙', tip: t('phase_tip_luteal') };
};

/** Formate une date YYYY-MM-DD en français */
const fmtDate = (dateStr, locale = 'fr-FR') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Jours restants jusqu'à une date */
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.floor((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86400000);
  return diff;
};

// ─── Composant : mini calendrier mensuel ─────────────────────────────────────
function MiniCalendar({ cycles, settings, colors, role, spacing, radius }) {
  const { t, lang } = useLanguage();
  const styles = makeStyles(colors, role, spacing, radius);
  const [offset, setOffset] = useState(0); // mois relatifs au mois courant
  const now   = new Date();
  now.setMonth(now.getMonth() + offset);
  const year  = now.getFullYear();
  const month = now.getMonth();

  const firstDay  = new Date(year, month, 1).getDay(); // 0=dim
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad  = (firstDay + 6) % 7; // décale pour lundi=0

  const monthLabel = new Date(year, month).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' });

  const cycleLen   = settings?.cycleLength  ?? 28;
  const periodLen  = settings?.periodLength ?? 5;

  // Construire un Set de dates avec leur statut
  const dayStatus = {};
  for (const c of cycles) {
    const start = parseLocalDate(c.startDate);
    for (let i = 0; i < cycleLen; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = toLocalDateKey(d);
      if (!dayStatus[key]) {
        dayStatus[key] = i < periodLen ? 'period' : i >= Math.round(cycleLen / 2) - 5 && i <= Math.round(cycleLen / 2) + 1 ? 'fertile' : 'cycle';
      }
    }
  }

  const todayStr = today();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={styles.calCard}>
      {/* Navigation mois */}
      <View style={styles.calHeader}>
        <TouchableOpacity onPress={() => setOffset(o => o - 1)} style={styles.calNav}>
          <Ionicons name="chevron-back" size={18} color={role.boy} />
        </TouchableOpacity>
        <Text style={styles.calMonthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => setOffset(o => o + 1)} style={styles.calNav}>
          <Ionicons name="chevron-forward" size={18} color={role.boy} />
        </TouchableOpacity>
      </View>

      {/* Jours de la semaine */}
      <View style={styles.calWeekRow}>
        {[t('weekday_mon'), t('weekday_tue'), t('weekday_wed'), t('weekday_thu'), t('weekday_fri'), t('weekday_sat'), t('weekday_sun')].map((d, i) => (
          <Text key={i} style={styles.calWeekDay}>{d}</Text>
        ))}
      </View>

      {/* Grille */}
      <View style={styles.calGrid}>
        {cells.map((d, idx) => {
          if (!d) return <View key={`p${idx}`} style={styles.calCell} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const status  = dayStatus[dateStr];
          const isToday = dateStr === todayStr;
          return (
            <View key={dateStr} style={styles.calCell}>
              <View style={[
                styles.calCellInner,
                status === 'period'  && styles.calPeriod,
                status === 'fertile' && styles.calFertile,
                status === 'cycle'   && styles.calCycleDay,
                isToday && styles.calToday,
              ]}>
                <Text style={[
                  styles.calDayTxt,
                  (status === 'period' || status === 'fertile') && { color: '#fff', fontWeight: '700' },
                  isToday && { fontWeight: '900' },
                ]}>{d}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Légende */}
      <View style={styles.calLegend}>
        {[
          { color: role.girl,     label: t('period_legend') },
          { color: '#F59E0B', label: t('fertile_legend') },
          { color: role.boyLight, label: t('cycle_legend') },
        ].map(({ color, label }) => (
          <View key={label} style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: color }]} />
            <Text style={styles.calLegendTxt}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Composant : conseils d'empathie ─────────────────────────────────────────
const TIPS_KEYS = [
  { icon: '💬', key: 'partner_tip1' },
  { icon: '☕', key: 'partner_tip2' },
  { icon: '🚶', key: 'partner_tip3' },
  { icon: '🎬', key: 'partner_tip4' },
  { icon: '🙏', key: 'partner_tip5' },
];

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function PartnerScreen() {
  const { t, lang } = useLanguage();
  const { colors, role, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, role, spacing, radius, shadows);
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const TIPS = TIPS_KEYS.map(tip => ({ icon: tip.icon, text: t(tip.key) }));
  const { user } = useAuth();

  const [step,           setStep]           = useState('loading'); // loading | no_link | enter_code | linked
  const [codeInput,      setCodeInput]      = useState('');
  const [linking,        setLinking]        = useState(false);
  const [linkError,      setLinkError]      = useState('');
  const [linkDoc,        setLinkDoc]        = useState(null);  // doc partnerLink
  const [partnerData,    setPartnerData]    = useState(null);  // { name, cycles, settings }
  const [loadingData,    setLoadingData]    = useState(false);
  const [showTipsModal,  setShowTipsModal]  = useState(false);
  const [tipIdx,         setTipIdx]         = useState(0);
  const [girlSymptoms,   setGirlSymptoms]   = useState([]);

  // ── Écoute temps réel du lien partenaire ──────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // On interroge uniquement sur boyUid (1 seul champ = pas d'index composite requis)
    // puis on filtre status côté client
    const q = query(
      collection(firestoreDb, 'partnerLinks'),
      where('boyUid', '==', user.uid)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const activeDoc = snap.docs.find(d => d.data().status === 'active');
      if (activeDoc) {
        const data = activeDoc.data();
        setLinkDoc({ id: activeDoc.id, ...data });
        await loadPartnerData(data.girlUid);
        setStep('linked');
      } else {
        setStep('no_link');
      }
    }, (_err) => {
      // Fallback si index manquant : tentative sans filtre boyUid
      setStep('no_link');
    });

    return unsub;
  }, [user?.uid]);

  // ── Écoute temps réel des cycles de la partenaire ──────────────────────────
  // Auparavant un simple getDocs() ponctuel : la vue du garçon ne se mettait
  // jamais à jour quand la fille enregistrait un nouveau cycle pendant qu'il
  // consultait déjà l'écran (fallait quitter/revenir pour forcer un rechargement).
  useEffect(() => {
    const girlUid = linkDoc?.girlUid;
    if (!girlUid) return;

    const unsub = onSnapshot(
      collection(firestoreDb, 'cycles', girlUid, 'entries'),
      (snap) => {
        const cycles = snap.docs
          .map(d => d.data())
          .sort((a, b) => b.startDate.localeCompare(a.startDate))
          .slice(0, 30);
        // Ce listener peut recevoir son premier événement avant que
        // loadPartnerData() (profil/réglages) ait fini — ne pas dépendre de
        // son ordre d'arrivée, toujours initialiser des valeurs par défaut.
        setPartnerData(prev => prev
          ? { ...prev, cycles }
          : { name: t('default_partner_name'), settings: { cycleLength: 28, periodLength: 5 }, cycles });
      },
      () => {}
    );
    return unsub;
  }, [linkDoc?.girlUid]);

  // ── Charger les données de la partenaire (profil, réglages, symptômes) ─────
  const loadPartnerData = async (girlUid) => {
    setLoadingData(true);
    try {
      // Profil
      const userSnap = await getDoc(doc(firestoreDb, 'users', girlUid));
      const name = userSnap.exists() ? (userSnap.data().displayName ?? t('default_partner_name')) : t('default_partner_name');

      // Paramètres cycle
      const settingsSnap = await getDoc(doc(firestoreDb, 'cycle_settings', girlUid));
      const settings = settingsSnap.exists() ? settingsSnap.data() : { cycleLength: 28, periodLength: 5 };

      // Symptômes — 14 derniers jours
      const from14 = new Date();
      from14.setDate(from14.getDate() - 13);
      const from14Str = toLocalDateKey(from14);
      const todayStr  = toLocalDateKey(new Date());
      let symptoms = [];
      try {
        const symSnap = await getDocs(
          query(
            collection(firestoreDb, 'symptoms', girlUid, 'entries'),
            where('date', '>=', from14Str),
            where('date', '<=', todayStr),
            orderBy('date', 'desc'),
            limit(14)
          )
        );
        symptoms = symSnap.docs.map(d => d.data());
      } catch (_) {}

      // cycles rempli séparément par le listener temps réel ci-dessus
      setPartnerData(prev => ({ name, settings, cycles: prev?.cycles ?? [] }));
      setGirlSymptoms(symptoms);
    } catch (_) {}
    setLoadingData(false);
  };

  // ── Entrer un code d'invitation ─────────────────────────────────────────────
  const linkWithCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) { setLinkError(t('code_too_short')); return; }
    setLinking(true);
    setLinkError('');
    try {
      // Requête sur inviteCode uniquement (1 champ) + filtre status côté client
      const q = query(
        collection(firestoreDb, 'partnerLinks'),
        where('inviteCode', '==', code)
      );
      const snap = await getDocs(q);
      const pendingDoc = snap.docs.find(d => d.data().status === 'pending');
      if (!pendingDoc) {
        setLinkError(t('code_not_found'));
        setLinking(false);
        return;
      }
      // Recréer un snap-like pour la suite
      const fakeSnap = { empty: false, docs: [pendingDoc] };
      const linkRef  = fakeSnap.docs[0].ref;
      const linkData = fakeSnap.docs[0].data();

      // Empêcher de se lier à soi-même
      if (linkData.girlUid === user.uid) {
        setLinkError(t('cant_use_own_code'));
        setLinking(false);
        return;
      }

      await updateDoc(linkRef, {
        boyUid:    user.uid,
        status:    'active',
        linkedAt:  serverTimestamp(),
      });
      // Note : c'est ShareCycleScreen.js (côté fille) qui enregistre
      // users/{girlUid}.partnerUid = boyUid — c'est ce champ, sur SON document,
      // que la règle Firestore isLinkedPartner() vérifie pour autoriser la
      // lecture de ses cycles/symptômes par le garçon lié.

      setLinkDoc({ id: snap.docs[0].id, ...linkData, boyUid: user.uid, status: 'active' });
      await loadPartnerData(linkData.girlUid);
      setStep('linked');
    } catch (e) {
      setLinkError(t('network_error_retry'));
    }
    setLinking(false);
  };

  // ── Délier la partenaire ────────────────────────────────────────────────────
  const unlink = () => {
    Alert.alert(
      t('unlink_title'),
      t('unlink_msg'),
      [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('unlink_action'), style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(firestoreDb, 'partnerLinks', linkDoc.id), {
                boyUid:    null,
                status:    'pending',
                linkedAt:  null,
              });
              // Si c'est le garçon qui délie (pas la fille), il faut quand même
              // effacer users/{girlUid}.partnerUid, sinon la règle Firestore
              // isLinkedPartner() continue à lui donner accès à ses cycles/
              // symptômes indéfiniment après la rupture du lien.
              if (linkDoc.girlUid) {
                await setDoc(doc(firestoreDb, 'users', linkDoc.girlUid), { partnerUid: null }, { merge: true }).catch(() => {});
              }
            } catch (_) {}
            setLinkDoc(null);
            setPartnerData(null);
            setGirlSymptoms([]);
            setCodeInput('');
            setStep('no_link');
          },
        },
      ]
    );
  };

  // ── Calculs affichage ────────────────────────────────────────────────────────
  const lastCycle   = partnerData?.cycles?.[0] ?? null;
  const cDay        = cycleDay(lastCycle?.startDate);
  const phase       = getPhase(cDay, partnerData?.settings?.cycleLength, partnerData?.settings?.periodLength, t, role.girl);
  const nextP       = nextPeriod(lastCycle?.startDate, partnerData?.settings?.cycleLength);
  const daysLeft    = daysUntil(nextP);

  // ════════════════════════════════════════════════════════════════════════════
  // ── Render : Loading ────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={role.boy} />
      </View>
    );
  }

  // ── Render : pas de lien ────────────────────────────────────────────────────
  if (step === 'no_link' || step === 'enter_code') {
    return (
      <ScrollView contentContainerStyle={styles.noLinkWrap}>
        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <Text style={styles.illustrationEmoji}>💑</Text>
        </View>
        <Text style={styles.noLinkTitle}>{t('partner_mode_title')}</Text>
        <Text style={styles.noLinkSub}>
          {t('partner_mode_sub')}
        </Text>

        {/* Encart code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeCardTitle}>{t('enter_partner_code')}</Text>
          <Text style={styles.codeCardSub}>{t('enter_partner_code_sub')}</Text>

          <View style={styles.codeInputRow}>
            <TextInput
              style={styles.codeInput}
              placeholder={t('code_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={codeInput}
              onChangeText={val => { setCodeInput(val.toUpperCase()); setLinkError(''); }}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>

          {!!linkError && <Text style={styles.linkError}>{linkError}</Text>}

          <TouchableOpacity
            style={[styles.linkBtn, { opacity: codeInput.trim().length < 4 || linking ? 0.6 : 1 }]}
            onPress={linkWithCode}
            disabled={codeInput.trim().length < 4 || linking}
          >
            {linking
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="link" size={18} color="#fff" /><Text style={styles.linkBtnTxt}>{t('connect_action')}</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* Pourquoi c'est utile */}
        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>{t('why_use_mode')}</Text>
          {[
            { icon: '📅', text: t('why_tip1') },
            { icon: '💡', text: t('why_tip2') },
            { icon: '❤️', text: t('why_tip3') },
          ].map((item, i) => (
            <View key={i} style={styles.whyRow}>
              <Text style={styles.whyIcon}>{item.icon}</Text>
              <Text style={styles.whyTxt}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ── Render : lié ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Header partenaire */}
        <View style={styles.partnerHeader}>
          <View style={styles.partnerAvatar}>
            <Text style={styles.partnerAvatarTxt}>
              {partnerData?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerName}>{partnerData?.name ?? '—'}</Text>
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.connectedTxt}>{t('connected_label')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={unlink} style={styles.unlinkBtn}>
            <Ionicons name="unlink" size={16} color={colors.error} />
            <Text style={styles.unlinkTxt}>{t('unlink_action')}</Text>
          </TouchableOpacity>
        </View>

        {loadingData ? (
          <ActivityIndicator color={role.boy} style={{ marginTop: 30 }} />
        ) : (
          <>
            {/* Phase actuelle */}
            {phase && (
              <View style={[styles.phaseCard, { borderLeftColor: phase.color, borderLeftWidth: 4 }]}>
                <View style={styles.phaseRow}>
                  <Text style={styles.phaseIcon}>{phase.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.phaseLabel}>{phase.label}</Text>
                    <Text style={styles.phaseDay}>{t('cycle_day_label', { n: cDay })}</Text>
                  </View>
                  <View style={[styles.phaseBadge, { backgroundColor: phase.color + '20' }]}>
                    <Text style={[styles.phaseBadgeTxt, { color: phase.color }]}>J{cDay}</Text>
                  </View>
                </View>
                <Text style={styles.phaseTip}>{phase.tip}</Text>
              </View>
            )}

            {/* Prochaines règles */}
            {nextP && (
              <View style={styles.nextPeriodCard}>
                <Ionicons name="calendar" size={20} color={role.girl} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.nextPeriodLabel}>{t('next_period_label')}</Text>
                  <Text style={styles.nextPeriodDate}>{fmtDate(nextP, locale)}</Text>
                </View>
                <View style={[styles.daysLeftBadge, daysLeft <= 3 && { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.daysLeftTxt, daysLeft <= 3 && { color: colors.error }]}>
                    {daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? t('today_word') : `J+${Math.abs(daysLeft)}`}
                  </Text>
                </View>
              </View>
            )}

            {/* Conseils du jour */}
            <TouchableOpacity
              style={styles.tipsBtn}
              onPress={() => { setTipIdx(Math.floor(Math.random() * TIPS.length)); setShowTipsModal(true); }}
              activeOpacity={0.85}
            >
              <Ionicons name="bulb" size={20} color={role.boy} />
              <Text style={styles.tipsBtnTxt}>{t('empathy_tip_of_day')}</Text>
              <Ionicons name="chevron-forward" size={18} color={role.boy} />
            </TouchableOpacity>

            {/* Mini calendrier */}
            {partnerData?.cycles?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t('partner_cycle_calendar')}</Text>
                <MiniCalendar cycles={partnerData.cycles} settings={partnerData.settings} colors={colors} role={role} spacing={spacing} radius={radius} />
              </>
            )}

            {/* Historique */}
            {partnerData?.cycles?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t('recent_history')}</Text>
                {partnerData.cycles.slice(0, 5).map((c, i) => (
                  <View key={c.id ?? i} style={styles.historyRow}>
                    <View style={styles.historyDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyDate}>
                        {t('period_from_date', { date: fmtDate(c.startDate, locale) })}
                      </Text>
                      {c.endDate && (
                        <Text style={styles.historyDuration}>
                          {t('duration_days', { n: Math.floor((new Date(c.endDate) - new Date(c.startDate)) / 86400000) + 1 })}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Pas encore de données */}
            {(!partnerData?.cycles || partnerData.cycles.length === 0) && (
              <View style={styles.noDataCard}>
                <Text style={styles.noDataEmoji}>📭</Text>
                <Text style={styles.noDataTxt}>
                  {t('partner_no_data')}
                </Text>
              </View>
            )}

            {/* ── Symptômes 14 jours ── */}
            {girlSymptoms.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
                  {t('recent_symptoms_14d')}
                </Text>
                {girlSymptoms.map((s, i) => {
                  const MOOD_MAP = { happy:'😊', neutral:'😐', sad:'😢', anxious:'😰', energetic:'⚡' };
                  const dateObj  = new Date((s.date ?? '') + 'T00:00:00');
                  const dateLabel = dateObj.toLocaleDateString(locale, { weekday:'short', day:'numeric', month:'short' });
                  return (
                    <View key={s.id ?? i} style={styles.symCard}>
                      <View style={styles.symTop}>
                        <Text style={styles.symDate}>{dateLabel}</Text>
                        <Text style={styles.symMood}>{MOOD_MAP[s.mood] ?? '❓'}</Text>
                      </View>
                      <View style={styles.symChips}>
                        <View style={[styles.symChip, s.pain && { backgroundColor: role.girlLight }]}>
                          <Text style={[styles.symChipTxt, s.pain && { color: role.girl }]}>
                            {s.pain ? t('pain_intensity_short', { n: s.pain_intensity ?? s.painIntensity ?? '?' }) : t('no_pain_short')}
                          </Text>
                        </View>
                        <View style={styles.symChip}>
                          <Text style={styles.symChipTxt}>{t('fatigue_short', { n: s.fatigue ?? '?' })}</Text>
                        </View>
                      </View>
                      {!!s.notes && <Text style={styles.symNotes} numberOfLines={2}>{s.notes}</Text>}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal conseil */}
      <Modal
        visible={showTipsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTipsModal(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTipsModal(false)}
        >
          <View style={styles.tipModal}>
            <Text style={styles.tipModalIcon}>{TIPS[tipIdx].icon}</Text>
            <Text style={styles.tipModalTxt}>{TIPS[tipIdx].text}</Text>
            <TouchableOpacity
              style={styles.tipNextBtn}
              onPress={() => setTipIdx(i => (i + 1) % TIPS.length)}
            >
              <Text style={styles.tipNextTxt}>{t('next_tip')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTipsModal(false)}>
              <Text style={styles.tipCloseTxt}>{t('close_action')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, role, spacing, radius, shadows = {}) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // ── No link ──────────────────────────────────────────────────────────────────
  noLinkWrap:       { padding: spacing.xl, paddingBottom: 40, alignItems: 'center' },
  illustrationWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: role.boyLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  illustrationEmoji:{ fontSize: 48 },
  noLinkTitle:      { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  noLinkSub:        { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xxl },

  codeCard:         { width: '100%', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xxl, ...(shadows.md ?? {}) },
  codeCardTitle:    { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  codeCardSub:      { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  codeInputRow:     { flexDirection: 'row', marginBottom: spacing.sm },
  codeInput:        { flex: 1, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: 4, textAlign: 'center' },
  linkError:        { color: colors.error, fontSize: 13, marginBottom: spacing.sm, textAlign: 'center' },
  linkBtn:          { flexDirection: 'row', backgroundColor: role.boy, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  linkBtnTxt:       { color: '#fff', fontSize: 15, fontWeight: '700' },

  whyCard:          { width: '100%', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, ...(shadows.sm ?? {}) },
  whyTitle:         { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  whyRow:           { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  whyIcon:          { fontSize: 20 },
  whyTxt:           { flex: 1, fontSize: 14, color: colors.text, lineHeight: 21 },

  // ── Linked ───────────────────────────────────────────────────────────────────
  partnerHeader:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.md, ...(shadows.md ?? {}) },
  partnerAvatar:    { width: 48, height: 48, borderRadius: 24, backgroundColor: role.girlLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: role.girl },
  partnerAvatarTxt: { fontSize: 22, fontWeight: '800', color: role.girl },
  partnerName:      { fontSize: 16, fontWeight: '800', color: colors.text },
  connectedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  connectedTxt:     { fontSize: 12, color: colors.success, fontWeight: '600' },
  unlinkBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', borderRadius: radius.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: 6 },
  unlinkTxt:        { fontSize: 12, color: colors.error, fontWeight: '600' },

  phaseCard:        { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...(shadows.sm ?? {}) },
  phaseRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  phaseIcon:        { fontSize: 28, marginRight: spacing.md },
  phaseLabel:       { fontSize: 16, fontWeight: '700', color: colors.text },
  phaseDay:         { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  phaseBadge:       { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  phaseBadgeTxt:    { fontSize: 13, fontWeight: '800' },
  phaseTip:         { fontSize: 13, color: colors.text, lineHeight: 20, fontStyle: 'italic' },

  nextPeriodCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: role.girlLight, borderRadius: radius.md, padding: 14, marginBottom: spacing.md, borderWidth: 1, borderColor: '#FBCFE8' },
  nextPeriodLabel:  { fontSize: 12, color: colors.textSecondary },
  nextPeriodDate:   { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  daysLeftBadge:    { backgroundColor: '#FCE7F3', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  daysLeftTxt:      { fontSize: 14, fontWeight: '800', color: role.girl },

  tipsBtn:          { flexDirection: 'row', alignItems: 'center', backgroundColor: role.boyLight, borderRadius: radius.md, padding: 14, marginBottom: spacing.xxl, gap: 10, borderWidth: 1, borderColor: role.boy + '40' },
  tipsBtnTxt:       { flex: 1, fontSize: 14, fontWeight: '600', color: role.boy },

  sectionTitle:     { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  // Calendrier
  calCard:          { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xxl, ...(shadows.sm ?? {}) },
  calHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  calNav:           { padding: 6 },
  calMonthLabel:    { fontSize: 15, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  calWeekRow:       { flexDirection: 'row', marginBottom: 6 },
  calWeekDay:       { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  calGrid:          { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:          { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calCellInner:     { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  calPeriod:        { backgroundColor: role.girl },
  calFertile:       { backgroundColor: '#F59E0B' },
  calCycleDay:      { backgroundColor: role.boyLight },
  calToday:         { borderWidth: 2, borderColor: role.boy },
  calDayTxt:        { fontSize: 12, color: colors.text },
  calLegend:        { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: spacing.sm },
  calLegendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegendDot:     { width: 10, height: 10, borderRadius: 5 },
  calLegendTxt:     { fontSize: 11, color: colors.textSecondary },

  // Historique
  historyRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  historyDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: role.girl, marginTop: 5 },
  historyDate:      { fontSize: 14, fontWeight: '600', color: colors.text },
  historyDuration:  { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  noDataCard:       { alignItems: 'center', padding: 30 },
  noDataEmoji:      { fontSize: 40, marginBottom: spacing.md },
  noDataTxt:        { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Symptômes partenaire
  symCard:     { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  symTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  symDate:     { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  symMood:     { fontSize: 18 },
  symChips:    { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  symChip:     { backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  symChipTxt:  { fontSize: 12, color: colors.textSecondary },
  symNotes:    { marginTop: spacing.sm, fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },

  // Modal conseil
  modalOverlay:     { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 30 },
  tipModal:         { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xxl + 4, alignItems: 'center', width: '100%' },
  tipModalIcon:     { fontSize: 52, marginBottom: 14 },
  tipModalTxt:      { fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 24, marginBottom: spacing.xl },
  tipNextBtn:       { backgroundColor: role.boy, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl + 4, marginBottom: 10 },
  tipNextTxt:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  tipCloseTxt:      { color: colors.textSecondary, fontSize: 14 },
});
