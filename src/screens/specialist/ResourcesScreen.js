import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Linking, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, orderBy, getDocs,
  addDoc, serverTimestamp, where,
} from 'firebase/firestore';
import { db as firestoreDb } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Palette catégories ───────────────────────────────────────────────────────
// L'accent "guideline" reprend `role.specialist` (sarcelle) — l'identité de
// marque du rôle spécialiste — les autres restent des couleurs de catégorie.
const PURPLE = '#8B5CF6';
const BLUE   = '#3B82F6';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

const makeCategoryColors = (role) => ({
  protocol:  { bg: '#EFF6FF', border: '#BFDBFE',        text: BLUE   },
  guideline: { bg: role.specialistLight, border: role.specialist + '55', text: role.specialist },
  article:   { bg: '#F5F3FF', border: '#DDD6FE',        text: PURPLE },
  tool:      { bg: '#FFFBEB', border: '#FDE68A',        text: AMBER  },
  formation: { bg: '#ECFDF5', border: '#A7F3D0',        text: '#059669' },
  contact:   { bg: '#FEF2F2', border: '#FECACA',        text: RED    },
});

// ─── Catégories ───────────────────────────────────────────────────────────────
export const RESOURCE_CATEGORY_KEYS = [
  { id: 'all',            labelKey: 'cat_all',           icon: 'grid-outline'              },
  { id: 'protocol',       labelKey: 'cat_protocols',     icon: 'document-text-outline'     },
  { id: 'guideline',      labelKey: 'cat_guidelines',     icon: 'clipboard-outline'         },
  { id: 'article',        labelKey: 'cat_articles',       icon: 'journal-outline'           },
  { id: 'tool',           labelKey: 'cat_tools',         icon: 'construct-outline'         },
  { id: 'formation',      labelKey: 'cat_formations',     icon: 'school-outline'            },
  { id: 'contact',        labelKey: 'cat_contacts',       icon: 'call-outline'              },
];

// ─── Ressources intégrées par défaut ──────────────────────────────────────────
const DEFAULT_RESOURCES = [
  // Protocoles
  {
    id: 'def_1', category: 'protocol', title: 'Prise en charge des dysménorrhées',
    description: 'Protocole clinique OMS pour la prise en charge des douleurs menstruelles sévères en consultation.',
    tags: ['cycle', 'douleur', 'ains'], url: null, addedBy: 'LUNELA',
  },
  {
    id: 'def_2', category: 'protocol', title: 'Contraception post-partum',
    description: 'Recommandations pour l\'initiation de la contraception après l\'accouchement selon le délai et le mode d\'allaitement.',
    tags: ['contraception', 'post-partum'], url: null, addedBy: 'LUNELA',
  },
  {
    id: 'def_3', category: 'protocol', title: 'Dépistage IST – conduite à tenir',
    description: 'Arbre décisionnel pour le dépistage et l\'orientation des infections sexuellement transmissibles en consultation.',
    tags: ['ist', 'vih', 'dépistage'], url: null, addedBy: 'LUNELA',
  },
  // Guidelines
  {
    id: 'def_4', category: 'guideline', title: 'OMS – Santé reproductive 2023',
    description: 'Lignes directrices OMS sur les soins de santé reproductive : planification familiale, grossesse, IST.',
    tags: ['oms', 'santé reproductive'], url: 'https://www.who.int/reproductivehealth', addedBy: 'LUNELA',
  },
  {
    id: 'def_5', category: 'guideline', title: 'FIGO – Contraception pour adolescentes',
    description: 'Recommandations FIGO sur le conseil contraceptif destiné aux adolescentes et jeunes adultes.',
    tags: ['adolescents', 'contraception', 'figo'], url: null, addedBy: 'LUNELA',
  },
  // Articles
  {
    id: 'def_6', category: 'article', title: 'SPM et troubles de l\'humeur',
    description: 'Revue systématique sur la corrélation entre le syndrome pré-menstruel et les troubles anxio-dépressifs.',
    tags: ['spm', 'humeur', 'anxiété'], url: null, addedBy: 'LUNELA',
  },
  {
    id: 'def_7', category: 'article', title: 'Endométriose : diagnostic précoce',
    description: 'Étude multicentrique sur les facteurs prédictifs d\'endométriose chez les adolescentes présentant des dysménorrhées.',
    tags: ['endométriose', 'diagnostic'], url: null, addedBy: 'LUNELA',
  },
  // Outils
  {
    id: 'def_8', category: 'tool', title: 'Calculateur de date d\'ovulation',
    description: 'Outil de calcul de la fenêtre fertile et de la date d\'ovulation à partir des données du cycle (longueur, durée des règles).',
    tags: ['ovulation', 'fertilité', 'calcul'], url: null, addedBy: 'LUNELA',
  },
  {
    id: 'def_9', category: 'tool', title: 'Score de douleur menstruelle (VAS)',
    description: 'Echelle visuelle analogique adaptée à l\'évaluation de la douleur en consultation gynécologique.',
    tags: ['douleur', 'vas', 'évaluation'], url: null, addedBy: 'LUNELA',
  },
  // Formations
  {
    id: 'def_10', category: 'formation', title: 'MOOC Santé sexuelle – FUN',
    description: 'Formation en ligne gratuite sur la santé sexuelle et reproductive destinée aux professionnels de santé.',
    tags: ['mooc', 'formation', 'gratuit'], url: 'https://www.fun-mooc.fr', addedBy: 'LUNELA',
  },
  {
    id: 'def_11', category: 'formation', title: 'DPC – Contraception et fertilité',
    description: 'Programme de développement professionnel continu accrédité sur la contraception et le conseil en fertilité.',
    tags: ['dpc', 'formation', 'contraception'], url: null, addedBy: 'LUNELA',
  },
  // Contacts
  {
    id: 'def_12', category: 'contact', title: 'Ligne nationale santé sexuelle',
    description: 'Numéro national gratuit : 3114. Écoute, information, orientation 24h/24 pour patients et professionnels.',
    tags: ['urgence', 'gratuit', 'national'], url: 'tel:3114', addedBy: 'LUNELA',
  },
  {
    id: 'def_13', category: 'contact', title: 'ANSM – Vigilance contraceptifs',
    description: 'Contact pour signaler tout effet indésirable lié à un contraceptif ou dispositif médical.',
    tags: ['ansm', 'signalement', 'pharmacovigilance'], url: 'https://www.ansm.sante.fr', addedBy: 'LUNELA',
  },
];

