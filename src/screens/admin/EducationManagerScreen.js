import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEducationContent } from '../../hooks/useEducationContent';
import { GIRL_CATEGORIES } from '../education/defaultContent';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';

const PROFILES = [
  { id: 'girl', label: 'Fille', icon: '♀️' },
  { id: 'boy',  label: 'Garçon', icon: '♂️' },
  { id: 'both', label: 'Les deux', icon: '⚥' },
];

const EMPTY_FORM = {
  category: GIRL_CATEGORIES[0]?.key ?? '',
  targetProfile: 'girl',
  title: '',
  body: '',
};

export default function EducationManagerScreen({ navigation }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const { articles, loading, addArticle, updateArticle, deleteArticle } = useEducationContent();
  const [showForm, setShowForm] = useState(false);
  const [editingA, setEditingA] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('Tous');

  const filteredArticles = filterCat === 'Tous'
    ? articles
    : articles.filter(a => a.category === filterCat);

  const catMeta = (key) => GIRL_CATEGORIES.find(c => c.key === key) ?? { label: key, color: colors.primary, icon: 'book' };

  const openAdd = () => {
    setEditingA(null);
    setForm({
      ...EMPTY_FORM,
      category: filterCat !== 'Tous' ? filterCat : EMPTY_FORM.category,
    });
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditingA(a);
    setForm({
      category: a.category,
      targetProfile: a.targetProfile || 'girl',
      title: a.title,
      body: a.body,
    });
    setShowForm(true);
  };

  const handleDelete = (a) => {
    Alert.alert(
      t('delete_action'),
      t('delete_confirm_article'),
      [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('delete_action'), style: 'destructive',
          onPress: async () => {
            try { await deleteArticle(a.id); }
            catch (e) { Alert.alert(t('error_generic'), t('delete_failed')); }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      Alert.alert(t('error_generic'), t('article_required'));
      return;
    }
    setSaving(true);
    try {
      const existingInCat = articles.filter(a => a.category === form.category).length;
      const data = {
        category:      form.category,
        targetProfile: form.targetProfile,
        title:         form.title.trim(),
        body:          form.body.trim(),
        order:         editingA ? (editingA.order ?? 0) : existingInCat + 1,
      };
      if (editingA) {
        await updateArticle(editingA.id, data);
      } else {
        await addArticle(data);
      }
      setShowForm(false);
    } catch (e) {
      Alert.alert(t('error_generic'), t('save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const allCats = ['Tous', ...GIRL_CATEGORIES.map(c => c.key)];

  return (
    <View style={styles.container}>

      <ScreenHeader
        title={t('education_manager_title')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        rightIcon="add"
        onRightPress={openAdd}
        insetTop={insets.top}
      />

      {/* Filtres par catégorie */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        {allCats.map(key => {
          const meta = key === 'Tous' ? { label: 'Tous', icon: '📋' } : catMeta(key);
          const active = filterCat === key;
          return (
            <Chip
              key={key}
              label={meta.label}
              active={active}
              color={meta.color || colors.primary}
              onPress={() => setFilterCat(key)}
            />
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredArticles.map(a => {
            const meta = catMeta(a.category);
            return (
              <Card key={a.id} shadow="sm" padding="md" style={styles.itemCard}>
                <View style={[styles.itemIcon, { backgroundColor: meta.color + '22' }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{a.title}</Text>
                  <Text style={styles.itemCat}>
                    {meta.label} · {PROFILES.find(p => p.id === a.targetProfile)?.label ?? a.targetProfile}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(a)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(a)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color={semantic.error} />
                </TouchableOpacity>
              </Card>
            );
          })}
          {filteredArticles.length === 0 && (
            <EmptyState icon="book-outline" text={t('no_article')} />
          )}
        </ScrollView>
      )}

      {/* Modal formulaire */}
      <Modal visible={showForm} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{editingA ? t('edit_action') : t('add_article_action')}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Ionicons name="close" size={24} color={colors.textGray} />
                </TouchableOpacity>
              </View>

              {/* Catégorie */}
              <Text style={styles.label}>{t('topic_label')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                {GIRL_CATEGORIES.map(cat => (
                  <Chip
                    key={cat.key}
                    label={cat.label}
                    active={form.category === cat.key}
                    color={cat.color}
                    onPress={() => setForm({ ...form, category: cat.key })}
                  />
                ))}
              </ScrollView>

              {/* Public visé */}
              <Text style={styles.label}>{t('target_profile_label')}</Text>
              <View style={styles.profileRow}>
                {PROFILES.map(p => (
                  <Chip
                    key={p.id}
                    label={`${p.icon} ${p.label}`}
                    active={form.targetProfile === p.id}
                    color={colors.primary}
                    onPress={() => setForm({ ...form, targetProfile: p.id })}
                  />
                ))}
              </View>

              {/* Titre */}
              <Text style={styles.label}>{t('article_title_label')}</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={v => setForm({ ...form, title: v })}
                placeholder={t('article_title_placeholder')}
                placeholderTextColor={colors.textGray}
              />

              {/* Contenu */}
              <Text style={styles.label}>{t('article_body_label')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.body}
                onChangeText={v => setForm({ ...form, body: v })}
                placeholder={t('article_body_placeholder')}
                placeholderTextColor={colors.textGray}
                multiline numberOfLines={8}
              />

              {/* Boutons */}
              <View style={styles.formBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={styles.cancelText}>{t('cancel_action')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>{t('save_action')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, paddingVertical: spacing.sm + 2 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl - 2 },
  itemCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm + 2, gap: spacing.md },
  itemIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  itemCat: { color: colors.textGray, fontSize: 12, marginTop: 2 },
  iconBtn: { padding: spacing.xs + 2 },
  // Modal formulaire
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  // `height` fixe (pas `maxHeight`) : le ScrollView interne est en `flex:1`, qui
  // a besoin d'un ancêtre à hauteur DÉFINIE pour se dimensionner correctement —
  // avec seulement `maxHeight`, le moteur de mise en page (New Architecture)
  // peut faire s'effondrer le ScrollView à une hauteur quasi nulle.
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, height: '92%', overflow: 'hidden' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { color: colors.textLight, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs + 2 },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  formBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  cancelBtn: { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textGray, fontWeight: '600' },
  saveBtn: { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});
