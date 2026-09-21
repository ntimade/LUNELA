import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContraceptives } from '../../hooks/useContraceptives';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';

const EMOJI_LIST = [
  '💊','💉','🩹','🔵','🟢','🟡','🔴','🟠','🟣','⚫','⚪','🔘',
  '🛡️','⚡','📅','🩸','🫙','🩲','🩺','🏥','❤️','🧬','🔬','💪',
  '🌿','🌸','🌺','🌷','🌻','🍃','🧪','💧','🌙','⭐','✨','🔆',
  '🩻','💝','🫀','🧠','👩‍⚕️','🤱','🍼','🎀','🎗️','🏃‍♀️','🧘‍♀️','💆‍♀️',
];

const COLORS_LIST = [
  '#EC4899','#F43F5E','#EF4444','#F97316','#F59E0B','#84CC16',
  '#10B981','#06B6D4','#3B82F6','#8B5CF6','#A78BFA','#FB7185',
  '#FF6B35','#6EE7B7','#FCA5A5','#FBBF24','#34D399','#60A5FA',
];

const CATEGORIES = ['Hormonaux', 'Dispositifs', 'Barrière', 'Urgence', 'Naturels', 'Protection'];

const EMPTY_FORM = {
  name: '', category: 'Hormonaux', emoji: '💊', color: '#EC4899',
  efficacy: '', duration: '', description: '',
  pros: ['', '', ''], cons: ['', '', ''],
};

