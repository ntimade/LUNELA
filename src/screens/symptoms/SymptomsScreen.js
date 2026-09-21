import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSymptoms } from '../../hooks/useSymptoms';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

const buildMoods = (semantic, colors) => [
  { key: 'happy',    emoji: '😊', labelKey: 'mood_happy',     color: semantic.success },
  { key: 'neutral',  emoji: '😐', labelKey: 'mood_neutral',   color: semantic.warning },
  { key: 'sad',      emoji: '😢', labelKey: 'mood_sad',       color: semantic.info },
  { key: 'anxious',  emoji: '😰', labelKey: 'mood_anxious',   color: colors.secondary },
  { key: 'energetic',emoji: '⚡', labelKey: 'mood_energetic', color: '#FF6B35' },
];

const todayLabel = (locale) => {
  return new Date().toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
};

// ─── Slider personnalisé (sans lib externe) ───────────────────────────────────

function SimpleSlider({ value, onChange, min = 0, max = 10, color, colors }) {
  const accent = color ?? colors.primary;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <View style={slider.row}>
      {steps.map((step) => (
        <TouchableOpacity
          key={step}
          style={[
            slider.dot,
            { backgroundColor: step <= value ? accent : colors.border },
          ]}
          onPress={() => onChange(step)}
          activeOpacity={0.7}
        />
      ))}
    </View>
  );
}

const slider = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center', flex: 1 },
  dot: { flex: 1, height: 20, borderRadius: 4 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

// ─── Composant carte historique ───────────────────────────────────────────────

const buildMoodMap = (semantic, colors) => ({
  happy:    { emoji: '😊', color: semantic.success },
  neutral:  { emoji: '😐', color: semantic.warning },
  sad:      { emoji: '😢', color: semantic.info },
  anxious:  { emoji: '😰', color: colors.secondary },
  energetic:{ emoji: '⚡', color: '#FF6B35' },
});

function HistoryCard({ item, colors, role, semantic, radius, spacing }) {
  const { t, lang } = useLanguage();
  const hs = makeHsStyles(colors, radius, spacing);
  const MOOD_MAP = buildMoodMap(semantic, colors);
  const mood  = MOOD_MAP[item.mood] ?? { emoji: '❓', color: colors.textGray };
  const dateObj = new Date(item.date + 'T00:00:00');
  const label   = dateObj.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <View style={hs.card}>
      {/* Date + humeur */}
      <View style={hs.top}>
        <Text style={hs.date}>{label}</Text>
        <View style={[hs.moodBadge, { backgroundColor: mood.color + '20' }]}>
          <Text style={hs.moodEmoji}>{mood.emoji}</Text>
        </View>
      </View>

      {/* Indicateurs */}
      <View style={hs.indicators}>
        {/* Douleur */}
        <View style={hs.chip}>
          <View style={[hs.dot, { backgroundColor: item.pain ? role.girl : colors.border }]} />
          <Text style={hs.chipTxt}>
            {item.pain ? t('pain_intensity_short', { n: item.painIntensity }) : t('no_pain_short')}
          </Text>
        </View>
        {/* Fatigue */}
        <View style={hs.chip}>
          <View style={[hs.dot, { backgroundColor: semantic.warning }]} />
          <Text style={hs.chipTxt}>{t('fatigue_short', { n: item.fatigue })}</Text>
        </View>
      </View>

      {/* Notes */}
      {!!item.notes && (
        <Text style={hs.notes} numberOfLines={2}>{item.notes}</Text>
      )}
    </View>
  );
}

