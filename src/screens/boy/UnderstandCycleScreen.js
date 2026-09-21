import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db as firestore } from '../../config/firebase';
import { getDb } from '../../db/database';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Phases du cycle (contenu embarqué) ──────────────────────────────────────
const CYCLE_PHASES = [
  {
    id:       'phase_1',
    number:   '01',
    label:    'Menstruation',
    days:     'Jours 1 à 5',
    icon:     'water',
    color:    '#EC4899',
    gradient: ['#FDF2F8', '#FCE7F3'],
    summary:  'L\'utérus élimine sa muqueuse. Les règles commencent.',
    detail:   `Durant cette phase, l'utérus se contracte pour expulser la muqueuse utérine (endomètre) qui s'était épaissie en prévision d'une grossesse.\n\n**Ce que vit ta partenaire :**\n• Saignements pendant 3 à 7 jours\n• Crampes abdominales (légères à intenses)\n• Fatigue accrue\n• Sautes d'humeur\n• Maux de tête possibles\n\n**Comment l'aider :**\n• Être présent et empathique\n• Proposer une bouillotte ou un soin chaud\n• Éviter les commentaires sur l'humeur\n• Lui laisser de l'espace si elle le souhaite\n• Ne pas minimiser sa douleur`,
  },
  {
    id:       'phase_2',
    number:   '02',
    label:    'Phase folliculaire',
    days:     'Jours 1 à 13',
    icon:     'sunny',
    color:    '#F59E0B',
    gradient: ['#FFFBEB', '#FEF3C7'],
    summary:  'Les follicules se développent. L\'énergie remonte.',
    detail:   `L'hypophyse libère la FSH (hormone folliculo-stimulante) qui déclenche le développement de plusieurs follicules dans les ovaires. L'un d'eux deviendra dominant.\n\n**Ce que ressent ta partenaire :**\n• Regain d'énergie progressif\n• Humeur plus positive\n• Augmentation de la sociabilité\n• Plus grande confiance en soi\n• Libido qui remonte\n\n**Le rôle des œstrogènes :**\nLes œstrogènes produits par les follicules épaississent la muqueuse utérine et favorisent une sensation générale de bien-être. C'est souvent la période où elle est la plus énergique et créative.`,
  },
  {
    id:       'phase_3',
    number:   '03',
    label:    'Ovulation',
    days:     'Jour 14 (environ)',
    icon:     'ellipse',
    color:    '#FF6B35',
    gradient: ['#FFF7ED', '#FFEDD5'],
    summary:  'Un ovule est libéré. Fertilité maximale.',
    detail:   `Déclenchée par un pic de LH (hormone lutéinisante), l'ovulation est le moment où un ovule mature est libéré par l'ovaire. Il migre dans la trompe de Fallope où il peut être fécondé.\n\n**L'ovule survit 12 à 24 heures.**\nLes spermatozoïdes peuvent vivre jusqu'à 5 jours, d'où une fenêtre fertile de ~6 jours.\n\n**Ce que ressent ta partenaire :**\n• Pic d'énergie et de confiance\n• Possible légère douleur pelvienne (mittelschmerz)\n• Glaire cervicale transparente et filante\n• Libido souvent au maximum\n\n**Pourquoi c'est important de comprendre ça ?**\nConnaître la fenêtre fertile aide à prendre des décisions éclairées concernant la contraception ou la planification familiale.`,
  },
  {
    id:       'phase_4',
    number:   '04',
    label:    'Phase lutéale',
    days:     'Jours 15 à 28',
    icon:     'moon',
    color:    '#8B5CF6',
    gradient: ['#F5F3FF', '#EDE9FE'],
    summary:  'Le corps se prépare. SPM possible en fin de phase.',
    detail:   `Après l'ovulation, le follicule vide se transforme en corps jaune qui sécrète de la progestérone. Si l'ovule n'est pas fécondé, le corps jaune se dégrade, les hormones chutent et les règles arrivent.\n\n**Ce que ressent ta partenaire :**\n• Premiers jours : calme et bien-être (progestérone)\n• Derniers jours : possibles symptômes de SPM\n  - Irritabilité, anxiété\n  - Ballonnements\n  - Seins sensibles\n  - Fatigue\n  - Envies alimentaires (sucre, sel)\n\n**SPM (Syndrome Prémenstruel) :**\nAffecte jusqu'à 75% des femmes à des degrés variables. C'est une réaction hormonale normale, pas de la "mauvaise humeur".\n\n**Ton rôle :**\nComprendre que ces changements sont physiologiques t'aide à être un meilleur partenaire et ami.`,
  },
];