// ─── Composant : FormattedText (bold markdown) ────────────────────────────────
function FmtText({ text, style }) {
  const parts = (text ?? '').split(/\*\*(.*?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? <Text key={i} style={{ fontWeight: '700' }}>{p}</Text> : p
      )}
    </Text>
  );
}

// ─── Composant : carte de ressource ──────────────────────────────────────────
function ResourceCard({ item, onPress }) {
  const { t } = useLanguage();
  const { colors, role, radius, spacing, shadows } = useTheme();
  const styles = makeStyles(colors, role, radius, spacing, shadows);
  const CATEGORY_COLORS = makeCategoryColors(role);
  const RESOURCE_CATEGORIES = RESOURCE_CATEGORY_KEYS.map(c => ({ ...c, label: t(c.labelKey) }));
  const cat = CATEGORY_COLORS[item.category] ?? { bg: colors.background, border: colors.border, text: colors.text };
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: cat.text, borderLeftWidth: 4 }]}
      onPress={() => onPress(item)}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <View style={[styles.catBadge, { backgroundColor: cat.bg, borderColor: cat.border }]}>
          <Text style={[styles.catBadgeTxt, { color: cat.text }]}>
            {RESOURCE_CATEGORIES.find(c => c.id === item.category)?.label ?? item.category}
          </Text>
        </View>
        {item.url && (
          <View style={styles.linkBadge}>
            <Ionicons name="link" size={11} color={role.specialist} />
            <Text style={styles.linkBadgeTxt}>{t('link_label')}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      {item.tags?.length > 0 && (
        <View style={styles.tagsRow}>
          {item.tags.slice(0, 3).map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagTxt}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}
      {item.addedBy && item.addedBy !== 'LUNELA' && (
        <Text style={styles.addedBy}>{t('added_by', { name: item.addedBy })}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Composant : modal détail ─────────────────────────────────────────────────
function ResourceModal({ item, onClose }) {
  const { t } = useLanguage();
  const { colors, role, radius, spacing, shadows } = useTheme();
  const styles = makeStyles(colors, role, radius, spacing, shadows);
  const modalStyles = makeModalStyles(colors, role, radius, spacing);
  const CATEGORY_COLORS = makeCategoryColors(role);
  const RESOURCE_CATEGORIES = RESOURCE_CATEGORY_KEYS.map(c => ({ ...c, label: t(c.labelKey) }));
  if (!item) return null;
  const cat = CATEGORY_COLORS[item.category] ?? { bg: colors.background, border: colors.border, text: colors.text };

  const openUrl = () => {
    if (!item.url) return;
    Linking.openURL(item.url).catch(() => Alert.alert(t('error_generic'), t('open_link_error')));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[modalStyles.header, { backgroundColor: role.specialist }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={[modalStyles.catIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons
              name={RESOURCE_CATEGORIES.find(c => c.id === item.category)?.icon ?? 'document'}
              size={22} color="#fff"
            />
          </View>
          <Text style={modalStyles.headerTitle} numberOfLines={2}>{item.title}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}>
          {/* Badge catégorie */}
          <View style={[styles.catBadge, { backgroundColor: cat.bg, borderColor: cat.border, alignSelf: 'flex-start', marginBottom: spacing.lg }]}>
            <Text style={[styles.catBadgeTxt, { color: cat.text }]}>
              {RESOURCE_CATEGORIES.find(c => c.id === item.category)?.label ?? item.category}
            </Text>
          </View>

          {/* Description complète */}
          <View style={modalStyles.descCard}>
            <FmtText text={item.description} style={modalStyles.descTxt} />
          </View>

          {/* Tags */}
          {item.tags?.length > 0 && (
            <>
              <Text style={modalStyles.sectionTitle}>{t('keywords_label')}</Text>
              <View style={styles.tagsRow}>
                {item.tags.map(tag => (
                  <View key={tag} style={[styles.tag, { paddingHorizontal: 12, paddingVertical: 5 }]}>
                    <Text style={[styles.tagTxt, { fontSize: 13 }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Lien externe */}
          {item.url && (
            <>
              <Text style={[modalStyles.sectionTitle, { marginTop: spacing.xl }]}>{t('access_label')}</Text>
              <TouchableOpacity style={modalStyles.linkBtn} onPress={openUrl}>
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={modalStyles.linkBtnTxt}>
                  {item.url.startsWith('tel:') ? t('call_number', { number: item.url.replace('tel:', '') }) : t('open_link_action')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Source */}
          <View style={modalStyles.sourceRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
            <Text style={modalStyles.sourceTxt}>
              {t('source_label', { source: item.addedBy === 'LUNELA' ? t('lunela_base') : t('added_by', { name: item.addedBy }) })}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Composant : modal ajout ressource ───────────────────────────────────────
function AddResourceModal({ visible, onClose, onSaved, specialistName }) {
  const { t } = useLanguage();
  const { colors, role, spacing } = useTheme();
  const addStyles = makeAddStyles(colors, role, spacing);
  const RESOURCE_CATEGORIES = RESOURCE_CATEGORY_KEYS.map(c => ({ ...c, label: t(c.labelKey) }));
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState('protocol');
  const [url,      setUrl]      = useState('');
  const [tags,     setTags]     = useState('');
  const [saving,   setSaving]   = useState(false);

  const reset = () => { setTitle(''); setDesc(''); setCategory('protocol'); setUrl(''); setTags(''); };

  const save = async () => {
    if (!title.trim() || !desc.trim()) {
      Alert.alert(t('required_fields_title'), t('required_fields_msg'));
      return;
    }
    setSaving(true);
    try {
      const docRef = await addDoc(collection(firestoreDb, 'specialist_resources'), {
        title:       title.trim(),
        description: desc.trim(),
        category,
        url:         url.trim() || null,
        tags:        tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
        addedBy:     specialistName ?? t('default_specialist'),
        createdAt:   serverTimestamp(),
      });
      onSaved({ id: docRef.id, title: title.trim(), description: desc.trim(), category, url: url.trim() || null, tags: tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), addedBy: specialistName ?? t('default_specialist') });
      reset();
      onClose();
    } catch (_) {
      Alert.alert(t('error_generic'), t('save_resource_error'));
    }
    setSaving(false);
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={() => { reset(); onClose(); }} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[addStyles.header, { backgroundColor: role.specialist }]}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={addStyles.headerTitle}>{t('add_resource_title')}</Text>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[addStyles.saveBtn, saving && { opacity: 0.6 }]}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={addStyles.saveBtnTxt}>{t('publish_action')}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

          {/* Titre */}
          <Text style={addStyles.label}>{t('title_required_label')}</Text>
          <TextInput
            style={addStyles.input}
            placeholder={t('title_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={title} onChangeText={setTitle}
            maxLength={100}
          />

          {/* Description */}
          <Text style={addStyles.label}>{t('description_required_label')}</Text>
          <TextInput
            style={[addStyles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder={t('describe_resource_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={desc} onChangeText={setDesc}
            multiline maxLength={500}
          />

          {/* Catégorie */}
          <Text style={addStyles.label}>{t('category_label')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
            {RESOURCE_CATEGORIES.filter(c => c.id !== 'all').map(c => (
              <TouchableOpacity
                key={c.id}
                style={[addStyles.catChip, category === c.id && addStyles.catChipActive]}
                onPress={() => setCategory(c.id)}
              >
                <Ionicons name={c.icon} size={14} color={category === c.id ? '#fff' : colors.textSecondary} />
                <Text style={[addStyles.catChipTxt, category === c.id && { color: '#fff' }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* URL */}
          <Text style={addStyles.label}>{t('url_optional_label')}</Text>
          <TextInput
            style={addStyles.input}
            placeholder="https://..."
            placeholderTextColor={colors.textSecondary}
            value={url} onChangeText={setUrl}
            keyboardType="url" autoCapitalize="none"
          />

          {/* Tags */}
          <Text style={addStyles.label}>{t('tags_label')}</Text>
          <TextInput
            style={addStyles.input}
            placeholder="ist, dépistage, protocole"
            placeholderTextColor={colors.textSecondary}
            value={tags} onChangeText={setTags}
            autoCapitalize="none"
          />

          <View style={addStyles.noteCard}>
            <Ionicons name="information-circle" size={16} color={role.specialist} />
            <Text style={addStyles.noteTxt}>
              {t('resource_visibility_note')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function ResourcesScreen() {
  const { t } = useLanguage();
  const { colors, role, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, role, radius, spacing, shadows);
  const RESOURCE_CATEGORIES = RESOURCE_CATEGORY_KEYS.map(c => ({ ...c, label: t(c.labelKey) }));
  const { user, roleData } = useAuth();

  const [resources,   setResources]   = useState(DEFAULT_RESOURCES);
  const [loading,     setLoading]     = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);

  // ── Chargement Firestore ─────────────────────────────────────────────────
  useEffect(() => {
    loadFirestoreResources();
  }, []);

  const loadFirestoreResources = async () => {
    try {
      const snap = await getDocs(
        query(collection(firestoreDb, 'specialist_resources'), orderBy('createdAt', 'desc'))
      );
      const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setResources([...DEFAULT_RESOURCES, ...remote]);
    } catch (_) {}
    setLoading(false);
  };

  // ── Filtrage ─────────────────────────────────────────────────────────────
  const filtered = resources.filter(r => {
    const matchCat    = activeCategory === 'all' || r.category === activeCategory;
    const searchLower = search.toLowerCase();
    const matchSearch = !search || [r.title, r.description, ...(r.tags ?? [])]
      .some(f => f?.toLowerCase().includes(searchLower));
    return matchCat && matchSearch;
  });

  // ── Compteur par catégorie ────────────────────────────────────────────────
  const countFor = useCallback((catId) => {
    if (catId === 'all') return resources.length;
    return resources.filter(r => r.category === catId).length;
  }, [resources]);

  const onSaved = (newItem) => {
    setResources(prev => [newItem, ...prev]);
  };

  return (
    <View style={styles.container}>

      {/* ── Barre de recherche ──────────────────────────────────────────── */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_resource_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={search} onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Catégories ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catsScroll}
        contentContainerStyle={styles.catsContent}
      >
        {RESOURCE_CATEGORIES.map(cat => {
          const count   = countFor(cat.id);
          const isActive = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, isActive && styles.catChipActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={14}
                color={isActive ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.catChipTxt, isActive && styles.catChipTxtActive]}>
                {cat.label}
              </Text>
              <View style={[styles.catCount, isActive && styles.catCountActive]}>
                <Text style={[styles.catCountTxt, isActive && { color: role.specialist }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Liste ───────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={role.specialist} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header résultats */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {t('resource_count', { n: filtered.length, s: filtered.length !== 1 ? 's' : '' })}
              {activeCategory !== 'all' && ` · ${RESOURCE_CATEGORIES.find(c => c.id === activeCategory)?.label}`}
            </Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAdd(true)}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnTxt}>{t('add_action')}</Text>
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>{t('no_result_title')}</Text>
              <Text style={styles.emptySub}>
                {search ? t('no_result_search', { search }) : t('no_result_category')}
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setShowAdd(true)}
              >
                <Ionicons name="add-circle" size={18} color={role.specialist} />
                <Text style={styles.emptyAddTxt}>{t('add_first_resource')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map(item => (
              <ResourceCard key={item.id} item={item} onPress={setSelected} />
            ))
          )}
        </ScrollView>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <ResourceModal item={selected} onClose={() => setSelected(null)} />
      <AddResourceModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={onSaved}
        specialistName={roleData?.displayName ?? user?.displayName ?? t('default_specialist')}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, role, radius, spacing, shadows) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, margin: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2, gap: spacing.sm + 2, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  catsScroll:   { maxHeight: 52 },
  catsContent:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2, gap: spacing.sm },
  catChip:      { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2, gap: 5, borderWidth: 1, borderColor: colors.border },
  catChipActive:{ backgroundColor: role.specialist, borderColor: role.specialist },
  catChipTxt:   { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  catChipTxtActive: { color: '#fff' },
  catCount:     { backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: spacing.sm - 2, paddingVertical: 1 },
  catCountActive:   { backgroundColor: 'rgba(255,255,255,0.25)' },
  catCountTxt:  { fontSize: 10, fontWeight: '700', color: colors.textSecondary },

  listContent:  { paddingHorizontal: spacing.md, paddingBottom: 40 },
  resultsHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm + 2, marginTop: 4 },
  resultsCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: role.specialist, borderRadius: radius.pill, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm - 1, gap: 5 },
  addBtnTxt:    { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Resource card
  card:         { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md + 4, marginBottom: spacing.md, ...shadows.sm },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  catBadge:     { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderWidth: 1 },
  catBadgeTxt:  { fontSize: 11, fontWeight: '700' },
  linkBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: role.specialistLight, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  linkBadgeTxt: { fontSize: 11, color: role.specialist, fontWeight: '600' },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 5 },
  cardDesc:     { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.sm },
  tagsRow:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm - 2 },
  tag:          { alignSelf: 'center', backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tagTxt:       { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  addedBy:      { fontSize: 11, color: role.specialist, fontWeight: '600', marginTop: spacing.sm - 2 },

  emptyWrap:    { alignItems: 'center', paddingTop: 50 },
  emptyEmoji:   { fontSize: 44, marginBottom: spacing.sm + 2 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptySub:     { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 30, marginBottom: spacing.xl },
  emptyAddBtn:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyAddTxt:  { fontSize: 14, color: role.specialist, fontWeight: '700' },
});

const makeModalStyles = (colors, role, radius, spacing) => StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: spacing.xl, paddingHorizontal: spacing.md, gap: spacing.md },
  catIcon:     { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#fff' },
  descCard:    { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border },
  descTxt:     { fontSize: 14, color: colors.text, lineHeight: 22 },
  sectionTitle:{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  linkBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: role.specialist, borderRadius: radius.md, paddingVertical: spacing.lg, gap: spacing.sm },
  linkBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  sourceRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm - 2, marginTop: spacing.xxl },
  sourceTxt:   { fontSize: 12, color: colors.textSecondary },
});

const makeAddStyles = (colors, role, spacing) => StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.md },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff' },
  saveBtn:     { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 1 },
  saveBtnTxt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  label:       { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.sm - 2, marginTop: spacing.md + 2 },
  input:       { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 3, fontSize: 14, color: colors.text },
  catChip:     { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm, marginRight: spacing.sm, gap: 6, borderWidth: 1, borderColor: colors.border },
  catChipActive:{ backgroundColor: role.specialist, borderColor: role.specialist },
  catChipTxt:  { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  noteCard:    { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: role.specialistLight, borderRadius: 12, padding: spacing.md + 2, marginTop: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: role.specialist + '55' },
  noteTxt:     { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
});