export default function ContraceptivesManagerScreen({ navigation }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const { items, loading, addItem, updateItem, deleteItem } = useContraceptives();
  const [showForm, setShowForm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('Tous');

  const filteredItems = filterCat === 'Tous' ? items : items.filter(i => i.category === filterCat);

  const openAdd = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      emoji: item.emoji,
      color: item.color || '#EC4899',
      efficacy: item.efficacy || '',
      duration: item.duration || '',
      description: item.description || '',
      pros: item.pros?.length ? [...item.pros, '', '', ''].slice(0, 3) : ['', '', ''],
      cons: item.cons?.length ? [...item.cons, '', '', ''].slice(0, 3) : ['', '', ''],
    });
    setShowForm(true);
  };

  const handleDelete = (item) => {
    Alert.alert(
      t('delete_action'),
      t('delete_confirm_name', { name: item.name }),
      [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('delete_action'), style: 'destructive',
          onPress: async () => {
            try { await deleteItem(item.id); }
            catch (e) { Alert.alert(t('error_generic'), t('delete_failed')); }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert(t('error_generic'), t('name_required'));
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        category: form.category,
        emoji: form.emoji,
        color: form.color,
        efficacy: form.efficacy.trim() || '-',
        duration: form.duration.trim() || '-',
        description: form.description.trim(),
        pros: form.pros.filter(p => p.trim()),
        cons: form.cons.filter(c => c.trim()),
      };
      if (editingItem) {
        await updateItem(editingItem.id, data);
      } else {
        await addItem(data);
      }
      setShowForm(false);
    } catch (e) {
      Alert.alert(t('error_generic'), t('save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const updatePro = (idx, val) => {
    const p = [...form.pros]; p[idx] = val; setForm({ ...form, pros: p });
  };
  const updateCon = (idx, val) => {
    const c = [...form.cons]; c[idx] = val; setForm({ ...form, cons: c });
  };

  const allCats = ['Tous', ...CATEGORIES];

  return (
    <View style={styles.container}>

      <ScreenHeader
        title={t('contraceptives_title')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        rightIcon="add"
        onRightPress={openAdd}
        insetTop={insets.top}
      />

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        {allCats.map(cat => (
          <Chip
            key={cat}
            label={cat}
            active={filterCat === cat}
            color={role.admin}
            onPress={() => setFilterCat(cat)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredItems.map(item => (
            <Card key={item.id} shadow="sm" padding="md" style={styles.itemCard}>
              <View style={[styles.itemIcon, { backgroundColor: (item.color || colors.primary) + '22' }]}>
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCat}>{item.category} · {item.duration}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={semantic.error} />
              </TouchableOpacity>
            </Card>
          ))}
          {filteredItems.length === 0 && (
            <EmptyState icon="list-outline" text={t('no_item')} />
          )}
        </ScrollView>
      )}

      {/* Modal formulaire */}
      <Modal visible={showForm} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{editingItem ? t('edit_action') : t('add_item_action')}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Ionicons name="close" size={24} color={colors.textGray} />
                </TouchableOpacity>
              </View>

              {/* Emoji + Couleur */}
              <View style={styles.emojiColorRow}>
                <TouchableOpacity
                  style={[styles.emojiPreview, { backgroundColor: form.color + '22' }]}
                  onPress={() => setShowEmojiPicker(true)}
                >
                  <Text style={styles.emojiPreviewText}>{form.emoji}</Text>
                  <Text style={styles.emojiHint}>{t('change_action')}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('color_label')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {COLORS_LIST.map(c => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setForm({ ...form, color: c })}
                        style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotSelected]}
                      />
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Nom */}
              <Text style={styles.label}>{t('name_required_label')}</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={v => setForm({ ...form, name: v })} placeholder="Ex: Pilule contraceptive" placeholderTextColor={colors.textGray} />

              {/* Catégorie */}
              <Text style={styles.label}>{t('category_label')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                {CATEGORIES.map(cat => (
                  <Chip
                    key={cat}
                    label={cat}
                    active={form.category === cat}
                    color={role.admin}
                    onPress={() => setForm({ ...form, category: cat })}
                  />
                ))}
              </ScrollView>

              {/* Efficacité + Durée */}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('efficacy_field_label')}</Text>
                  <TextInput style={styles.input} value={form.efficacy} onChangeText={v => setForm({ ...form, efficacy: v })} placeholder="99%" placeholderTextColor={colors.textGray} />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('duration_field_label')}</Text>
                  <TextInput style={styles.input} value={form.duration} onChangeText={v => setForm({ ...form, duration: v })} placeholder="Quotidien" placeholderTextColor={colors.textGray} />
                </View>
              </View>

              {/* Description */}
              <Text style={styles.label}>{t('description_label')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={v => setForm({ ...form, description: v })}
                placeholder={t('description_placeholder')}
                placeholderTextColor={colors.textGray}
                multiline numberOfLines={3}
              />

              {/* Avantages */}
              <Text style={styles.label}>{t('advantages_max3')}</Text>
              {form.pros.map((p, i) => (
                <TextInput
                  key={i} style={styles.input}
                  value={p} onChangeText={v => updatePro(i, v)}
                  placeholder={t('advantage_n', { n: i + 1 })} placeholderTextColor={colors.textGray}
                />
              ))}

              {/* Inconvénients */}
              <Text style={styles.label}>{t('disadvantages_max3')}</Text>
              {form.cons.map((c, i) => (
                <TextInput
                  key={i} style={styles.input}
                  value={c} onChangeText={v => updateCon(i, v)}
                  placeholder={t('disadvantage_n', { n: i + 1 })} placeholderTextColor={colors.textGray}
                />
              ))}

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

      {/* Modal sélecteur d'emoji */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity style={styles.emojiOverlay} activeOpacity={1} onPress={() => setShowEmojiPicker(false)}>
          <View style={styles.emojiModal}>
            <Text style={styles.emojiModalTitle}>{t('choose_emoji')}</Text>
            <FlatList
              data={EMOJI_LIST}
              numColumns={8}
              keyExtractor={(item, idx) => idx.toString()}
              renderItem={({ item: emoji }) => (
                <TouchableOpacity
                  style={[styles.emojiOption, form.emoji === emoji && styles.emojiOptionSelected]}
                  onPress={() => { setForm({ ...form, emoji }); setShowEmojiPicker(false); }}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
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
  emojiColorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  emojiPreview: { width: 70, height: 70, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  emojiPreviewText: { fontSize: 32 },
  emojiHint: { fontSize: 10, color: colors.textGray, marginTop: 2 },
  colorDot: { width: 28, height: 28, borderRadius: 14, marginRight: spacing.sm },
  colorDotSelected: { borderWidth: 3, borderColor: colors.text, transform: [{ scale: 1.2 }] },
  label: { color: colors.textLight, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs + 2 },
  input: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  formBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  cancelBtn: { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textGray, fontWeight: '600' },
  saveBtn: { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
  // Emoji picker
  emojiOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' },
  emojiModal: { backgroundColor: colors.card, borderRadius: radius.xl - 4, padding: spacing.xl, width: '90%', maxHeight: '60%' },
  emojiModalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  emojiOption: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: radius.sm - 2, margin: 2 },
  emojiOptionSelected: { backgroundColor: colors.primary + '33' },
  emojiOptionText: { fontSize: 24 },
});