// ─── Mythes et réalités ───────────────────────────────────────────────────────
const MYTHES = [
  {
    id:    'm1',
    mythe: 'Les femmes ont leurs règles une fois par mois exactement.',
    realite: 'Un cycle peut durer entre 21 et 35 jours. Beaucoup de femmes ont des cycles irréguliers, ce qui est normal.',
    icon: 'calendar-outline',
  },
  {
    id:    'm2',
    mythe: 'On ne peut pas tomber enceinte pendant les règles.',
    realite: 'C\'est possible, surtout avec un cycle court. Les spermatozoïdes peuvent vivre 5 jours dans l\'organisme.',
    icon: 'alert-circle-outline',
  },
  {
    id:    'm3',
    mythe: 'Les crampes menstruelles sont toujours légères et normales.',
    realite: 'Certaines femmes souffrent de douleurs invalidantes (dysménorrhée sévère, endométriose). Ce n\'est pas "dans la tête".',
    icon: 'medkit-outline',
  },
  {
    id:    'm4',
    mythe: 'Le SPM est juste une excuse pour être de mauvaise humeur.',
    realite: 'Le SPM est un phénomène physiologique reconnu, causé par les fluctuations hormonales. Il peut être très difficile à vivre.',
    icon: 'heart-dislike-outline',
  },
  {
    id:    'm5',
    mythe: 'Une femme ovule toujours le 14ème jour.',
    realite: 'L\'ovulation varie selon les femmes et les cycles. Elle peut survenir du 10ème au 20ème jour selon la durée du cycle.',
    icon: 'time-outline',
  },
  {
    id:    'm6',
    mythe: 'Les femmes sont irrationnelles pendant leurs règles.',
    realite: 'Les hormones influencent les émotions, mais les femmes restent pleinement capables de raisonner. Cette idée est un stéréotype sexiste.',
    icon: 'ban-outline',
  },
];

// ─── Mélange un tableau (Fisher-Yates) sans muter l'original ─────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Formattage markdown léger ────────────────────────────────────────────────
function FormattedText({ text, style }) {
  const { colors } = useTheme();
  return (
    <View>
      {text.split('\n').map((line, li) => (
        <Text key={li} style={[style, li > 0 && { marginTop: 3 }]}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, pi) =>
            part.startsWith('**') && part.endsWith('**')
              ? <Text key={pi} style={{ fontWeight: '800', color: colors.text }}>{part.slice(2, -2)}</Text>
              : <Text key={pi}>{part}</Text>
          )}
        </Text>
      ))}
    </View>
  );
}

