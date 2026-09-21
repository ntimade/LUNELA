import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuizQuestions } from '../../hooks/useQuiz';
import { QUIZ_TOPICS } from '../../hooks/useQuiz';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY_FORM = {
  topicId: QUIZ_TOPICS[0]?.id ?? '',
  text: '',
  options: ['', '', '', ''],
  correct: null,
  explanation: '',
};

export default function QuizManagerScreen({ navigation }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const { questions, loading, addQuestion, updateQuestion, deleteQuestion } = useQuizQuestions();
  const [showForm, setShowForm] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterTopic, setFilterTopic] = useState('Tous');

  const filteredQuestions = filterTopic === 'Tous'
    ? questions
    : questions.filter(q => q.topicId === filterTopic);

  const topicMeta = (id) => QUIZ_TOPICS.find(t => t.id === id) ?? { label: id, color: colors.primary, icon: '❓' };

  const openAdd = () => {
    setEditingQ(null);
    setForm({
      ...EMPTY_FORM,
      topicId: filterTopic !== 'Tous' ? filterTopic : EMPTY_FORM.topicId,
    });
    setShowForm(true);
  };

  const openEdit = (q) => {
    setEditingQ(q);
    setForm({
      topicId: q.topicId,
      text: q.text,
      options: q.options?.length === 4 ? [...q.options] : ['', '', '', ''],
      correct: q.correct,
      explanation: q.explanation || '',
    });
    setShowForm(true);
  };

  const handleDelete = (q) => {
    Alert.alert(
      t('delete_action'),
      t('delete_confirm_question'),
      [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('delete_action'), style: 'destructive',
          onPress: async () => {
            try { await deleteQuestion(q.id); }
            catch (e) { Alert.alert(t('error_generic'), t('delete_failed')); }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!form.text.trim() || form.options.some(o => !o.trim())) {
      Alert.alert(t('error_generic'), t('question_required'));
      return;
    }
    if (form.correct === null) {
      Alert.alert(t('error_generic'), t('select_correct_answer'));
      return;
    }
    setSaving(true);
    try {
      const data = {
        topicId:     form.topicId,
        text:        form.text.trim(),
        options:     form.options.map(o => o.trim()),
        correct:     form.correct,
        explanation: form.explanation.trim(),
      };
      if (editingQ) {
        await updateQuestion(editingQ.id, data);
      } else {
        await addQuestion(data);
      }
      setShowForm(false);
    } catch (e) {
      Alert.alert(t('error_generic'), t('save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const updateOption = (idx, val) => {
    const opts = [...form.options];
    opts[idx] = val;
    setForm({ ...form, options: opts });
  };

  const allTopics = ['Tous', ...QUIZ_TOPICS.map(t => t.id)];

  return (
    <View style={styles.container}>

      <ScreenHeader
        title={t('quiz_manager_title')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        rightIcon="add"
        onRightPress={openAdd}
        insetTop={insets.top}
      />

      {/* Filtres par catégorie */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        {allTopics.map(id => {
          const meta = id === 'Tous' ? { label: 'Tous', icon: '📋' } : topicMeta(id);
          const active = filterTopic === id;
          return (
            <Chip
              key={id}
              label={`${meta.icon} ${meta.label}`}
              active={active}
              color={meta.color || colors.primary}
              onPress={() => setFilterTopic(id)}
            />
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredQuestions.map(q => {
            const meta = topicMeta(q.topicId);
            return (
              <Card key={q.id} shadow="sm" padding="md" style={styles.itemCard}>
                <View style={[styles.itemIcon, { backgroundColor: meta.color + '22' }]}>
                  <Text style={styles.itemEmoji}>{meta.icon}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{q.text}</Text>
                  <Text style={styles.itemCat}>{meta.label}</Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(q)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(q)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color={semantic.error} />
                </TouchableOpacity>
              </Card>
            );
          })}
          {filteredQuestions.length === 0 && (
            <EmptyState icon="help-circle-outline" text={t('no_question')} />
          )}
        </ScrollView>
      )}

      {/* Modal formulaire */}
      <Modal visible={showForm} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{editingQ ? t('edit_action') : t('add_question_action')}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Ionicons name="close" size={24} color={colors.textGray} />
                </TouchableOpacity>
              </View>

              {/* Catégorie */}
              <Text style={styles.label}>{t('topic_label')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                {QUIZ_TOPICS.map(topic => (
                  <Chip
                    key={topic.id}
                    label={`${topic.icon} ${topic.label}`}
                    active={form.topicId === topic.id}
                    color={topic.color}
                    onPress={() => setForm({ ...form, topicId: topic.id })}
                  />
                ))}
              </ScrollView>

              {/* Question */}
              <Text style={styles.label}>{t('question_text_label')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.text}
                onChangeText={v => setForm({ ...form, text: v })}
                placeholder={t('question_text_placeholder')}
                placeholderTextColor={colors.textGray}
                multiline numberOfLines={2}
              />

              {/* Options */}
              <Text style={styles.label}>{t('correct_answer_label')}</Text>
              <Text style={styles.hint}>{t('tap_option_to_mark_correct')}</Text>
              {form.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionRow, form.correct === i && styles.optionRowSelected]}
                  onPress={() => setForm({ ...form, correct: i })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionRadio, form.correct === i && styles.optionRadioSelected]}>
                    {form.correct === i && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <TextInput
                    style={styles.optionInput}
                    value={opt}
                    onChangeText={v => updateOption(i, v)}
                    placeholder={t('option_n_label', { n: i + 1 })}
                    placeholderTextColor={colors.textGray}
                  />
                </TouchableOpacity>
              ))}

              {/* Explication */}
              <Text style={styles.label}>{t('explanation_label')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.explanation}
                onChangeText={v => setForm({ ...form, explanation: v })}
                placeholder={t('explanation_placeholder')}
                placeholderTextColor={colors.textGray}
                multiline numberOfLines={3}
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
  itemEmoji: { fontSize: 22 },
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
  hint: { color: colors.textGray, fontSize: 11, marginBottom: spacing.sm + 2 },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.sm + 2, borderWidth: 1.5, borderColor: colors.border },
  optionRowSelected: { borderColor: colors.success, backgroundColor: colors.success + '11' },
  optionRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  optionRadioSelected: { backgroundColor: colors.success, borderColor: colors.success },
  optionInput: { flex: 1, color: colors.text, fontSize: 14 },
  formBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  cancelBtn: { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textGray, fontWeight: '600' },
  saveBtn: { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});