const makeHsStyles = (colors, radius, spacing) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm + 2,
    borderWidth: 1, borderColor: colors.border,
  },
  top:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  date:      { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  moodBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  moodEmoji: { fontSize: 16 },
  indicators:{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  chipTxt:   { fontSize: 12, color: colors.textGray },
  notes:     { marginTop: spacing.sm, fontSize: 12, color: colors.textGray, fontStyle: 'italic', lineHeight: 18 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function SymptomsScreen() {
  const { t, lang } = useLanguage();
  const { colors, role, semantic, spacing, radius } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const MOODS = buildMoods(semantic, colors);
  const { todaySymptom, recentSymptoms, loading, addSymptom } = useSymptoms();

  const [view,           setView]          = useState('journal'); // 'journal' | 'history'
  const [mood,          setMood]          = useState(null);
  const [pain,          setPain]          = useState(false);
  const [painIntensity, setPainIntensity] = useState(3);
  const [fatigue,       setFatigue]       = useState(3);
  const [notes,         setNotes]         = useState('');
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  // Pré-remplir si entrée du jour déjà existante
  useEffect(() => {
    if (todaySymptom) {
      setMood(todaySymptom.mood);
      setPain(todaySymptom.pain);
      setPainIntensity(todaySymptom.painIntensity ?? 3);
      setFatigue(todaySymptom.fatigue ?? 3);
      setNotes(todaySymptom.notes ?? '');
    }
  }, [todaySymptom]);

  const handleSave = async () => {
    if (!mood) {
      Alert.alert(t('missing_mood_title'), t('missing_mood_msg'));
      return;
    }
    setSaving(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      await addSymptom(date, { mood, pain, painIntensity, fatigue, notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (_) {
      Alert.alert(t('error_generic'), t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const selectedMood = MOODS.find((m) => m.key === mood);
  const isEditing    = !!todaySymptom;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('my_journal')}</Text>
            <Text style={styles.dateLabel}>{todayLabel(lang === 'en' ? 'en-US' : 'fr-FR')}</Text>
          </View>
          {isEditing && view === 'journal' && (
            <View style={styles.editBadge}>
              <Ionicons name="pencil-outline" size={13} color={colors.primary} />
              <Text style={styles.editBadgeText}>{t('edit_label')}</Text>
            </View>
          )}
        </View>

        {/* Onglets Journal / Historique */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, view === 'journal' && styles.tabActive]}
            onPress={() => setView('journal')}
          >
            <Ionicons name="create-outline" size={16} color={view === 'journal' ? colors.primary : colors.textGray} />
            <Text style={[styles.tabTxt, view === 'journal' && { color: colors.primary }]}>{t('journal_tab')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, view === 'history' && styles.tabActive]}
            onPress={() => setView('history')}
          >
            <Ionicons name="time-outline" size={16} color={view === 'history' ? colors.primary : colors.textGray} />
            <Text style={[styles.tabTxt, view === 'history' && { color: colors.primary }]}>{t('history_tab')}</Text>
            {recentSymptoms.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeTxt}>{recentSymptoms.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {view === 'journal' && (
        <>
        {/* Humeur */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="happy-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>{t('how_do_you_feel')}</Text>
          </View>
          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const isSelected = mood === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    styles.moodBtn,
                    isSelected && { backgroundColor: m.color + '20', borderColor: m.color },
                  ]}
                  onPress={() => setMood(m.key)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, isSelected && { color: m.color, fontWeight: '700' }]}>
                    {t(m.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedMood && (
            <View style={[styles.moodFeedback, { backgroundColor: selectedMood.color + '15' }]}>
              <Text style={[styles.moodFeedbackText, { color: selectedMood.color }]}>
                {t('feeling_today', { mood: selectedMood.emoji, label: t(selectedMood.labelKey).toLowerCase() })}
              </Text>
            </View>
          )}
        </View>

        {/* Douleurs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="body-outline" size={20} color={role.girl} />
            <Text style={styles.cardTitle}>{t('pains_title')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.toggleRow, pain && { borderColor: role.girl, backgroundColor: role.girlLight }]}
            onPress={() => setPain(!pain)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleLabel, pain && { color: role.girl }]}>
              {pain ? t('has_pain') : t('no_pain')}
            </Text>
            <View style={[styles.toggleSwitch, pain && { backgroundColor: role.girl }]}>
              <View style={[styles.toggleThumb, pain && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          {pain && (
            <View style={styles.sliderBlock}>
              <View style={styles.sliderLabelRow}>
                <Text style={styles.sliderLabel}>{t('intensity_label')}</Text>
                <Text style={[styles.sliderValue, { color: role.girl }]}>{painIntensity}/10</Text>
              </View>
              <SimpleSlider
                value={painIntensity}
                onChange={setPainIntensity}
                color={role.girl}
                colors={colors}
              />
              <View style={styles.sliderHints}>
                <Text style={styles.sliderHint}>{t('pain_mild')}</Text>
                <Text style={styles.sliderHint}>{t('pain_unbearable')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Fatigue */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="battery-half-outline" size={20} color={semantic.warning} />
            <Text style={styles.cardTitle}>{t('energy_level')}</Text>
          </View>
          <View style={styles.sliderBlock}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderLabel}>{t('fatigue_label')}</Text>
              <Text style={[styles.sliderValue, { color: semantic.warning }]}>{fatigue}/10</Text>
            </View>
            <SimpleSlider
              value={fatigue}
              onChange={setFatigue}
              color={semantic.warning}
              colors={colors}
            />
            <View style={styles.sliderHints}>
              <Text style={styles.sliderHint}>{t('fatigue_exhausted')}</Text>
              <Text style={styles.sliderHint}>{t('fatigue_energetic')}</Text>
            </View>
          </View>
        </View>

        {/* Notes libres */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="create-outline" size={20} color={colors.textGray} />
            <Text style={styles.cardTitle}>{t('notes_facultative')}</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            placeholder={t('notes_symptom_placeholder')}
            placeholderTextColor={colors.textGray}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{notes.length}/500</Text>
        </View>

        {/* Bouton enregistrer */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saved ? semantic.success : colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : saved ? (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{t('saved_exclaim')}</Text>
            </>
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>
                {isEditing ? t('update_action') : t('save_action')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Conseil du jour */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={16} color={colors.primaryLight} />
          <Text style={styles.tipText}>
            {t('symptom_tip_text')}
          </Text>
        </View>
        </>
        )}

        {/* ── Historique 14 jours ── */}
        {view === 'history' && (
          <View style={styles.historySection}>
            {recentSymptoms.length > 0 ? (
              recentSymptoms.map((item) => (
                <HistoryCard key={item.id} item={item} colors={colors} role={role} semantic={semantic} radius={radius} spacing={spacing} />
              ))
            ) : (
              <View style={styles.historyEmpty}>
                <Ionicons name="time-outline" size={40} color={colors.border} />
                <Text style={styles.historyEmptyTxt}>
                  {t('no_symptom_history')}
                </Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll:    { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.xl,
  },
  title:     { fontSize: 26, fontWeight: '800', color: colors.text },
  dateLabel: { fontSize: 14, color: colors.textGray, marginTop: 2, textTransform: 'capitalize' },
  editBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '15', borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  editBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

  tabs: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md,
    padding: 4, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.primary + '15' },
  tabTxt:    { fontSize: 13, fontWeight: '600', color: colors.textGray },
  tabBadge:  { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 2 },
  tabBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  historyEmpty: { alignItems: 'center', paddingVertical: 40, gap: spacing.md, paddingHorizontal: spacing.xl },
  historyEmptyTxt: { fontSize: 13, color: colors.textGray, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.lg, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 14 },
  cardTitle:  { fontSize: 16, fontWeight: '700', color: colors.text },

  // Humeur
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  moodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    gap: 4,
  },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontSize: 10, color: colors.textGray, textAlign: 'center' },
  moodFeedback: {
    marginTop: spacing.md, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md,
  },
  moodFeedbackText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Toggle douleur
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: spacing.md + 2,
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  toggleLabel:     { fontSize: 14, color: colors.textGray, fontWeight: '600' },
  toggleSwitch: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: colors.border, justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleThumb: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Sliders
  sliderBlock:    { marginTop: spacing.md + 2 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sliderLabel:    { fontSize: 14, color: colors.textLight, fontWeight: '600' },
  sliderValue:    { fontSize: 14, fontWeight: '800' },
  sliderHints: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
  },
  sliderHint: { fontSize: 10, color: colors.textGray },

  // Notes
  notesInput: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md + 2, color: colors.text, fontSize: 14,
    minHeight: 90, lineHeight: 22,
    borderWidth: 1, borderColor: colors.border,
  },
  charCount: { textAlign: 'right', fontSize: 11, color: colors.textGray, marginTop: 4 },

  // Bouton save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 17,
    borderRadius: radius.pill,
    marginBottom: spacing.lg, marginTop: 4,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Historique
  historySection:       { marginTop: 4 },

  // Conseil
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2,
    backgroundColor: colors.card, borderRadius: radius.md, padding: 14,
    borderWidth: 1, borderColor: colors.primaryLight + '44',
  },
  tipText: { flex: 1, color: colors.textGray, fontSize: 13, lineHeight: 20 },
});