// ─── Modal détail phase ───────────────────────────────────────────────────────
function PhaseModal({ phase, onClose }) {
  const { colors, spacing } = useTheme();
  const pm = makePhaseModalStyles(colors, spacing);
  if (!phase) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[pm.header, { backgroundColor: phase.gradient[0] }]}>
          <TouchableOpacity onPress={onClose} style={pm.back}>
            <Ionicons name="arrow-back" size={22} color={phase.color} />
          </TouchableOpacity>
          <View style={pm.headerCenter}>
            <Text style={[pm.num, { color: phase.color }]}>{phase.number}</Text>
            <Text style={pm.label}>{phase.label}</Text>
            <Text style={[pm.days, { color: phase.color }]}>{phase.days}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={pm.scroll}>
          <FormattedText text={phase.detail} style={pm.body} />
        </ScrollView>
      </View>
    </Modal>
  );
}
const makePhaseModalStyles = (colors, spacing) => StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.xxl, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  back:         { padding: 6 },
  headerCenter: { alignItems: 'center', flex: 1 },
  num:          { fontSize: 36, fontWeight: '900' },
  label:        { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },
  days:         { fontSize: 13, fontWeight: '600', marginTop: 4 },
  scroll:       { padding: spacing.xl, paddingBottom: 48 },
  body:         { fontSize: 15, color: colors.textLight, lineHeight: 26 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function UnderstandCycleScreen({ onGoToQuiz }) {
  const { t } = useLanguage();
  const { colors, role, spacing, radius, shadows } = useTheme();
  const s = makeStyles(colors, role, spacing, radius, shadows);
  const [loading,       setLoading]       = useState(true);
  const [activePhase,   setActivePhase]   = useState(null);
  const [showMythe,     setShowMythe]     = useState(null);
  const [extraContent,  setExtraContent]  = useState([]);
  // Ordre mélangé à chaque ouverture de l'écran pour varier le contenu affiché
  const [mythes]        = useState(() => shuffle(MYTHES));

  useEffect(() => { loadExtra(); }, []);

  // Contenu supplémentaire depuis SQLite / Firestore (profil 'boy' ou 'both')
  const loadExtra = async () => {
    try {
      const db = await getDb();
      const cached = await db.getAllAsync(
        `SELECT * FROM educational_content WHERE target_profile IN ('boy','both') ORDER BY sort_order ASC`
      );
      if (cached.length > 0) { setExtraContent(cached); setLoading(false); return; }

      const snap = await getDocs(
        query(collection(firestore, 'educationalContent'), where('targetProfile', 'in', ['boy', 'both']))
      );
      if (!snap.empty) {
        const now  = Date.now();
        const rows = [];
        for (const d of snap.docs) {
          const data = d.data();
          await db.runAsync(
            `INSERT OR REPLACE INTO educational_content (id, target_profile, category, title, body, sort_order, cached_at) VALUES (?,?,?,?,?,?,?)`,
            [d.id, data.targetProfile ?? 'both', data.category ?? '', data.title ?? '', data.body ?? '', data.order ?? 0, now]
          );
          rows.push({ id: d.id, title: data.title, body: data.body, category: data.category });
        }
        setExtraContent(rows);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

      {/* En-tête */}
      <View style={[s.hero, { backgroundColor: role.boy }]}>
        <View>
          <Text style={s.heroTitle}>{t('understand_cycle_title')}</Text>
          <Text style={s.heroSub}>{t('understand_cycle_sub')}</Text>
        </View>
        <Ionicons name="school-outline" size={36} color="rgba(255,255,255,0.7)" />
      </View>

      {/* Intro */}
      <View style={s.introBanner}>
        <Ionicons name="information-circle-outline" size={18} color={role.boy} />
        <Text style={s.introText}>
          {t('understand_cycle_intro')}
        </Text>
      </View>

      {/* ── 4 phases ─────────────────────────────────────────────────────── */}
      <Text style={s.sectionTitle}>{t('four_phases')}</Text>

      {CYCLE_PHASES.map((phase) => (
        <TouchableOpacity
          key={phase.id}
          onPress={() => setActivePhase(phase)}
          activeOpacity={0.85}
        >
          <View style={[s.phaseCard, { backgroundColor: phase.gradient[0], borderColor: phase.color + '40' }]}>
            <View style={[s.phaseNum, { backgroundColor: phase.color }]}>
              <Text style={s.phaseNumText}>{phase.number}</Text>
            </View>
            <View style={s.phaseInfo}>
              <View style={s.phaseTop}>
                <Text style={s.phaseLabel}>{phase.label}</Text>
                <Text style={[s.phaseDays, { color: phase.color }]}>{phase.days}</Text>
              </View>
              <Text style={s.phaseSummary}>{phase.summary}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={phase.color} />
          </View>
        </TouchableOpacity>
      ))}

      {/* ── Bouton Quiz ───────────────────────────────────────────────────── */}
      <TouchableOpacity style={s.quizBtn} onPress={onGoToQuiz} activeOpacity={0.85}>
        <Ionicons name="trophy-outline" size={22} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={s.quizBtnTitle}>{t('test_knowledge')}</Text>
          <Text style={s.quizBtnSub}>{t('quiz_badges_sub')}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>

      {/* ── Mythes et réalités ────────────────────────────────────────────── */}
      <Text style={s.sectionTitle}>{t('myths_realities')}</Text>

      {mythes.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={s.mytheCard}
          onPress={() => setShowMythe(showMythe?.id === item.id ? null : item)}
          activeOpacity={0.85}
        >
          <View style={s.mytheHeader}>
            <View style={s.mytheIconBox}>
              <Ionicons name={item.icon} size={18} color={role.boy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.mytheLabel}>{t('myth_label')}</Text>
              <Text style={s.mytheText}>{item.mythe}</Text>
            </View>
            <Ionicons
              name={showMythe?.id === item.id ? 'chevron-up' : 'chevron-down'}
              size={18} color={colors.textGray}
            />
          </View>
          {showMythe?.id === item.id && (
            <View style={s.realiteBox}>
              <View style={s.realiteHeader}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={s.realiteLabel}>{t('reality_label')}</Text>
              </View>
              <Text style={s.realiteText}>{item.realite}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Contenu extra depuis Firestore/SQLite */}
      {!loading && extraContent.length > 0 && (
        <>
          <Text style={s.sectionTitle}>{t('go_further')}</Text>
          {extraContent.map((item) => (
            <View key={item.id} style={s.extraCard}>
              <Text style={s.extraTitle}>{item.title}</Text>
              <Text style={s.extraBody} numberOfLines={3}>
                {(item.body ?? '').replace(/\*\*/g, '').split('\n')[0]}
              </Text>
            </View>
          ))}
        </>
      )}

      {loading && <ActivityIndicator color={role.boy} style={{ marginTop: 16 }} />}

      {/* Rappel */}
      <View style={s.tipCard}>
        <Ionicons name="bulb-outline" size={16} color={role.boy} />
        <Text style={s.tipText}>
          {t('understand_cycle_tip')}
        </Text>
      </View>

      {/* Modal phase */}
      <PhaseModal phase={activePhase} onClose={() => setActivePhase(null)} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, role, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll:    { paddingBottom: 40 },

  hero: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },

  introBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: role.boyLight, borderRadius: radius.md, padding: spacing.md + 2,
    margin: spacing.lg, borderWidth: 1, borderColor: role.boy + '40',
  },
  introText: { flex: 1, fontSize: 13, color: colors.textGray, lineHeight: 19 },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: colors.textGray,
    textTransform: 'uppercase', letterSpacing: 1,
    marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: 10,
  },

  // Phases
  phaseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: radius.lg, padding: 14, marginHorizontal: spacing.lg, marginBottom: 10,
    borderWidth: 1,
    ...shadows.sm,
  },
  phaseNum:     { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  phaseNumText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  phaseInfo:    { flex: 1 },
  phaseTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  phaseLabel:   { fontSize: 15, fontWeight: '800', color: colors.text },
  phaseDays:    { fontSize: 11, fontWeight: '600' },
  phaseSummary: { fontSize: 13, color: colors.textGray, lineHeight: 18 },

  // Quiz bouton
  quizBtn:     { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm, borderRadius: radius.lg, backgroundColor: '#F59E0B', flexDirection: 'row', alignItems: 'center', gap: 14, padding: spacing.lg, ...shadows.lg, shadowColor: '#F59E0B' },
  quizBtnTitle:{ color: '#fff', fontSize: 15, fontWeight: '800' },
  quizBtnSub:  { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  // Mythes
  mytheCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, marginHorizontal: spacing.lg, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  mytheHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  mytheIconBox: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: role.boyLight, justifyContent: 'center', alignItems: 'center' },
  mytheLabel:   { fontSize: 9, fontWeight: '800', color: colors.error, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  mytheText:    { fontSize: 13, color: colors.text, fontWeight: '600', lineHeight: 18 },
  realiteBox:   { backgroundColor: '#F0FDF4', borderTopWidth: 1, borderTopColor: '#D1FAE5', padding: 14 },
  realiteHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  realiteLabel: { fontSize: 9, fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: 1 },
  realiteText:  { fontSize: 13, color: '#065F46', lineHeight: 19 },

  // Extra
  extraCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginHorizontal: spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  extraTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  extraBody:  { fontSize: 13, color: colors.textGray, lineHeight: 18 },

  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: role.boyLight, borderRadius: radius.md, padding: 14, marginHorizontal: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderColor: role.boy + '40' },
  tipText: { flex: 1, fontSize: 13, color: colors.textGray, lineHeight: 20 },
});
