import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar, Animated, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const { width, height } = Dimensions.get('window');

// ─── 3 profils illustrés ──────────────────────────────────────────────────────
// Teinte chaque carte avec la couleur de rôle correspondante (girl/boy/specialist)
// pour donner un avant-goût de l'identité visuelle de chaque espace.
const getProfiles = (role) => [
  {
    icon:     'female',
    labelKey: 'profile_feminine_label',
    descKey:  'profile_feminine_desc',
    color:    role.girl,
    bg:       role.girlLight,
  },
  {
    icon:     'male',
    labelKey: 'profile_masculine_label',
    descKey:  'profile_masculine_desc',
    color:    role.boy,
    bg:       role.boyLight,
  },
  {
    icon:     'medkit',
    labelKey: 'profile_health_label',
    descKey:  'profile_health_desc',
    color:    role.specialist,
    bg:       role.specialistLight,
  },
];

// ─── Composant : carte profil ─────────────────────────────────────────────────
function ProfileCard({ profile, index, animValue, styles, t }) {
  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  return (
    <Animated.View style={[
      styles.profileCard,
      { backgroundColor: profile.bg },
      { opacity, transform: [{ scale }, { translateY }] },
    ]}>
      <View style={[styles.profileIconWrap, { backgroundColor: profile.color }]}>
        <Ionicons name={profile.icon} size={26} color="#fff" />
      </View>
      <Text style={[styles.profileLabel, { color: profile.color }]}>{t(profile.labelKey)}</Text>
      <Text style={styles.profileDesc}>{t(profile.descKey)}</Text>
    </Animated.View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function WelcomeScreen({ navigation }) {
  const { colors, isDark, role, spacing, radius, shadows, typography } = useTheme();
  const { t } = useLanguage();
  const styles = makeStyles(colors, spacing, radius, shadows, typography);
  const PROFILES = getProfiles(role);

  // Animations d'entrée
  const logoAnim    = useRef(new Animated.Value(0)).current;
  const titleAnim   = useRef(new Animated.Value(0)).current;
  const cardsAnim   = useRef(new Animated.Value(0)).current;
  const buttonsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(titleAnim,   { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardsAnim,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(buttonsAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const logoOpacity    = logoAnim;
  const logoTranslateY = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
  const titleOpacity   = titleAnim;
  const buttonsOpacity = buttonsAnim;
  const buttonsTranslateY = buttonsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* ── Logo ────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.logoSection, { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] }]}>
        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
          <Image source={require('../../../assets/logo-mark.png')} style={{ width: 52, height: 52 }} resizeMode="contain" />
        </View>
        <Text style={styles.appName}>LUNELA</Text>
      </Animated.View>

      {/* ── Tagline ──────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.taglineWrap, { opacity: titleOpacity }]}>
        <View style={styles.taglineRow}>
          <Text style={styles.taglineAccent}>{t('welcome_tagline1')}</Text>
          <Text style={styles.taglineDot}> · </Text>
          <Text style={styles.taglineAccent2}>{t('welcome_tagline2')}</Text>
          <Text style={styles.taglineDot}> · </Text>
          <Text style={styles.taglineAccent3}>{t('welcome_tagline3')}</Text>
        </View>
        <Text style={styles.taglineSub}>
          {t('welcome_subtitle_pre')}{' '}
          <Text style={{ fontWeight: '700', color: colors.text }}>{t('welcome_subtitle_bold')}</Text>
        </Text>
      </Animated.View>

      {/* ── 3 cartes profil ──────────────────────────────────────────────── */}
      <Animated.View style={[styles.profilesRow, { opacity: cardsAnim }]}>
        {PROFILES.map((p, i) => (
          <ProfileCard key={p.labelKey} profile={p} index={i} animValue={cardsAnim} styles={styles} t={t} />
        ))}
      </Animated.View>

      {/* ── Boutons d'action ─────────────────────────────────────────────── */}
      <Animated.View style={[styles.actionsSection, { opacity: buttonsOpacity, transform: [{ translateY: buttonsTranslateY }] }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>{t('create_account')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>{t('login')}</Text>
        </TouchableOpacity>

      </Animated.View>

      {/* ── Liens pro + CGU ──────────────────────────────────────────────── */}
      <View style={styles.proLinks}>
        <TouchableOpacity onPress={() => navigation.navigate('SpecialistRegister')}>
          <Text style={styles.proLink}>{t('join_specialist')}</Text>
        </TouchableOpacity>
        <Text style={styles.proLinkSep}>·</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminRegister')}>
          <Text style={styles.proLink}>{t('admin_space')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.terms}>
        {t('terms_pre')}{' '}
        <Text style={styles.termsLink}>{t('terms_link')}</Text>
      </Text>

      {/* ── Crédit fondatrice ────────────────────────────────────────────── */}
      <View style={styles.creditRow}>
        <Ionicons name="heart" size={11} color={colors.primary} />
        <Text style={styles.creditText}>
          {t('credit_pre')}{' '}
          <Text style={styles.creditName}>Marie-Louise NGO NGWANG</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── Styles (fonction du thème actif) ─────────────────────────────────────────
const makeStyles = (colors, spacing, radius, shadows, typography) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: spacing.xxxl,
  },

  // Logo
  logoSection:   { alignItems: 'center' },
  logoContainer: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md + 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12 },
  appName:       { fontSize: 40, fontWeight: '900', color: colors.text, letterSpacing: 8 },

  // Tagline
  taglineWrap:    { alignItems: 'center' },
  taglineRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs + 2 },
  taglineAccent:  { ...typography.bodyBold, fontSize: 16, color: colors.primary },
  taglineDot:     { fontSize: 16, color: colors.textSecondary },
  taglineAccent2: { ...typography.bodyBold, fontSize: 16, color: colors.secondary },
  taglineAccent3: { ...typography.bodyBold, fontSize: 16, color: '#3B82F6' },
  taglineSub:     { ...typography.body, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Profils
  profilesRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  profileCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  profileIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm, ...shadows.md },
  profileLabel:    { ...typography.caption, fontSize: 13, fontWeight: '800', marginBottom: spacing.xs },
  profileDesc:     { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 15 },

  // Boutons
  actionsSection: { width: '100%' },
  primaryButton:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.lg,
    marginBottom: spacing.sm + 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 7,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondaryButton:   { borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', borderWidth: 2, borderColor: colors.primary, marginBottom: spacing.xl - 2, backgroundColor: 'transparent' },
  secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },

  // Pro + CGU
  proLinks:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
  proLink:    { color: colors.textSecondary, fontSize: 11, textDecorationLine: 'underline' },
  proLinkSep: { color: colors.textSecondary, fontSize: 11 },
  terms:      { textAlign: 'center', color: colors.textSecondary, fontSize: 11, lineHeight: 18, marginTop: spacing.xs },
  termsLink:  { color: colors.primary, textDecorationLine: 'underline' },

  // Crédit fondatrice
  creditRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.xs + 2 },
  creditText: { fontSize: 10, color: colors.textSecondary },
  creditName: { fontWeight: '700', color: colors.primary },
});
