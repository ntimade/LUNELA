/**
 * PatientDataSheet.js — Dossier patient pour le spécialiste
 * Affiche : 5 derniers cycles + 14 jours de symptômes d'un patient
 * Données lues depuis Firestore en temps réel
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, getDocs, getDoc, doc, orderBy, limit,
} from 'firebase/firestore';
import { db as firestore } from '../config/firebase';
import { Sparkline } from './Charts';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const CARD_W = Dimensions.get('window').width * 0.58;

const MOOD_MAP_KEYS = {
  happy:    { emoji: '😊', color: '#10B981', labelKey: 'mood_happy' },
  neutral:  { emoji: '😐', color: '#F59E0B', labelKey: 'mood_neutral' },
  sad:      { emoji: '😢', color: '#3B82F6', labelKey: 'mood_sad' },
  anxious:  { emoji: '😰', color: '#8B5CF6', labelKey: 'mood_anxious' },
  energetic:{ emoji: '⚡', color: '#FF6B35', labelKey: 'mood_energetic' },
};

const fmtDate = (dateStr, locale = 'fr-FR') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Carte cycle ──────────────────────────────────────────────────────────────
function CycleCard({ cycle, index, settings }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { colors, role, radius, spacing, shadows } = useTheme();
  const cc = makeCycleCardStyles(colors, radius, spacing, shadows);
  const startDate = new Date(cycle.startDate + 'T00:00:00');
  const monthLabel = startDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const duration   = cycle.cycleLength ?? settings?.cycleLength ?? 28;
  const periodLen  = cycle.periodLength ?? settings?.periodLength ?? 5;

  const sparkData = Array.from({ length: 7 }, (_, i) => {
    const day = Math.round((i / 6) * (duration - 1)) + 1;
    const mid = Math.round(duration / 2);
    if (day <= periodLen) return 2;
    if (day < mid - 4) return 4 + (day - periodLen);
    if (day >= mid - 4 && day <= mid + 1) return 10;
    return Math.max(3, 10 - (day - mid - 1) * 1.2);
  });

  const COLORS_CYCLE = ['#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'];
  const color = COLORS_CYCLE[index % COLORS_CYCLE.length];

  return (
    <View style={[cc.card, { borderTopColor: color, borderTopWidth: 3 }]}>
      <View style={cc.row}>
        <Text style={cc.month}>{monthLabel}</Text>
        <View style={[cc.badge, { backgroundColor: color + '20' }]}>
          <Text style={[cc.badgeTxt, { color }]}>{duration}j</Text>
        </View>
      </View>
      <Text style={cc.start}>{t('period_start_label')} {fmtDate(cycle.startDate, locale)}</Text>
      <Sparkline data={sparkData} color={color} width={CARD_W - 32} height={40} />
      <View style={cc.chips}>
        <View style={cc.chip}>
          <View style={[cc.dot, { backgroundColor: role.girl }]} />
          <Text style={cc.chipTxt}>{t('period_word_short')} {periodLen}j</Text>
        </View>
        {index === 0 && (
          <View style={[cc.chip, { backgroundColor: '#3B82F6' + '18' }]}>
            <Text style={[cc.chipTxt, { color: '#3B82F6' }]}>{t('most_recent_label')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const makeCycleCardStyles = (colors, radius, spacing, shadows) => StyleSheet.create({
  card: {
    width: CARD_W, backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.md + 2, marginRight: spacing.sm + 2,
    ...shadows.sm,
  },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  month:    { fontSize: 12, fontWeight: '700', color: colors.text, textTransform: 'capitalize', flex: 1 },
  badge:    { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
  start:    { fontSize: 10, color: colors.textGray, marginBottom: spacing.sm },
  chips:    { flexDirection: 'row', gap: spacing.sm - 2, marginTop: spacing.sm - 2 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  dot:      { width: 5, height: 5, borderRadius: 3 },
  chipTxt:  { fontSize: 10, color: colors.textGray },
});

// ─── Carte symptôme ───────────────────────────────────────────────────────────
function SymptomRow({ item }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { colors, role, radius, spacing } = useTheme();
  const sr = makeSymptomRowStyles(colors, radius, spacing);
  const moodDef = MOOD_MAP_KEYS[item.mood];
  const mood = moodDef ? { emoji: moodDef.emoji, color: moodDef.color, label: t(moodDef.labelKey) } : { emoji: '❓', color: colors.textGray, label: '—' };
  const dateObj = new Date((item.date ?? '') + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const hasPain = item.pain || item.pain === 1;

  return (
    <View style={sr.card}>
      <View style={sr.top}>
        <Text style={sr.date}>{dateLabel}</Text>
        <View style={[sr.moodBadge, { backgroundColor: mood.color + '20' }]}>
          <Text style={sr.moodEmoji}>{mood.emoji}</Text>
          <Text style={[sr.moodTxt, { color: mood.color }]}>{mood.label}</Text>
        </View>
      </View>
      <View style={sr.chips}>
        <View style={[sr.chip, hasPain && { backgroundColor: role.girlLight, borderColor: role.girl }]}>
          <Ionicons
            name={hasPain ? 'alert-circle' : 'checkmark-circle'}
            size={12}
            color={hasPain ? role.girl : '#10B981'}
          />
          <Text style={[sr.chipTxt, hasPain && { color: role.girl }]}>
            {hasPain
              ? t('pain_intensity_short', { n: item.pain_intensity ?? item.painIntensity ?? '?' })
              : t('no_pain_short')}
          </Text>
        </View>
        <View style={sr.chip}>
          <Ionicons name="battery-half-outline" size={12} color="#F59E0B" />
          <Text style={sr.chipTxt}>{t('fatigue_short', { n: item.fatigue ?? '?' })}</Text>
        </View>
      </View>
      {!!item.notes && (
        <Text style={sr.notes} numberOfLines={3}>{item.notes}</Text>
      )}
    </View>
  );
}

const makeSymptomRowStyles = (colors, radius, spacing) => StyleSheet.create({
  card: {
    backgroundColor: colors.background, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  top:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  date:     { fontSize: 12, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  moodBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  moodEmoji:{ fontSize: 13 },
  moodTxt:  { fontSize: 11, fontWeight: '600' },
  chips:    { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: 'transparent' },
  chipTxt:  { fontSize: 11, color: colors.textGray },
  notes:    { marginTop: spacing.sm, fontSize: 11, color: colors.textGray, fontStyle: 'italic', lineHeight: 17 },
});

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PatientDataSheet({ visible, onClose, patientUid, patientName }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { colors, role, spacing, radius, shadows, typography } = useTheme();
  const s = makeSheetStyles(colors, role, spacing, radius, shadows, typography);
  const [loading,   setLoading]   = useState(true);
  const [cycles,    setCycles]    = useState([]);
  const [symptoms,  setSymptoms]  = useState([]);
  const [settings,  setSettings]  = useState({});
  const [profile,   setProfile]   = useState({});
  const [activeTab, setActiveTab] = useState('symptoms'); // 'symptoms' | 'cycles'

  useEffect(() => {
    if (!visible || !patientUid) return;
    loadData();
  }, [visible, patientUid]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Profil
      const userSnap = await getDoc(doc(firestore, 'users', patientUid));
      setProfile(userSnap.exists() ? userSnap.data() : {});

      // Paramètres cycle
      const settingsSnap = await getDoc(doc(firestore, 'cycle_settings', patientUid));
      setSettings(settingsSnap.exists() ? settingsSnap.data() : {});

      // 5 derniers cycles
      const cyclesSnap = await getDocs(
        collection(firestore, 'cycles', patientUid, 'entries')
      );
      const cyclesData = cyclesSnap.docs
        .map(d => d.data())
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .slice(0, 5);
      setCycles(cyclesData);

      // 14 jours de symptômes
      const from14 = new Date();
      from14.setDate(from14.getDate() - 13);
      const from14Str = from14.toISOString().split('T')[0];
      const todayStr  = new Date().toISOString().split('T')[0];
      const symSnap = await getDocs(
        query(
          collection(firestore, 'symptoms', patientUid, 'entries'),
          where('date', '>=', from14Str),
          where('date', '<=', todayStr),
          orderBy('date', 'desc'),
          limit(14)
        )
      );
      setSymptoms(symSnap.docs.map(d => d.data()));
    } catch (_) {}
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{(patientName ?? 'P')[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.headerName}>{patientName ?? t('default_patient_label')}</Text>
              <Text style={s.headerSub}>{t('patient_record_title')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={loadData} style={s.reloadBtn}>
            <Ionicons name="refresh-outline" size={20} color={role.specialist} />
          </TouchableOpacity>
        </View>

        {/* Onglets */}
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'symptoms' && s.tabActive]}
            onPress={() => setActiveTab('symptoms')}
          >
            <Ionicons name="clipboard-outline" size={15} color={activeTab === 'symptoms' ? role.specialist : colors.textGray} />
            <Text style={[s.tabTxt, activeTab === 'symptoms' && s.tabTxtActive]}>
              {t('symptoms_tab')}
              {symptoms.length > 0 && ` (${symptoms.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'cycles' && s.tabActive]}
            onPress={() => setActiveTab('cycles')}
          >
            <Ionicons name="moon-outline" size={15} color={activeTab === 'cycles' ? role.specialist : colors.textGray} />
            <Text style={[s.tabTxt, activeTab === 'cycles' && s.tabTxtActive]}>
              {t('cycles_tab')}
              {cycles.length > 0 && ` (${cycles.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator size="large" color={role.specialist} />
            <Text style={s.loaderTxt}>{t('loading_record')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Infos profil rapide ── */}
            <View style={s.profileRow}>
              {profile.gender && (
                <View style={[s.profileChip, s.profileChipRow]}>
                  <Ionicons
                    name={profile.gender === 'female' ? 'female' : 'male'}
                    size={13}
                    color={profile.gender === 'female' ? role.girl : role.boy}
                  />
                  <Text style={s.profileChipTxt}>
                    {t(profile.gender === 'female' ? 'profile_feminine_label' : 'profile_masculine_label')}
                  </Text>
                </View>
              )}
              {profile.birthDate && (
                <View style={s.profileChip}>
                  <Text style={s.profileChipTxt}>
                    {t('born_on', { date: fmtDate(profile.birthDate, locale) })}
                  </Text>
                </View>
              )}
              {settings.cycleLength && (
                <View style={s.profileChip}>
                  <Text style={s.profileChipTxt}>{t('cycle_approx', { n: settings.cycleLength })}</Text>
                </View>
              )}
            </View>

            {/* ── Onglet Symptômes ── */}
            {activeTab === 'symptoms' && (
              <>
                <Text style={s.sectionTitle}>{t('symptoms_14d_title')}</Text>
                {symptoms.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyEmoji}>📭</Text>
                    <Text style={s.emptyTxt}>{t('no_symptom_14d')}</Text>
                  </View>
                ) : (
                  symptoms.map((item, i) => <SymptomRow key={item.id ?? i} item={item} />)
                )}
              </>
            )}

            {/* ── Onglet Cycles ── */}
            {activeTab === 'cycles' && (
              <>
                <Text style={s.sectionTitle}>{t('last_5_cycles_title')}</Text>
                {cycles.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyEmoji}>📭</Text>
                    <Text style={s.emptyTxt}>{t('no_cycle_recorded')}</Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 16, paddingBottom: 8 }}
                  >
                    {cycles.map((cycle, i) => (
                      <CycleCard key={cycle.id ?? i} cycle={cycle} index={i} settings={settings} />
                    ))}
                  </ScrollView>
                )}

                {/* Stats rapides */}
                {cycles.length > 0 && (
                  <View style={s.statsRow}>
                    <View style={s.statBox}>
                      <Text style={s.statVal}>
                        {Math.round(cycles.reduce((sum, c) => sum + (c.cycleLength ?? settings.cycleLength ?? 28), 0) / cycles.length)}j
                      </Text>
                      <Text style={s.statLbl}>{t('avg_duration_label')}</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={s.statVal}>{cycles.length}</Text>
                      <Text style={s.statLbl}>{t('cycles_recorded_label')}</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={s.statVal}>{settings.periodLength ?? 5}j</Text>
                      <Text style={s.statLbl}>{t('period_word_short')}</Text>
                    </View>
                  </View>
                )}
              </>
            )}

          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const makeSheetStyles = (colors, role, spacing, radius, shadows, typography) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.md,
  },
  closeBtn:     { padding: 4 },
  reloadBtn:    { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: role.specialistLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontSize: 18, fontWeight: '800', color: role.specialist },
  headerName:   { ...typography.h3, color: colors.text },
  headerSub:    { fontSize: 11, color: colors.textGray, marginTop: 1 },

  tabs: {
    flexDirection: 'row', backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md + 2 },
  tabActive:   { borderBottomWidth: 2, borderBottomColor: role.specialist },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: colors.textGray },
  tabTxtActive:{ color: role.specialist },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 80 },
  loaderTxt:  { fontSize: 14, color: colors.textGray },

  scroll: { padding: spacing.lg, paddingBottom: 40 },

  profileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  profileChip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  profileChipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  profileChipTxt: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: spacing.sm },
  emptyEmoji: { fontSize: 36 },
  emptyTxt:   { fontSize: 13, color: colors.textGray, textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.lg },
  statBox:  { flex: 1, backgroundColor: colors.card, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  statVal:  { fontSize: 20, fontWeight: '800', color: colors.text },
  statLbl:  { fontSize: 10, color: colors.textGray, marginTop: 2, textAlign: 'center' },
});
