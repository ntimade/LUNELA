import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCycle } from '../../hooks/useCycle';
import { useTheme } from '../../context/ThemeContext';
import ShareCycleScreen from './ShareCycleScreen';
import { Sparkline, SmoothLineChart } from '../../components/Charts';
import CycleCalendar from '../../components/CycleCalendar';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';

const CARD_W = Dimensions.get('window').width * 0.62;

// ─── Carte d'un cycle (historique scrollable) ─────────────────────────────────
function CycleCard({ cycle, index, total, settings, colors, role, semantic, radius, spacing }) {
  const { t, lang } = useLanguage();
  const cycleCard = makeCycleCardStyles(colors, radius, spacing);
  const startDate = new Date(cycle.startDate + 'T00:00:00');
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const monthLabel = startDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const dayLabel   = startDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  // Durée du cycle en jours (jusqu'au suivant ou settings)
  const duration = cycle.cycleLength ?? settings?.cycleLength ?? 28;
  const periodLen = cycle.periodLength ?? settings?.periodLength ?? 5;

  // Données sparkline : jours du cycle (courbe symbolique basée sur les phases)
  const sparkData = Array.from({ length: 7 }, (_, i) => {
    const day = Math.round((i / 6) * (duration - 1)) + 1;
    const mid = Math.round(duration / 2);
    // Courbe en cloche : min au début (règles), monte (phase folliculaire), pic (ovulation), descend (lutéale)
    if (day <= periodLen) return 2;
    if (day < mid - 4) return 4 + (day - periodLen);
    if (day >= mid - 4 && day <= mid + 1) return 10;
    return Math.max(3, 10 - (day - mid - 1) * 1.2);
  });

  const PHASE_COLORS = [role.girl, semantic.success, semantic.warning, colors.secondary];
  const color = PHASE_COLORS[index % PHASE_COLORS.length];

  return (
    <View style={[cycleCard.card, { borderTopColor: color, borderTopWidth: 3 }]}>
      <View style={cycleCard.topRow}>
        <View>
          <Text style={cycleCard.month}>{monthLabel}</Text>
          <Text style={cycleCard.day}>{t('period_start_label')} {dayLabel}</Text>
        </View>
        <View style={[cycleCard.badge, { backgroundColor: color + '20' }]}>
          <Text style={[cycleCard.badgeTxt, { color }]}>{duration}j</Text>
        </View>
      </View>
      <Sparkline data={sparkData} color={color} width={CARD_W - 32} height={44} />
      <View style={cycleCard.footer}>
        <View style={cycleCard.chip}>
          <View style={[cycleCard.dot, { backgroundColor: role.girl }]} />
          <Text style={cycleCard.chipTxt}>{t('period_word_short')} {periodLen}j</Text>
        </View>
        {index === 0 && (
          <View style={[cycleCard.chip, { backgroundColor: semantic.info + '18' }]}>
            <Text style={[cycleCard.chipTxt, { color: semantic.info }]}>{t('in_progress_word')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const makeCycleCardStyles = (colors, radius, spacing) => StyleSheet.create({
  card: {
    width: CARD_W, backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg, marginRight: spacing.md,
    elevation: 3, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  month:    { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  day:      { fontSize: 11, color: colors.textGray, marginTop: 2 },
  badge:    { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { fontSize: 13, fontWeight: '800' },
  footer:   { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  chipTxt:  { fontSize: 11, color: colors.textGray },
});

// Format YYYY-MM-DD en heure LOCALE (voir CycleCalendar.js pour le pourquoi :
// toISOString() convertit en UTC et décale la date d'un jour dans les
// fuseaux horaires en avance sur UTC).
const toLocalDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fmt = (date, locale = 'fr-FR') => {
  if (!date) return '--';
  // 'date' est soit un objet Date (déjà en heure locale), soit une chaîne
  // 'YYYY-MM-DD' (qu'il faut parser en heure locale, pas UTC).
  const d = date instanceof Date ? date : new Date(date + 'T00:00:00');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
};

const daysUntil = (date) => {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
};

const buildSeverityColors = (semantic) => ({
  high:   { bg: semantic.error + '18',   border: semantic.error,   icon: semantic.error,   text: semantic.error },
  medium: { bg: semantic.warning + '18', border: semantic.warning, icon: semantic.warning, text: semantic.warning },
  low:    { bg: semantic.warning + '10', border: semantic.warning, icon: semantic.warning, text: semantic.warning },
});

export default function CycleScreen({ onOpenChat }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const SEVERITY_COLORS = buildSeverityColors(semantic);
  const { cycles, settings, anomalies, loading, addCycle, removeCycle, saveSettings, getNextPeriod, getOvulationDate, getFertileWindow, getMarkedDates, getAverageCycleLength, getCycleLengthHistory } = useCycle();
  const [showSettings, setShowSettings] = useState(false);
  const [showShare,    setShowShare]    = useState(false);
  const [cycleLen,  setCycleLen]  = useState(String(settings.cycleLength));
  const [periodLen, setPeriodLen] = useState(String(settings.periodLength));

  // Synchronise les champs quand les settings sont chargés depuis Firestore
  useEffect(() => {
    setCycleLen(String(settings.cycleLength));
    setPeriodLen(String(settings.periodLength));
  }, [settings.cycleLength, settings.periodLength]);
  const [shownAnomalyIds, setShownAnomalyIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const nextPeriod  = getNextPeriod();
  const ovulation   = getOvulationDate();
  const fertile     = getFertileWindow();
  const daysToNext  = daysUntil(nextPeriod);
  const fmtL = (date) => fmt(date, locale);

  // Alerter automatiquement pour les anomalies HIGH non encore affichées
  useEffect(() => {
    if (loading || anomalies.length === 0) return;
    const highNew = anomalies.filter(a => a.severity === 'high' && !shownAnomalyIds.includes(a.id));
    if (highNew.length === 0) return;
    const a = highNew[0];
    setShownAnomalyIds(prev => [...prev, a.id]);
    setConfirmDialog({
      title: `⚠️ ${a.title}`,
      message: `${a.message}\n\n${a.advice}`,
      buttons: [
        { text: t('ignore'), style: 'cancel' },
        { text: t('consult_expert_emoji'), onPress: () => onOpenChat?.() },
      ],
    });
  }, [anomalies, loading]);

  // Retrouve le cycle auquel un jour donné appartient (règles en cours), pour
  // savoir s'il est déjà marqué et permettre de le supprimer le cas échéant.
  const findCycleForDate = (date) => cycles.find((c) => {
    const start = new Date(c.startDate + 'T00:00:00');
    const periodLen = c.periodLength ?? settings.periodLength;
    const end = new Date(start);
    end.setDate(end.getDate() + periodLen);
    return date >= start && date < end;
  });

  const handleDayPress = ({ date }) => {
    const dateStr = toLocalDateKey(date);
    const label   = fmtL(dateStr);
    const match   = findCycleForDate(date);

    if (match) {
      setConfirmDialog({
        title: t('period_title_emoji'),
        message: t('period_already_marked', { date: label }),
        buttons: [
          { text: t('cancel_action'), style: 'cancel' },
          { text: t('delete_action'), style: 'destructive', onPress: () => removeCycle(match.id) },
        ],
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      Alert.alert(t('error_generic'), t('future_date_error'));
      return;
    }

    setConfirmDialog({
      title: t('period_start_title'),
      message: t('period_start_confirm', { date: label }),
      buttons: [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('confirm_action'),
          onPress: async () => {
            await addCycle(dateStr);
            Alert.alert(t('saved_check'), t('period_added_to_tracking', { date: label }));
          },
        },
      ],
    });
  };

  // Action rapide : marquer aujourd'hui comme début de règles, sans avoir à
  // trouver/taper le bon jour dans le calendrier.
  const handleLogToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    handleDayPress({ date: today });
  };

  const handleSaveSettings = async () => {
    const cl = parseInt(cycleLen);
    const pl = parseInt(periodLen);
    if (isNaN(cl) || cl < 21 || cl > 45) {
      Alert.alert(t('error_generic'), t('cycle_length_error')); return;
    }
    if (isNaN(pl) || pl < 2 || pl > 10) {
      Alert.alert(t('error_generic'), t('period_length_error')); return;
    }
    await saveSettings({ cycleLength: cl, periodLength: pl });
    setShowSettings(false);
    Alert.alert(t('saved_check'), t('cycle_settings_updated'));
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>{t('nav_cycle')}</Text>
            <Ionicons name="moon" size={22} color={colors.primary} />
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShare(true)}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={styles.shareBtnTxt}>{t('share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Bannière : partager le cycle avec le partenaire ─────── */}
        <TouchableOpacity style={styles.shareBanner} onPress={() => setShowShare(true)} activeOpacity={0.85}>
          <View style={styles.shareBannerIcon}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shareBannerTitle}>{t('share_cycle_title')}</Text>
            <Text style={styles.shareBannerSub}>{t('share_cycle_desc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        {/* ── Bannières d'anomalies ─────────────────────────────── */}
        {anomalies.length > 0 && anomalies.map((anomaly) => {
          const sc = SEVERITY_COLORS[anomaly.severity] || SEVERITY_COLORS.low;
          return (
            <View key={anomaly.id} style={[styles.anomalyCard, { backgroundColor: sc.bg, borderColor: sc.border }]}>
              <View style={styles.anomalyTop}>
                <Ionicons
                  name={anomaly.severity === 'high' ? 'alert-circle' : 'warning-outline'}
                  size={20} color={sc.icon}
                />
                <Text style={[styles.anomalyTitle, { color: sc.icon }]}>{anomaly.title}</Text>
              </View>
              <Text style={[styles.anomalyMsg, { color: sc.text }]}>{anomaly.message}</Text>
              <Text style={[styles.anomalyAdvice, { color: sc.text }]}>{anomaly.advice}</Text>
              {onOpenChat && (
                <TouchableOpacity
                  style={[styles.anomalyBtn, { backgroundColor: sc.icon }]}
                  onPress={onOpenChat}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubbles-outline" size={15} color="#fff" />
                  <Text style={styles.anomalyBtnText}>{t('consult_expert')}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* ── Action rapide : marquer le début des règles aujourd'hui ─────── */}
        <TouchableOpacity style={styles.logTodayBtn} onPress={handleLogToday} activeOpacity={0.85}>
          <MaterialCommunityIcons name="water-plus" size={20} color="#fff" />
          <Text style={styles.logTodayBtnText}>{t('log_period_today')}</Text>
        </TouchableOpacity>

        {/* Prochaines règles */}
        {daysToNext !== null && (
          <View style={[styles.nextCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.nextLabel}>{t('next_period_in')}</Text>
            <Text style={styles.nextDays}>
              {daysToNext > 0 ? `${daysToNext} ${t('days_word')}` : daysToNext === 0 ? t('today_word') : t('in_progress_word')}
            </Text>
            <Text style={styles.nextDate}>{fmtL(nextPeriod)}</Text>
          </View>
        )}

        {/* ── Calendrier visuel ── */}
        {/* On utilise la durée moyenne réellement observée (plutôt que la valeur
            manuelle des réglages) pour que l'ovulation/fenêtre fertile du calendrier
            corresponde exactement aux cartes d'info ci-dessous, qui utilisent le
            même calcul via getOvulationDate()/getFertileWindow(). */}
        <CycleCalendar
          cycles={cycles}
          onDayPress={handleDayPress}
          settings={{ cycleLength: getAverageCycleLength(), periodLength: settings.periodLength }}
        />

        {/* Infos cycle */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Ionicons name="ellipse" size={24} color={semantic.warning} style={{ marginBottom: 6 }} />
            <Text style={styles.infoLabel}>{t('ovulation_label')}</Text>
            <Text style={styles.infoValue}>{fmtL(ovulation)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="leaf" size={24} color={semantic.success} style={{ marginBottom: 6 }} />
            <Text style={styles.infoLabel}>{t('fertile_window')}</Text>
            <Text style={styles.infoValue}>{fertile ? `${fmtL(fertile.start)} – ${fmtL(fertile.end)}` : '--'}</Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="calendar-outline" size={24} color={colors.primary} style={{ marginBottom: 6 }} />
            <Text style={styles.infoLabel}>{t('cycle_duration')}</Text>
            <Text style={styles.infoValue}>{getAverageCycleLength()} {t('days_word')}</Text>
          </View>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="water" size={24} color={role.girl} style={{ marginBottom: 6 }} />
            <Text style={styles.infoLabel}>{t('period_duration')}</Text>
            <Text style={styles.infoValue}>{settings.periodLength} {t('days_word')}</Text>
          </View>
        </View>

        {/* ── Évolution de la durée du cycle ── */}
        {getCycleLengthHistory().length >= 2 && (
          <View style={styles.trendSection}>
            <Text style={styles.sectionTitle}>{t('cycle_trend_title')}</Text>
            <SmoothLineChart
              data={getCycleLengthHistory()}
              color={colors.primary}
              height={120}
            />
          </View>
        )}

        {/* ── Historique 5 derniers cycles (scrollable) ── */}
        {cycles.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={styles.sectionTitle}>{t('my_last_cycles')}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeTxt}>{Math.min(cycles.length, 5)}</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {cycles.slice(0, 5).map((cycle, i) => (
                <CycleCard
                  key={cycle.id ?? i}
                  cycle={cycle}
                  index={i}
                  total={Math.min(cycles.length, 5)}
                  settings={settings}
                  colors={colors}
                  role={role}
                  semantic={semantic}
                  radius={radius}
                  spacing={spacing}
                />
              ))}
            </ScrollView>
          </View>
        )}
        {cycles.length === 0 && (
          <View style={styles.emptyHistory}>
            <Ionicons name="time-outline" size={22} color={colors.textGray} />
            <Text style={styles.emptyHistoryText}>{t('no_cycle_history_hint')}</Text>
          </View>
        )}

        {/* Conseil */}
        <View style={styles.tipCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="bulb-outline" size={18} color={colors.primaryLight} />
            <Text style={styles.tipTitle}>{t('did_you_know')}</Text>
          </View>
          <Text style={styles.tipText}>
            {t('cycle_tip_text')}
          </Text>
        </View>
      </ScrollView>

      {/* Modal partage de cycle */}
      <ShareCycleScreen
        visible={showShare}
        onClose={() => setShowShare(false)}
      />

      {/* Modal paramètres */}
      <Modal visible={showSettings} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
              <Text style={styles.modalTitle}>{t('cycle_settings_title')}</Text>
            </View>
            <Text style={styles.inputLabel}>{t('cycle_length_label')}</Text>
            <TextInput
              style={styles.modalInput} value={cycleLen} onChangeText={setCycleLen}
              keyboardType="numeric" placeholder="28" placeholderTextColor={colors.textGray}
            />
            <Text style={styles.inputLabel}>{t('period_length_label')}</Text>
            <TextInput
              style={styles.modalInput} value={periodLen} onChangeText={setPeriodLen}
              keyboardType="numeric" placeholder="5" placeholderTextColor={colors.textGray}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSettings(false)}>
                <Text style={styles.cancelText}>{t('cancel_action')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                <Text style={styles.saveText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Boîte de confirmation cross-plateforme (remplace Alert.alert à boutons multiples) */}
      <ConfirmDialog
        visible={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        buttons={confirmDialog?.buttons}
        onRequestClose={() => setConfirmDialog(null)}
      />
    </View>
  );
}

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  settingsBtn: { padding: spacing.sm },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary + '15' },
  shareBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },
  shareBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.primary + '30' },
  shareBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center' },
  shareBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  shareBannerSub: { fontSize: 12, color: colors.textGray, marginTop: 2 },
  // Anomalies
  anomalyCard: { borderRadius: radius.lg, padding: 14, marginBottom: spacing.md, borderWidth: 1.5 },
  anomalyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  anomalyTitle: { fontSize: 15, fontWeight: '800' },
  anomalyMsg: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  anomalyAdvice: { fontSize: 12, lineHeight: 18, marginBottom: spacing.sm + 2 },
  anomalyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: spacing.sm, borderRadius: radius.pill },
  anomalyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  // Action rapide
  logTodayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: 15, marginBottom: spacing.lg,
    elevation: 3, shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  logTodayBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyHistory: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2,
    backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyHistoryText: { flex: 1, color: colors.textGray, fontSize: 13, lineHeight: 18 },
  // Prochaines règles
  nextCard: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
  nextLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 4 },
  nextDays: { fontSize: 36, fontWeight: '800', color: '#fff' },
  nextDate: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: colors.textGray, fontSize: 12 },
  calendar: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  infoCard: { flex: 1, minWidth: '45%', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  infoLabel: { color: colors.textGray, fontSize: 11, marginBottom: 4, textAlign: 'center' },
  infoValue: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  trendSection: {
    backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
  },
  historySection: { marginBottom: spacing.lg },
  historySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  countBadge: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tipCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.primaryLight + '55' },
  tipTitle: { color: colors.primaryLight, fontWeight: '700' },
  tipText: { color: colors.textGray, fontSize: 13, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  inputLabel: { color: colors.textLight, fontSize: 14, marginBottom: spacing.sm },
  modalInput: { backgroundColor: colors.background, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  modalButtons: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textGray, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 14, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});
