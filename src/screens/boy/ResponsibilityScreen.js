import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Palette (accents fonctionnels — le bleu structurel vient de role.boy) ───
const GREEN      = '#10B981';
const GREEN_LIGHT= '#ECFDF5';
const AMBER      = '#F59E0B';
const AMBER_LIGHT= '#FFFBEB';
const RED        = '#EF4444';
const RED_LIGHT  = '#FEF2F2';
const PURPLE     = '#8B5CF6';
const PURPLE_LIGHT='#F5F3FF';

// ─── Données : méthodes de contraception ─────────────────────────────────────
const buildContraceptives = (BLUE, BLUE_LIGHT) => [
  {
    id: 'condom',
    name: 'Préservatif masculin',
    icon: '🛡️',
    color: BLUE,
    bg: BLUE_LIGHT,
    efficiency: '98 %',
    efficiencyNote: 'si utilisé correctement',
    protectIST: true,
    responsibility: 'Homme',
    pros: ['Protège des IST/VIH', 'Sans ordonnance', 'Pas d\'effets hormonaux', 'Immédiatement efficace'],
    cons: ['Réduction de sensation possible', 'Peut se déchirer si mal utilisé', 'Doit être mis avant chaque rapport'],
    howTo: 'Vérifier la date de péremption, ouvrir sans déchirer l\'emballage, pincer le réservoir, dérouler jusqu\'à la base du pénis en érection. Retirer après éjaculation en maintenant la base.',
  },
  {
    id: 'pill',
    name: 'Pilule contraceptive',
    icon: '💊',
    color: PURPLE,
    bg: PURPLE_LIGHT,
    efficiency: '99 %',
    efficiencyNote: 'si prise régulièrement',
    protectIST: false,
    responsibility: 'Femme',
    pros: ['Très efficace', 'Régule les cycles', 'Réduit les douleurs menstruelles'],
    cons: ['Ne protège pas des IST', 'À prendre chaque jour', 'Effets secondaires possibles', 'Sur ordonnance'],
    howTo: 'Prise quotidienne à heure fixe. Un oubli de plus de 12 h nécessite une contraception de secours. En tant que partenaire, sois compréhensif et soutenant.',
  },
  {
    id: 'iud',
    name: 'Stérilet (DIU)',
    icon: '⚕️',
    color: GREEN,
    bg: GREEN_LIGHT,
    efficiency: '99,9 %',
    efficiencyNote: 'méthode longue durée',
    protectIST: false,
    responsibility: 'Femme',
    pros: ['Très longue durée (3–10 ans)', 'Pas de contrainte quotidienne', 'Réversible'],
    cons: ['Ne protège pas des IST', 'Pose par un médecin', 'Peut causer des règles plus abondantes'],
    howTo: 'Posé par un professionnel de santé. Efficace dès la pose. En tant que partenaire, ta compréhension lors de la période d\'adaptation est essentielle.',
  },
  {
    id: 'implant',
    name: 'Implant contraceptif',
    icon: '💉',
    color: AMBER,
    bg: AMBER_LIGHT,
    efficiency: '99,9 %',
    efficiencyNote: 'méthode longue durée',
    protectIST: false,
    responsibility: 'Femme',
    pros: ['3 ans d\'efficacité', 'Discrète', 'Pas de contrainte quotidienne'],
    cons: ['Ne protège pas des IST', 'Pose médicale requise', 'Peut perturber les cycles'],
    howTo: 'Petit bâtonnet inséré sous la peau du bras par un médecin. Efficace jusqu\'à 3 ans. Ta compréhension des éventuels changements de cycle est importante.',
  },
  {
    id: 'emergency',
    name: 'Contraception d\'urgence',
    icon: '⚡',
    color: RED,
    bg: RED_LIGHT,
    efficiency: '85–95 %',
    efficiencyNote: 'dans les 72 h',
    protectIST: false,
    responsibility: 'Les deux',
    pros: ['Option de secours efficace', 'En pharmacie sans ordonnance', 'Pas de contraception longue durée requise'],
    cons: ['Pas une contraception régulière', 'Effets secondaires temporaires', 'Moins efficace au fil du temps'],
    howTo: 'À prendre dans les 72 h (idéalement 24 h) après un rapport non protégé. En tant qu\'homme, propose-la et aide à l\'obtenir rapidement. C\'est une responsabilité partagée.',
  },
  {
    id: 'dual',
    name: 'Double protection',
    icon: '✅',
    color: GREEN,
    bg: GREEN_LIGHT,
    efficiency: '> 99,9 %',
    efficiencyNote: 'combinaison recommandée',
    protectIST: true,
    responsibility: 'Les deux',
    pros: ['Protection maximale', 'Protège des IST ET grossesse', 'Recommandée par les professionnels'],
    cons: ['Demande une coordination entre les partenaires'],
    howTo: 'Combiner le préservatif (protection IST) avec une méthode hormonale ou un DIU (protection grossesse). C\'est la méthode la plus sûre pour les deux partenaires.',
  },
];

