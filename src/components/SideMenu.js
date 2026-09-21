import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const MENU_ITEMS_GIRL = [
  { name: 'Cycle',        labelKey: 'nav_cycle',       icon: 'moon-outline',         lib: 'Ionicons' },
  { name: 'Symptomes',    labelKey: 'nav_symptoms',    icon: 'heart-outline',        lib: 'Ionicons' },
  { name: 'Education',    labelKey: 'nav_education',   icon: 'book-outline',         lib: 'Ionicons' },
  { name: 'Quiz',         labelKey: 'nav_quiz',        icon: 'trophy-outline',       lib: 'Ionicons' },
  { name: 'Forum',        labelKey: 'nav_forum',       icon: 'people-circle-outline',lib: 'Ionicons' },
  { name: 'Chat',         labelKey: 'nav_chat',        icon: 'chatbubbles-outline',  lib: 'Ionicons' },
  { name: 'Profil',       labelKey: 'nav_profile',     icon: 'person-outline',       lib: 'Ionicons' },
];

export const MENU_ITEMS_BOY = [
  { name: 'MaSante',      labelKey: 'nav_health',            icon: 'fitness-outline',      lib: 'Ionicons' },
  { name: 'Comprendre',   labelKey: 'nav_understand_short',  icon: 'school-outline',       lib: 'Ionicons' },
  { name: 'Quiz',         labelKey: 'nav_quiz',              icon: 'trophy-outline',       lib: 'Ionicons' },
  { name: 'Partenaire',   labelKey: 'nav_partner',           icon: 'people-outline',       lib: 'Ionicons' },
  { name: 'Responsabilite', labelKey: 'nav_responsibility',  icon: 'shield-checkmark-outline', lib: 'Ionicons' },
  { name: 'Forum',        labelKey: 'nav_forum',             icon: 'people-circle-outline',lib: 'Ionicons' },
  { name: 'Chat',         labelKey: 'nav_chat',              icon: 'chatbubbles-outline',  lib: 'Ionicons' },
  { name: 'Profil',       labelKey: 'nav_profile',           icon: 'person-outline',       lib: 'Ionicons' },
];

// Conservé pour les anciens comptes (UserApp)
const MENU_ITEMS_LEGACY = [
  { name: 'Cycle',         labelKey: 'nav_cycle',         icon: 'moon-outline',        lib: 'Ionicons' },
  { name: 'Contraceptifs', labelKey: 'nav_contraceptives',icon: 'pill',                lib: 'MCI' },
  { name: 'Chat',          labelKey: 'nav_chat',          icon: 'chatbubbles-outline', lib: 'Ionicons' },
  { name: 'Profil',        labelKey: 'nav_profile',       icon: 'person-outline',      lib: 'Ionicons' },
];

function MenuIcon({ icon, lib, color, size }) {
  if (lib === 'MCI') return <MaterialCommunityIcons name={icon} size={size} color={color} />;
  return <Ionicons name={icon} size={size} color={color} />;
}

// ─── Écran "Plus" — grille plein écran ─────────────────────────────────────
// Remplace le tiroir latéral glissant : ouverture en fondu plein écran,
// tuiles de grille au lieu d'une liste, pour un paradigme de navigation
// visiblement différent de l'ancien menu hamburger.
export default function SideMenu({ visible, onClose, activeScreen, onNavigate, menuItems, accentColor, chromeColors }) {
  const { colors: themeColors, spacing, radius, shadows } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const colors  = chromeColors ?? themeColors;
  const styles  = makeStyles(colors, spacing, radius, shadows);
  const items   = menuItems ?? MENU_ITEMS_LEGACY;
  const accent  = accentColor ?? colors.primary;
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [visible]);

  if (!visible && opacity._value === 0) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.screen, { opacity, paddingTop: insets.top + spacing.lg }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.topRow}>
        <Text style={styles.title}>{t('nav_more')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const isActive = activeScreen === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.tile, isActive && { borderColor: accent, backgroundColor: accent + '10' }]}
              onPress={() => { onNavigate(item.name); onClose(); }}
              activeOpacity={0.7}
            >
              <View style={[styles.tileIconBox, { backgroundColor: isActive ? accent : colors.cardLight }]}>
                <MenuIcon icon={item.icon} lib={item.lib} size={24} color={isActive ? '#fff' : accent} />
              </View>
              <Text style={[styles.tileLabel, { color: colors.text }, isActive && { color: accent, fontWeight: '700' }]} numberOfLines={2}>
                {t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.langRow}>
          {[{ code: 'fr', label: 'FR' }, { code: 'en', label: 'EN' }].map(l => (
            <TouchableOpacity
              key={l.code}
              onPress={() => setLang(l.code)}
              style={[styles.langChip, lang === l.code && { backgroundColor: accent, borderColor: accent }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langChipTxt, lang === l.code && { color: '#fff', fontWeight: '700' }]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => { onClose(); logout(); }} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors, spacing, radius, shadows) => StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  closeBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.cardLight,
    alignItems: 'center', justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  tile: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
    ...shadows.sm,
  },
  tileIconBox: {
    width: 52, height: 52, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  footer: { paddingTop: spacing.md },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  langChip: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  langChipTxt: { fontSize: 13, fontWeight: '600', color: colors.textGray },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.error + '12',
  },
  logoutText: { color: colors.error, fontSize: 15, fontWeight: '700' },
});
