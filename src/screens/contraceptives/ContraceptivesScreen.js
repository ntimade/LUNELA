import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Switch, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContraceptives } from '../../hooks/useContraceptives';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const REMINDER_KEY = '@lunela_contraceptive_reminder';
const REMINDER_ID  = 'lunela_contraceptive_daily';

// ─── Bloc rappel contraceptif ─────────────────────────────────────────────────
function ContraceptiveReminder({ colors, radius, spacing }) {
  const { t } = useLanguage();
  const rem = makeRemStyles(colors, radius, spacing);
  const [enabled, setEnabled]   = useState(false);
  const [hour,    setHour]      = useState(8);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY).then(v => {
      if (v) { const d = JSON.parse(v); setEnabled(d.enabled); setHour(d.hour ?? 8); }
      setLoading(false);
    });
  }, []);

  const save = async (newEnabled, newHour) => {
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ enabled: newEnabled, hour: newHour }));
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    if (newEnabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
          title: t('contraceptive_reminder_title'),
          body:  t('contraceptive_reminder_body'),
          sound: true,
        },
        trigger: {
          type: 'daily',
          hour: newHour,
          minute: 0,
          repeats: true,
        },
      }).catch(() => {});
    }
  };

  const toggle = async (val) => {
    setEnabled(val);
    await save(val, hour);
  };

  const changeHour = async (delta) => {
    const next = (hour + delta + 24) % 24;
    setHour(next);
    if (enabled) await save(true, next);
  };

  if (loading) return null;

  return (
    <View style={rem.card}>
      <View style={rem.row}>
        <View style={rem.iconWrap}>
          <Ionicons name="alarm" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rem.title}>{t('daily_reminder_title')}</Text>
          <Text style={rem.sub}>{t('daily_reminder_sub')}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: colors.border, true: colors.primary + '88' }}
          thumbColor={enabled ? colors.primary : '#f4f3f4'}
        />
      </View>
      {enabled && (
        <View style={rem.timeRow}>
          <Text style={rem.timeLabel}>{t('reminder_time_label')}</Text>
          <TouchableOpacity onPress={() => changeHour(-1)} style={rem.arrow}>
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text style={rem.time}>{String(hour).padStart(2, '0')}:00</Text>
          <TouchableOpacity onPress={() => changeHour(1)} style={rem.arrow}>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeRemStyles = (colors, radius, spacing) => StyleSheet.create({
  card:    { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 2, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap:{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center' },
  title:   { color: colors.text, fontWeight: '700', fontSize: 14 },
  sub:     { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md },
  timeLabel:{ color: colors.textSecondary, fontSize: 13 },
  arrow:   { padding: 4 },
  time:    { fontSize: 22, fontWeight: '800', color: colors.primary, minWidth: 60, textAlign: 'center' },
});

export default function ContraceptivesScreen() {
  const { t } = useLanguage();
  const { colors, radius, spacing } = useTheme();
  const styles = makeStyles(colors, radius, spacing);
  const { items, loading, categories } = useContraceptives();
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [selectedItem, setSelectedItem] = useState(null);

  const filtered = selectedCategory === 'Tous'
    ? items
    : items.filter(m => m.category === selectedCategory);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>{t('contraceptives_title')}</Text>
        <Text style={styles.subtitle}>{t('contraceptives_sub')}</Text>

        <ContraceptiveReminder colors={colors} radius={radius} spacing={spacing} />

        {/* Filtres catégories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Liste des items */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>{t('no_items_category')}</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => setSelectedItem(item)}
              activeOpacity={0.85}
            >
              <View style={[styles.cardIcon, { backgroundColor: (item.color || colors.primary) + '22' }]}>
                <Text style={styles.cardEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardCategory}>{item.category}</Text>
                <View style={styles.cardMeta}>
                  {item.efficacy && item.efficacy !== '-' && (
                    <View style={[styles.badge, { backgroundColor: (item.color || colors.primary) + '33' }]}>
                      <Text style={[styles.badgeText, { color: item.color || colors.primary }]}>✓ {item.efficacy}</Text>
                    </View>
                  )}
                  {item.duration && <Text style={styles.cardDuration}>{item.duration}</Text>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
            </TouchableOpacity>
          ))
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="medical-outline" size={14} color={colors.textGray} />
          <Text style={styles.disclaimerText}>
            {' '}{t('contraceptives_disclaimer')}
          </Text>
        </View>
      </ScrollView>

      {/* Modal détail */}
      <Modal visible={!!selectedItem} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalEmoji}>{selectedItem?.emoji}</Text>
                <View style={styles.modalTitleBlock}>
                  <Text style={styles.modalTitle}>{selectedItem?.name}</Text>
                  <Text style={styles.modalCategory}>{selectedItem?.category}</Text>
                </View>
              </View>

              {(selectedItem?.efficacy !== '-' || selectedItem?.duration) && (
                <View style={styles.modalStats}>
                  {selectedItem?.efficacy && selectedItem.efficacy !== '-' && (
                    <View style={[styles.statBox, { backgroundColor: (selectedItem?.color || colors.primary) + '22' }]}>
                      <Text style={styles.statValue}>{selectedItem?.efficacy}</Text>
                      <Text style={styles.statLabel}>{t('efficacy_label')}</Text>
                    </View>
                  )}
                  {selectedItem?.duration && (
                    <View style={[styles.statBox, { backgroundColor: colors.background }]}>
                      <Text style={styles.statValue}>{selectedItem?.duration}</Text>
                      <Text style={styles.statLabel}>{t('duration_label')}</Text>
                    </View>
                  )}
                </View>
              )}

              {selectedItem?.description ? (
                <Text style={styles.modalDesc}>{selectedItem.description}</Text>
              ) : null}

              {selectedItem?.pros?.length > 0 && (
                <>
                  <Text style={styles.prosTitle}>{t('advantages_short')}</Text>
                  {selectedItem.pros.map((p, i) => (
                    <Text key={i} style={styles.proItem}>• {p}</Text>
                  ))}
                </>
              )}

              {selectedItem?.cons?.length > 0 && (
                <>
                  <Text style={styles.consTitle}>{t('disadvantages_short')}</Text>
                  {selectedItem.cons.map((c, i) => (
                    <Text key={i} style={styles.conItem}>• {c}</Text>
                  ))}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedItem(null)}>
              <Text style={styles.closeBtnText}>{t('close_action')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors, radius, spacing) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textGray, marginBottom: spacing.xl, lineHeight: 18 },
  filters: { marginBottom: spacing.xl },
  filterChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.card, marginRight: spacing.sm + 2, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textGray, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, elevation: 1 },
  cardIcon: { width: 52, height: 52, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardEmoji: { fontSize: 26 },
  cardInfo: { flex: 1 },
  cardName: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 2 },
  cardCategory: { color: colors.textGray, fontSize: 12, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  cardDuration: { color: colors.textGray, fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { color: colors.textGray, fontSize: 15 },
  disclaimer: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.warning + '66', marginTop: spacing.sm },
  disclaimerText: { color: colors.textGray, fontSize: 12, lineHeight: 18, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: 14 },
  modalEmoji: { fontSize: 40 },
  modalTitleBlock: { flex: 1 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  modalCategory: { color: colors.textGray, fontSize: 13 },
  modalStats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statBox: { flex: 1, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textGray, fontSize: 12, marginTop: 2 },
  modalDesc: { color: colors.textLight, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg },
  prosTitle: { color: colors.success, fontWeight: '700', fontSize: 14, marginBottom: spacing.sm },
  proItem: { color: colors.textLight, fontSize: 13, lineHeight: 24, paddingLeft: spacing.sm },
  consTitle: { color: colors.warning, fontWeight: '700', fontSize: 14, marginTop: spacing.md, marginBottom: spacing.sm },
  conItem: { color: colors.textLight, fontSize: 13, lineHeight: 24, paddingLeft: spacing.sm },
  closeBtn: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