// ─── Données : consentement ───────────────────────────────────────────────────
const buildConsentPrinciples = (BLUE, BLUE_LIGHT) => [
  {
    icon: '🗣️',
    title: 'Explicite',
    color: BLUE,
    bg: BLUE_LIGHT,
    desc: 'Le consentement doit être clairement exprimé par des mots ou des actions affirmatives. Le silence, l\'absence de refus ou la passivité NE constituent PAS un consentement.',
  },
  {
    icon: '🔄',
    title: 'Révocable',
    color: PURPLE,
    bg: PURPLE_LIGHT,
    desc: 'Le consentement peut être retiré à tout moment, même si l\'activité a déjà commencé. "Non" ou "stop" signifie arrêter immédiatement, sans discussion.',
  },
  {
    icon: '🌟',
    title: 'Enthousiaste',
    color: AMBER,
    bg: AMBER_LIGHT,
    desc: 'Un vrai consentement est enthousiaste. Cherche une participation active et positive, pas juste l\'absence de résistance.',
  },
  {
    icon: '🔁',
    title: 'Continu',
    color: GREEN,
    bg: GREEN_LIGHT,
    desc: 'Le consentement doit être renouvelé pour chaque acte et chaque rencontre. Ce qui était accepté hier ne l\'est pas automatiquement aujourd\'hui.',
  },
  {
    icon: '🆓',
    title: 'Libre',
    color: RED,
    bg: RED_LIGHT,
    desc: 'Le consentement doit être donné librement, sans pression, manipulation, alcool ou autre substance altérant le jugement.',
  },
];

// ─── Données : signaux d'alerte ───────────────────────────────────────────────
const RED_FLAGS = [
  'Insister après un "non" ou une hésitation',
  'Profiter de l\'ivresse ou d\'un état altéré',
  'Ignorer les signaux non verbaux d\'inconfort',
  'Exercer une pression émotionnelle ou des menaces',
  'Retirer discrètement le préservatif (stealthing)',
  'Partager des photos intimes sans accord',
];

// ─── Composant : FormattedText ────────────────────────────────────────────────
function FmtText({ text, style }) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <Text key={i} style={{ fontWeight: '700' }}>{p}</Text>
          : p
      )}
    </Text>
  );
}

