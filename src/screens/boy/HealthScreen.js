import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHealthEntries } from '../../hooks/useHealthEntries';
import { useTheme } from '../../context/ThemeContext';
import { SmoothLineChart } from '../../components/Charts';
import { useLanguage } from '../../context/LanguageContext';

// Accent violet pour l'humeur — pas de token de rôle dédié, seul l'accent
// bleu garçon est structurel ; celui-ci reste une couleur de graphique.
const MOOD_COLOR = '#8B5CF6';

const todayLabel = (locale = 'fr-FR') =>
  new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

// ─── Slider pastilles ────────────────────────────────────────────────────────
function DotSlider({ value, onChange, color }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 3, flex: 1 }}>
      {Array.from({ length: 11 }, (_, i) => (
        <TouchableOpacity
          key={i}
          style={{ flex: 1, height: 18, borderRadius: 3, backgroundColor: i <= value ? color : colors.border }}
          onPress={() => onChange(i)}
          activeOpacity={0.7}
        />
      ))}
    </View>
  );
}

// ─── Mini graphique barres (7 derniers jours) ─────────────────────────────────
function MiniChart({ entries, metric, color, label }) {
  const { t, lang } = useLanguage();
  const { colors, spacing } = useTheme();
  const chart = makeChartStyles(colors, spacing);
  const last7 = [...entries].slice(0, 7).reverse();
  const max   = 10;

  return (
    <View style={chart.container}>
      <Text style={chart.title}>{label}</Text>
      <View style={chart.bars}>
        {last7.length === 0 ? (
          <Text style={chart.empty}>{t('no_data')}</Text>
        ) : (
          last7.map((e, i) => {
            const val    = e[metric] ?? 0;
            const height = Math.max(4, (val / max) * 60);
            const day    = new Date(e.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'narrow' });
            return (
              <View key={i} style={chart.barCol}>
                <Text style={chart.valLabel}>{val}</Text>
                <View style={chart.barBg}>
                  <View style={[chart.bar, { height, backgroundColor: color }]} />
                </View>
                <Text style={chart.dayLabel}>{day}</Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
const makeChartStyles = (colors, spacing) => StyleSheet.create({
  container: { marginBottom: spacing.sm },
  title:  { fontSize: 12, fontWeight: '700', color: colors.textGray, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  bars:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barBg:  { width: '100%', height: 60, justifyContent: 'flex-end', borderRadius: 4, backgroundColor: colors.background },
  bar:    { width: '100%', borderRadius: 4, minHeight: 4 },
  valLabel:  { fontSize: 9, fontWeight: '700', color: colors.textGray },
  dayLabel:  { fontSize: 9, color: colors.textGray },
  empty:  { color: colors.textGray, fontSize: 12, fontStyle: 'italic', paddingTop: 20 },
});

// ─── Contenu "Mon corps" (construit avec l'accent garçon fixe) ───────────────
const buildMonCorps = (boy) => [
  {
    id:    'puberte',
    icon:  'body-outline',
    color: boy,
    title: 'La puberté masculine',
    body:  `La puberté chez les garçons commence généralement entre 9 et 14 ans.\n\n**Changements physiques :**\n• Croissance rapide (poussée de taille)\n• Développement des organes génitaux\n• Apparition de poils (pubiens, aisselles, visage)\n• Mue de la voix\n• Développement musculaire\n• Apparition de l'acné\n• Premières éjaculations (souvent nocturnes)\n\n**Changements émotionnels :**\n• Humeurs plus intenses\n• Intérêt pour la sexualité\n• Besoin d'indépendance\n• Quête d'identité\n\nTous ces changements sont normaux. La puberté peut prendre 2 à 5 ans pour se compléter. Chaque garçon évolue à son propre rythme.`,
  },
  {
    id:    'ist',
    icon:  'shield-checkmark-outline',
    color: '#EF4444',
    title: 'Les IST : ce qu\'il faut savoir',
    body:  `Les Infections Sexuellement Transmissibles (IST) peuvent toucher n'importe qui ayant une activité sexuelle.\n\n**IST courantes :**\n• **Chlamydia** : souvent asymptomatique, traitable\n• **Gonorrhée** : brûlures, écoulements, traitable\n• **Syphilis** : ulcères, éruptions, traitable\n• **Herpès génital** : boutons, récurrent, gérable\n• **VIH** : virus grave mais traitable aujourd'hui\n• **HPV** : verrues, certains cancers, vaccin disponible\n\n**Comment se protéger :**\n• Préservatif à chaque rapport sexuel\n• Dépistage régulier si tu es sexuellement actif\n• Vaccination contre HPV et Hépatite B\n• Communication avec ton/ta partenaire\n\n**Important :** Un dépistage régulier est recommandé. Beaucoup d'IST n'ont pas de symptômes mais se transmettent quand même.`,
  },
  {
    id:    'faq',
    icon:  'help-circle-outline',
    color: '#10B981',
    title: 'Questions fréquentes',
    body:  `**Est-ce normal d'avoir des érections involontaires ?**\nOui, c'est très courant à l'adolescence et même à l'âge adulte. C'est une réaction physiologique normale.\n\n**La masturbation a-t-elle un impact sur la santé ?**\nC'est un sujet perçu différemment selon les cultures, les familles et les convictions personnelles ou religieuses, et ces perspectives méritent d'être respectées. Sur le plan strictement médical, elle ne cause aucune maladie ni infertilité. Si tu as des questions ou des inquiétudes à ce sujet, un professionnel de santé peut t'en parler avec sérieux et sans jugement via le Chat.\n\n**Quelle est la taille "normale" du pénis ?**\nLa taille varie énormément d'un individu à l'autre. La taille n'a pas d'impact sur la fertilité ni sur le plaisir.\n\n**Peut-on avoir des IST sans symptômes ?**\nOui. C'est pourquoi le dépistage est important même sans symptômes.\n\n**Comment savoir si j'ai un problème de fertilité ?**\nLa fertilité masculine se vérifie via un spermogramme. Consulte un médecin si tu as des inquiétudes.\n\n**Le stress affecte-t-il la santé reproductive ?**\nOui, un stress chronique peut affecter la qualité du sperme et les niveaux de testostérone.`,
  },
];

// ─── Modal article ─────────────────────────────────────────────────────────────
function ArticleModal({ article, onClose }) {
  const { t } = useLanguage();
  const { colors, role, spacing, radius } = useTheme();
  const am = makeArticleModalStyles(colors, spacing, radius);
  if (!article) return null;
  const lines = article.body.split('\n');
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[am.header, { borderBottomColor: article.color + '40' }]}>
          <TouchableOpacity onPress={onClose} style={am.back}>
            <Ionicons name="arrow-back" size={22} color={article.color} />
          </TouchableOpacity>
          <Text style={am.title} numberOfLines={1}>{article.title}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={am.scroll}>
          <Text style={am.articleTitle}>{article.title}</Text>
          <View style={[am.divider, { backgroundColor: article.color + '40' }]} />
          {lines.map((line, i) => {
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <Text key={i} style={[am.body, i > 0 && { marginTop: 4 }]}>
                {parts.map((p, j) =>
                  p.startsWith('**') && p.endsWith('**')
                    ? <Text key={j} style={{ fontWeight: '800', color: colors.text }}>{p.slice(2, -2)}</Text>
                    : <Text key={j}>{p}</Text>
                )}
              </Text>
            );
          })}
          <View style={am.tip}>
            <Ionicons name="information-circle-outline" size={16} color={role.boy} />
            <Text style={am.tipText}>
              {t('personal_question_note')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const makeArticleModalStyles = (colors, spacing, radius) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, backgroundColor: colors.card },
  back:   { padding: 6 },
  title:  { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center', marginHorizontal: spacing.sm },
  scroll: { padding: spacing.xl, paddingBottom: 48 },
  articleTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 14 },
  divider:      { height: 2, borderRadius: 1, marginBottom: 18 },
  body:   { fontSize: 15, color: colors.textLight, lineHeight: 26 },
  tip:    { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xxl, padding: spacing.md + 2, borderRadius: radius.md, backgroundColor: colors.cardLight, borderWidth: 1, borderColor: colors.border },
  tipText:{ flex: 1, fontSize: 13, color: colors.textGray, lineHeight: 19 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function HealthScreen({ onOpenChat }) {
  const { t, lang } = useLanguage();
  const { colors, role, spacing, radius, shadows } = useTheme();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { todayEntry, recentEntries, loading, addEntry } = useHealthEntries();
  const s = makeStyles(colors, role, spacing, radius, shadows);
  const MON_CORPS = buildMonCorps(role.boy);

  const [mood,    setMood]    = useState(5);
  const [stress,  setStress]  = useState(5);
  const [energy,  setEnergy]  = useState(5);
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [article, setArticle] = useState(null);

  // Pré-remplir si entrée du jour existe
  useEffect(() => {
    if (todayEntry) {
      setMood(todayEntry.mood);
      setStress(todayEntry.stress);
      setEnergy(todayEntry.energy);
      setNotes(todayEntry.notes ?? '');
    }
  }, [todayEntry]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      await addEntry(date, { mood, stress, energy, notes });
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
      <View style={s.loader}>
        <ActivityIndicator size="large" color={role.boy} />
      </View>
    );
  }

  const isEditing = !!todayEntry;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* En-tête */}
      <View style={[s.heroBanner, { backgroundColor: role.boy }]}>
        <View>
          <Text style={s.heroTitle}>{t('my_health')}</Text>
          <Text style={s.heroDate}>{todayLabel(locale)}</Text>
        </View>
        <View style={s.heroIcon}>
          <Ionicons name="fitness-outline" size={32} color="rgba(255,255,255,0.8)" />
        </View>
      </View>

      {/* ── Suivi quotidien ─────────────────────────────────────────────── */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Ionicons name="today-outline" size={20} color={role.boy} />
          <Text style={s.cardTitle}>{t('daily_tracking')}</Text>
          {isEditing && (
            <View style={s.editBadge}>
              <Ionicons name="pencil-outline" size={11} color={role.boy} />
              <Text style={s.editBadgeText}>{t('edit_label')}</Text>
            </View>
          )}
        </View>

        {/* Humeur */}
        <View style={s.sliderRow}>
          <View style={s.sliderMeta}>
            <Text style={s.sliderEmoji}>😊</Text>
            <View>
              <Text style={s.sliderLabel}>{t('mood_label')}</Text>
              <Text style={[s.sliderVal, { color: MOOD_COLOR }]}>{mood}/10</Text>
            </View>
          </View>
          <DotSlider value={mood} onChange={setMood} color={MOOD_COLOR} />
        </View>

        {/* Stress */}
        <View style={s.sliderRow}>
          <View style={s.sliderMeta}>
            <Text style={s.sliderEmoji}>😤</Text>
            <View>
              <Text style={s.sliderLabel}>{t('stress_label')}</Text>
              <Text style={[s.sliderVal, { color: colors.error }]}>{stress}/10</Text>
            </View>
          </View>
          <DotSlider value={stress} onChange={setStress} color={colors.error} />
        </View>

        {/* Énergie */}
        <View style={s.sliderRow}>
          <View style={s.sliderMeta}>
            <Text style={s.sliderEmoji}>⚡</Text>
            <View>
              <Text style={s.sliderLabel}>{t('energy_label')}</Text>
              <Text style={[s.sliderVal, { color: colors.success }]}>{energy}/10</Text>
            </View>
          </View>
          <DotSlider value={energy} onChange={setEnergy} color={colors.success} />
        </View>

        {/* Notes */}
        <TextInput
          style={s.notes}
          placeholder={t('notes_optional_placeholder')}
          placeholderTextColor={colors.textGray}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={300}
        />

        {/* Bouton save */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: saved ? colors.success : role.boy }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : saved ? (
            <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={s.saveBtnText}>{t('saved_exclaim')}</Text></>
          ) : (
            <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={s.saveBtnText}>{isEditing ? t('update_action') : t('save_action')}</Text></>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Graphiques 7 derniers jours ─────────────────────────────────── */}
      {recentEntries.length >= 2 && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="stats-chart-outline" size={20} color={role.boy} />
            <Text style={s.cardTitle}>{t('trends_7d')}</Text>
          </View>
          <SmoothLineChart
            color={MOOD_COLOR}
            height={120}
            label={t('mood_label')}
            data={[...recentEntries].reverse().slice(0, 7).map(e => ({
              value: e.mood ?? 0,
              label: new Date(e.date).toLocaleDateString(locale, { weekday: 'narrow' }),
            }))}
          />
          <View style={s.chartDivider} />
          <SmoothLineChart
            color={colors.error}
            height={120}
            label={t('stress_label')}
            data={[...recentEntries].reverse().slice(0, 7).map(e => ({
              value: e.stress ?? 0,
              label: new Date(e.date).toLocaleDateString(locale, { weekday: 'narrow' }),
            }))}
          />
          <View style={s.chartDivider} />
          <SmoothLineChart
            color={colors.success}
            height={120}
            label={t('energy_label')}
            data={[...recentEntries].reverse().slice(0, 7).map(e => ({
              value: e.energy ?? 0,
              label: new Date(e.date).toLocaleDateString(locale, { weekday: 'narrow' }),
            }))}
          />
        </View>
      )}

      {/* ── Chat spécialiste ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.chatBtn, { backgroundColor: MOOD_COLOR }]}
        onPress={onOpenChat}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
        <View>
          <Text style={s.chatBtnTitle}>{t('specialist_chat')}</Text>
          <Text style={s.chatBtnSub}>{t('specialist_chat_sub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* ── Mon corps ───────────────────────────────────────────────────── */}
      <Text style={s.sectionTitle}>{t('my_body')}</Text>

      {MON_CORPS.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={s.corpsCard}
          onPress={() => setArticle(item)}
          activeOpacity={0.85}
        >
          <View style={[s.corpsIcon, { backgroundColor: item.color + '18' }]}>
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <View style={s.corpsInfo}>
            <Text style={s.corpsTitle}>{item.title}</Text>
            <Text style={s.corpsPreview} numberOfLines={1}>
              {item.body.replace(/\*\*/g, '').split('\n')[0]}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textGray} />
        </TouchableOpacity>
      ))}

      {/* Conseil */}
      <View style={s.tipCard}>
        <Ionicons name="bulb-outline" size={16} color={role.boy} />
        <Text style={s.tipText}>
          {t('health_tip_text')}
        </Text>
      </View>

      {/* Modal article */}
      <ArticleModal article={article} onClose={() => setArticle(null)} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, role, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll:    { paddingBottom: 40 },

  heroBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroDate:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2, textTransform: 'capitalize' },
  heroIcon:  { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    borderWidth: 1, borderColor: role.boy + '40',
    ...shadows.sm,
  },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  cardTitle:     { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  editBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: role.boyLight, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md },
  editBadgeText: { fontSize: 11, color: role.boy, fontWeight: '600' },

  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 14 },
  sliderMeta:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: 80 },
  sliderEmoji: { fontSize: 22 },
  sliderLabel: { fontSize: 11, color: colors.textGray, fontWeight: '600' },
  sliderVal:   { fontSize: 13, fontWeight: '800' },

  notes: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, color: colors.text, fontSize: 14,
    minHeight: 60, borderWidth: 1, borderColor: role.boy + '40',
    marginBottom: 14, textAlignVertical: 'top',
  },
  saveBtn:     { borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md + 2 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  chartDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  chatBtn:     { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: 14, padding: spacing.xl - 2, ...shadows.lg, shadowColor: '#8B5CF6' },
  chatBtnTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  chatBtnSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textGray, textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: spacing.lg, marginTop: spacing.xxl, marginBottom: 10 },

  corpsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
    marginHorizontal: spacing.lg, marginBottom: 10,
    borderWidth: 1, borderColor: role.boy + '40',
    ...shadows.sm,
  },
  corpsIcon:    { width: 46, height: 46, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  corpsInfo:    { flex: 1 },
  corpsTitle:   { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  corpsPreview: { fontSize: 12, color: colors.textGray },

  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: role.boyLight, borderRadius: radius.md, padding: 14, marginHorizontal: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: role.boy + '40' },
  tipText: { flex: 1, fontSize: 13, color: colors.textGray, lineHeight: 20 },
});