// ─── Composant : carte contraceptif ──────────────────────────────────────────
function ContraCard({ item, onPress, styles, colors }) {
  return (
    <TouchableOpacity
      style={[styles.contraCard, { borderLeftColor: item.color, borderLeftWidth: 4 }]}
      onPress={() => onPress(item)}
      activeOpacity={0.85}
    >
      <View style={styles.contraRow}>
        <View style={[styles.contraIconWrap, { backgroundColor: item.bg }]}>
          <Text style={styles.contraIcon}>{item.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contraName}>{item.name}</Text>
          <View style={styles.contraMetaRow}>
            <View style={[styles.efficiencyBadge, { backgroundColor: item.color + '20' }]}>
              <Text style={[styles.efficiencyTxt, { color: item.color }]}>{item.efficiency}</Text>
            </View>
            {item.protectIST && (
              <View style={styles.istBadge}>
                <Ionicons name="shield-checkmark" size={11} color={GREEN} />
                <Text style={styles.istTxt}>IST</Text>
              </View>
            )}
            <View style={styles.respBadge}>
              <Text style={styles.respTxt}>{item.responsibility}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Composant : modal détail contraceptif ────────────────────────────────────
function ContraModal({ item, onClose, styles, colors }) {
  const { t } = useLanguage();
  if (!item) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: item.color }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={[styles.modalIconWrap, { backgroundColor: item.bg }]}>
            <Text style={{ fontSize: 22 }}>{item.icon}</Text>
          </View>
          <Text style={styles.modalTitle}>{item.name}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* Efficacité */}
          <View style={[styles.effRow, { backgroundColor: item.bg }]}>
            <Text style={[styles.effNum, { color: item.color }]}>{item.efficiency}</Text>
            <Text style={styles.effNote}>{item.efficiencyNote}</Text>
          </View>

          {/* Avantages */}
          <Text style={styles.detailSection}>{t('advantages_label')}</Text>
          {item.pros.map((p, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bullet, { backgroundColor: GREEN }]} />
              <Text style={styles.bulletTxt}>{p}</Text>
            </View>
          ))}

          {/* Inconvénients */}
          <Text style={styles.detailSection}>{t('attention_points_label')}</Text>
          {item.cons.map((c, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bullet, { backgroundColor: AMBER }]} />
              <Text style={styles.bulletTxt}>{c}</Text>
            </View>
          ))}

          {/* Comment utiliser */}
          <Text style={styles.detailSection}>{t('how_it_works_label')}</Text>
          <View style={[styles.howToCard, { borderLeftColor: item.color }]}>
            <FmtText text={item.howTo} style={styles.howToTxt} />
          </View>

          {/* Protection IST */}
          {!item.protectIST && (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={18} color={AMBER} />
              <Text style={styles.warningTxt}>
                {t('no_ist_protection_warning')}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function ResponsibilityScreen() {
  const { t } = useLanguage();
  const { colors, role, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, role, spacing, radius, shadows);
  const CONTRACEPTIVES      = buildContraceptives(role.boy, role.boyLight);
  const CONSENT_PRINCIPLES  = buildConsentPrinciples(role.boy, role.boyLight);

  const [tab,          setTab]          = useState('contraception'); // contraception | consentement | planning
  const [selectedItem, setSelectedItem] = useState(null);
  const [openFlags,    setOpenFlags]    = useState(false);

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'contraception', label: t('tab_contraception'), icon: 'shield-checkmark' },
          { key: 'consentement',  label: t('tab_consent'),  icon: 'heart'            },
          { key: 'planning',      label: t('tab_planning'),      icon: 'calendar'         },
        ].map(tabItem => (
          <TouchableOpacity
            key={tabItem.key}
            style={[styles.tab, tab === tabItem.key && { borderBottomWidth: 2, borderBottomColor: role.boy }]}
            onPress={() => setTab(tabItem.key)}
          >
            <Ionicons
              name={tabItem.icon}
              size={16}
              color={tab === tabItem.key ? role.boy : colors.textSecondary}
            />
            <Text style={[styles.tabTxt, tab === tabItem.key && { color: role.boy }]}>{tabItem.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB : CONTRACEPTION
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'contraception' && (
          <>
            {/* Intro */}
            <View style={styles.introCard}>
              <Text style={styles.introEmoji}>🤝</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.introTitle}>{t('contra_intro_title')}</Text>
                <Text style={styles.introTxt}>
                  {t('contra_intro_text')}
                </Text>
              </View>
            </View>

            {/* Liste méthodes */}
            {CONTRACEPTIVES.map(item => (
              <ContraCard key={item.id} item={item} onPress={setSelectedItem} styles={styles} colors={colors} />
            ))}

            {/* Note IST */}
            <View style={[styles.noteCard, { borderLeftColor: role.boy }]}>
              <Ionicons name="information-circle" size={18} color={role.boy} />
              <Text style={styles.noteTxt}>
                <Text style={{ fontWeight: '700' }}>{t('important_reminder_label')}</Text> {t('important_reminder_text')}
              </Text>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB : CONSENTEMENT
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'consentement' && (
          <>
            {/* Hero */}
            <View style={[styles.heroCard, { backgroundColor: role.boyLight, borderColor: role.boy + '40' }]}>
              <Text style={styles.heroEmoji}>💬</Text>
              <Text style={styles.heroTitle}>{t('consent_hero_title')}</Text>
              <Text style={styles.heroSub}>
                {t('consent_hero_sub')}
              </Text>
            </View>

            {/* 5 principes FRIES */}
            <Text style={styles.sectionTitle}>{t('fries_principles_title')}</Text>
            {CONSENT_PRINCIPLES.map((p, i) => (
              <View key={i} style={[styles.principleCard, { borderLeftColor: p.color, borderLeftWidth: 4 }]}>
                <View style={[styles.principleIconWrap, { backgroundColor: p.bg }]}>
                  <Text style={styles.principleIcon}>{p.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.principleTitle}>{p.title}</Text>
                  <Text style={styles.principleDesc}>{p.desc}</Text>
                </View>
              </View>
            ))}

            {/* Signaux d'alerte */}
            <TouchableOpacity
              style={styles.redFlagsHeader}
              onPress={() => setOpenFlags(f => !f)}
              activeOpacity={0.85}
            >
              <View style={styles.redFlagsLeft}>
                <Ionicons name="warning" size={20} color={RED} />
                <Text style={styles.redFlagsTitle}>{t('red_flags_title')}</Text>
              </View>
              <Ionicons name={openFlags ? 'chevron-up' : 'chevron-down'} size={18} color={RED} />
            </TouchableOpacity>

            {openFlags && (
              <View style={styles.redFlagsCard}>
                {RED_FLAGS.map((flag, i) => (
                  <View key={i} style={styles.flagRow}>
                    <Ionicons name="close-circle" size={16} color={RED} />
                    <Text style={styles.flagTxt}>{flag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Communication */}
            <View style={styles.sectionTitle2Wrap}>
              <Text style={styles.sectionTitle}>{t('how_to_talk_consent')}</Text>
            </View>
            {[
              { q: '"Est-ce que tu es à l\'aise avec ça ?"',       color: GREEN  },
              { q: '"On peut s\'arrêter quand tu veux."',           color: role.boy },
              { q: '"Qu\'est-ce qui te ferait plaisir ?"',          color: PURPLE },
              { q: '"Tu veux continuer ou on s\'arrête là ?"',      color: AMBER  },
            ].map((item, i) => (
              <View key={i} style={[styles.phraseCard, { borderLeftColor: item.color, borderLeftWidth: 3 }]}>
                <Text style={[styles.phraseTxt, { color: item.color }]}>{item.q}</Text>
              </View>
            ))}

            <View style={[styles.noteCard, { borderLeftColor: GREEN }]}>
              <Ionicons name="checkmark-circle" size={18} color={GREEN} />
              <Text style={styles.noteTxt}>
                {t('consent_note_text')}
              </Text>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB : PLANNING FAMILIAL
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === 'planning' && (
          <>
            {/* Hero */}
            <View style={[styles.heroCard, { backgroundColor: GREEN_LIGHT, borderColor: GREEN + '40' }]}>
              <Text style={styles.heroEmoji}>👨‍👩‍👧</Text>
              <Text style={styles.heroTitle}>{t('planning_hero_title')}</Text>
              <Text style={styles.heroSub}>
                {t('planning_hero_sub')}
              </Text>
            </View>

            {/* Sujets à aborder */}
            <Text style={styles.sectionTitle}>{t('planning_topics_title')}</Text>
            {[
              {
                icon: '💬', color: role.boy, title: 'Désir d\'enfant',
                desc: 'Avez-vous tous les deux le désir d\'avoir un enfant ? À quel moment de votre vie ? Est-ce que vos projets s\'alignent ?',
              },
              {
                icon: '💰', color: AMBER, title: 'Préparation financière',
                desc: 'Un enfant représente un investissement important. Budget logement, santé, éducation — une planification honnête s\'impose.',
              },
              {
                icon: '🏠', color: GREEN, title: 'Stabilité du foyer',
                desc: 'Stabilité émotionnelle, logement adapté, soutien familial. L\'environnement dans lequel grandit un enfant est déterminant.',
              },
              {
                icon: '🩺', color: PURPLE, title: 'Santé préconceptionnelle',
                desc: 'Bilan médical pré-grossesse pour la femme, et toi aussi. Certaines carences ou conditions se traitent avant la conception.',
              },
              {
                icon: '📋', color: RED, title: 'Partage des responsabilités',
                desc: 'Comment vous répartissez-vous les responsabilités parentales ? Congés, soins, nuits, tâches — discuter en amont évite les déséquilibres.',
              },
            ].map((item, i) => (
              <View key={i} style={[styles.planningCard, { borderTopColor: item.color, borderTopWidth: 3 }]}>
                <View style={styles.planningHeader}>
                  <Text style={styles.planningIcon}>{item.icon}</Text>
                  <Text style={[styles.planningTitle, { color: item.color }]}>{item.title}</Text>
                </View>
                <Text style={styles.planningDesc}>{item.desc}</Text>
              </View>
            ))}

            {/* IST — dépistage */}
            <View style={[styles.noteCard, { borderLeftColor: RED }]}>
              <Ionicons name="medical" size={18} color={RED} />
              <Text style={styles.noteTxt}>
                <Text style={{ fontWeight: '700' }}>{t('ist_screening_label')}</Text> {t('ist_screening_text')}
              </Text>
            </View>

            {/* Ressources */}
            <Text style={styles.sectionTitle}>{t('useful_resources_title')}</Text>
            {[
              { icon: '🏥', label: 'Centre de santé / planning familial le plus proche', desc: 'Consultations et conseils confidentiels, souvent gratuits ou à faible coût, dans les centres de santé publics.' },
              { icon: '👩‍⚕️', label: 'Sage-femme, médecin ou infirmier(ère)', desc: 'Le premier interlocuteur fiable pour toute question sur la contraception, la fertilité ou une IST.' },
              { icon: '🌍', label: 'Organisation Mondiale de la Santé (who.int)', desc: 'Rubrique santé sexuelle et reproductive : informations fiables et à jour, disponibles partout.' },
              { icon: '💬', label: 'Chat Spécialiste LUNELA', desc: 'Pose tes questions en toute confidentialité à un professionnel de santé directement dans l\'application.' },
            ].map((r, i) => (
              <View key={i} style={styles.resourceRow}>
                <Text style={styles.resourceIcon}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resourceLabel}>{r.label}</Text>
                  <Text style={styles.resourceDesc}>{r.desc}</Text>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>

      {/* Modal détail contraceptif */}
      <ContraModal item={selectedItem} onClose={() => setSelectedItem(null)} styles={styles} colors={colors} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, role, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Tabs
  tabs:      { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, gap: 4 },
  tabTxt:    { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  // Intro
  introCard:  { flexDirection: 'row', backgroundColor: role.boyLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: role.boy + '30' },
  introEmoji: { fontSize: 30 },
  introTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  introTxt:   { fontSize: 13, color: colors.text, lineHeight: 20 },

  // Contraceptif cards
  contraCard:   { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadows.sm },
  contraRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contraIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  contraIcon:   { fontSize: 22 },
  contraName:   { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  contraMetaRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  efficiencyBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  efficiencyTxt:{ fontSize: 11, fontWeight: '700' },
  istBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: GREEN_LIGHT, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  istTxt:       { fontSize: 11, fontWeight: '700', color: GREEN },
  respBadge:    { backgroundColor: '#F1F5F9', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  respTxt:      { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  // Note card
  noteCard:     { flexDirection: 'row', borderRadius: radius.md, padding: 14, marginTop: 10, gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.card, borderLeftWidth: 3 },
  noteTxt:      { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },

  // Modal détail
  modalHeader:  { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.card, borderBottomWidth: 2 },
  modalIconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalTitle:   { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  effRow:       { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xxl, gap: spacing.md },
  effNum:       { fontSize: 28, fontWeight: '900' },
  effNote:      { fontSize: 13, color: colors.textSecondary },
  detailSection:{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10, marginTop: 6 },
  bulletRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  bullet:       { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  bulletTxt:    { flex: 1, fontSize: 14, color: colors.text, lineHeight: 21 },
  howToCard:    { backgroundColor: colors.background, borderRadius: radius.md, padding: 14, borderLeftWidth: 3, marginBottom: spacing.md },
  howToTxt:     { fontSize: 13, color: colors.text, lineHeight: 21 },
  warningCard:  { flexDirection: 'row', backgroundColor: AMBER_LIGHT, borderRadius: radius.md, padding: 14, gap: spacing.sm, alignItems: 'flex-start', borderWidth: 1, borderColor: AMBER + '40' },
  warningTxt:   { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },

  // Hero
  heroCard:     { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xxl, alignItems: 'center', borderWidth: 1 },
  heroEmoji:    { fontSize: 48, marginBottom: 10 },
  heroTitle:    { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6, textAlign: 'center' },
  heroSub:      { fontSize: 14, color: colors.text, lineHeight: 22, textAlign: 'center' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md, marginTop: 4 },
  sectionTitle2Wrap: { marginTop: spacing.xxl },

  // Consentement
  principleCard:    { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10, gap: spacing.md, alignItems: 'flex-start', ...shadows.sm },
  principleIconWrap:{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  principleIcon:    { fontSize: 22 },
  principleTitle:   { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  principleDesc:    { fontSize: 13, color: colors.text, lineHeight: 20 },

  redFlagsHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: RED_LIGHT, borderRadius: radius.md, padding: 14, marginTop: 14, marginBottom: 4 },
  redFlagsLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  redFlagsTitle: { fontSize: 14, fontWeight: '700', color: RED, flex: 1 },
  redFlagsCard:  { backgroundColor: RED_LIGHT, borderRadius: radius.md, padding: 14, marginBottom: 14, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  flagRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  flagTxt:       { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },

  phraseCard:    { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 8 },
  phraseTxt:     { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },

  // Planning
  planningCard:  { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  planningHeader:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planningIcon:  { fontSize: 22 },
  planningTitle: { fontSize: 15, fontWeight: '700' },
  planningDesc:  { fontSize: 13, color: colors.text, lineHeight: 21 },

  resourceRow:   { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10, gap: spacing.md },
  resourceIcon:  { fontSize: 24 },
  resourceLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  resourceDesc:  { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
