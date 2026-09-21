import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, PROFILES } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Étape 1 : choix du profil ────────────────────────────────────────────────

function ProfileChoiceStep({ onChoose, onBack }) {
  const { colors, isDark, role, spacing, radius, shadows } = useTheme();
  const { t } = useLanguage();
  const styles = makeStyles(colors, spacing, radius, shadows);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.card}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>{t('register_title')}</Text>
          <Text style={styles.subtitle}>
            {t('register_choose_subtitle')}
          </Text>

          {/* Carte Fille */}
          <TouchableOpacity
            style={[styles.profileCard, styles.profileCardInner, { backgroundColor: role.girlLight }]}
            onPress={() => onChoose(PROFILES.GIRL)}
            activeOpacity={0.85}
          >
            <View style={[styles.profileIcon, { backgroundColor: '#FFFFFF' }]}>
              <Ionicons name="female" size={30} color={role.girl} />
            </View>
            <View style={styles.profileText}>
              <Text style={[styles.profileTitle, { color: role.girl }]}>{t('profile_feminine')}</Text>
              <Text style={styles.profileDesc}>
                {t('profile_feminine_full_desc')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={role.girl} />
          </TouchableOpacity>

          {/* Carte Garçon */}
          <TouchableOpacity
            style={[styles.profileCard, styles.profileCardInner, { backgroundColor: role.boyLight }]}
            onPress={() => onChoose(PROFILES.BOY)}
            activeOpacity={0.85}
          >
            <View style={[styles.profileIcon, { backgroundColor: '#FFFFFF' }]}>
              <Ionicons name="male" size={30} color={role.boy} />
            </View>
            <View style={styles.profileText}>
              <Text style={[styles.profileTitle, { color: role.boy }]}>{t('profile_masculine')}</Text>
              <Text style={styles.profileDesc}>
                {t('profile_masculine_full_desc')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={role.boy} />
          </TouchableOpacity>

          {/* Note personnel de santé */}
          <TouchableOpacity
            style={styles.healthWorkerRow}
            onPress={() => onBack('SpecialistRegister')}
            activeOpacity={0.8}
          >
            <Ionicons name="medkit-outline" size={18} color={colors.textGray} />
            <Text style={styles.healthWorkerText}>
              {t('health_worker_q')}{' '}
              <Text style={styles.healthWorkerLink}>{t('health_worker_link')}</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('already_account_pre')}</Text>
            <TouchableOpacity onPress={() => onBack('Login')}>
              <Text style={styles.loginLink}>{t('login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Étape 2 : formulaire d'inscription ───────────────────────────────────────

function RegisterFormStep({ profile, onBack }) {
  const { registerWithEmail, error, clearError } = useAuth();
  const { colors, isDark, role, spacing, radius, shadows } = useTheme();
  const { t } = useLanguage();
  const styles = makeStyles(colors, spacing, radius, shadows);
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm,  setShowConfirm]    = useState(false);
  const [loading,      setLoading]        = useState(false);
  const [localError,   setLocalError]     = useState('');

  const isGirl = profile === PROFILES.GIRL;

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setLocalError('');
    clearError();
  };

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setLocalError('Veuillez entrer votre prénom et nom.');
      return false;
    }
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      setLocalError('Adresse email invalide.');
      return false;
    }
    if (form.password.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
      return false;
    }
    if (form.password !== form.confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const displayName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      await registerWithEmail(form.email.trim(), form.password, displayName, profile);
    } catch (_) {
      // error géré dans AuthContext
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || error;

  // Couleurs adaptées au profil (tokens de rôle)
  const accent     = isGirl ? role.girl         : role.boy;
  const accentLight= isGirl ? colors.primaryLight : '#93C5FD';
  const badgeBg    = isGirl ? role.girlLight    : role.boyLight;
  const badgeBorder= isGirl ? colors.border     : role.boy + '40';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.card}>

            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={22} color={accent} />
            </TouchableOpacity>

            {/* Badge profil */}
            <View style={[styles.profileBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Ionicons name={isGirl ? 'female' : 'male'} size={16} color={accent} />
              <Text style={[styles.profileBadgeLabel, { color: accent }]}>
                {isGirl ? t('profile_feminine') : t('profile_masculine')}
              </Text>
            </View>

            <Text style={styles.title}>{t('register_title')}</Text>
            <Text style={styles.subtitle}>{t('register_form_subtitle')}</Text>

            {displayError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{displayError}</Text>
                <TouchableOpacity onPress={() => { setLocalError(''); clearError(); }}>
                  <Ionicons name="close" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Prénom & Nom */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>{t('first_name')}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('first_name')}
                    placeholderTextColor={colors.textGray}
                    value={form.firstName}
                    onChangeText={(v) => update('firstName', v)}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>{t('last_name')}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('last_name')}
                    placeholderTextColor={colors.textGray}
                    value={form.lastName}
                    onChangeText={(v) => update('lastName', v)}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>

            {/* Email */}
            <Text style={styles.label}>{t('email_address')}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                placeholderTextColor={colors.textGray}
                value={form.email}
                onChangeText={(v) => update('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Mot de passe */}
            <Text style={styles.label}>{t('password')}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={colors.textGray}
                value={form.password}
                onChangeText={(v) => update('password', v)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            {/* Confirmation */}
            <Text style={styles.label}>{t('confirm_password')}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Retapez votre mot de passe"
                placeholderTextColor={colors.textGray}
                value={form.confirmPassword}
                onChangeText={(v) => update('confirmPassword', v)}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            {form.password.length > 0 && <PasswordStrength password={form.password} colors={colors} />}

            {/* Bouton */}
            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: accent }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.registerButtonText}>{t('create_my_account')}</Text>
              }
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>{t('already_account_pre')}</Text>
              <TouchableOpacity onPress={() => onBack('Login')}>
                <Text style={[styles.loginLink, { color: accentLight }]}>{t('login')}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Écran principal (orchestre les 2 étapes) ─────────────────────────────────

export default function RegisterScreen({ navigation }) {
  const [step,    setStep]    = useState('choice');   // 'choice' | 'form'
  const [profile, setProfile] = useState(null);

  const handleChoose = (p) => {
    setProfile(p);
    setStep('form');
  };

  const handleBack = (screen) => {
    if (step === 'form') {
      setStep('choice');
      return;
    }
    if (screen && screen !== true) {
      navigation.navigate(screen);
    } else {
      navigation.goBack();
    }
  };

  if (step === 'choice') {
    return <ProfileChoiceStep onChoose={handleChoose} onBack={handleBack} />;
  }

  return <RegisterFormStep profile={profile} onBack={() => setStep('choice')} />;
}

// ─── Indicateur force du mot de passe ────────────────────────────────────────

function PasswordStrength({ password, colors }) {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 6)          score++;
    if (password.length >= 10)         score++;
    if (/[A-Z]/.test(password))        score++;
    if (/[0-9]/.test(password))        score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };
  const score  = getStrength();
  const labels = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];
  const strengthColors = ['', colors.error, colors.error, colors.warning, colors.success, colors.success];
  return (
    <View style={strengthStyles.container}>
      <View style={strengthStyles.bars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[strengthStyles.bar, { backgroundColor: i <= score ? strengthColors[score] : colors.border }]} />
        ))}
      </View>
      <Text style={[strengthStyles.label, { color: strengthColors[score] }]}>{labels[score]}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const strengthStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  bars:      { flexDirection: 'row', gap: 4, flex: 1 },
  bar:       { flex: 1, height: 4, borderRadius: 2 },
  label:     { fontSize: 12, fontWeight: '600', minWidth: 70, textAlign: 'right' },
});

const makeStyles = (colors, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1 },
  inner:     { flex: 1 },
  scroll:    { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl + 8, flexGrow: 1 },

  card: { width: '100%', maxWidth: 460, alignSelf: 'center' },

  backButton: { marginBottom: spacing.xl, alignSelf: 'flex-start', padding: 4 },

  // Étape 1 — choix profil
  profileCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  profileCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  profileIcon: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  profileText:  { flex: 1 },
  profileTitle: { fontSize: 17, fontWeight: '800', marginBottom: spacing.xs },
  profileDesc:  { fontSize: 12, color: '#6B7280', lineHeight: 18 }, // texte fixe : reste lisible sur les cartes pastel claires (girl/boy) même en dark mode

  healthWorkerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md + 2, justifyContent: 'center',
  },
  healthWorkerText: { color: colors.textGray, fontSize: 14 },
  healthWorkerLink: { color: colors.primary, fontWeight: '700' },

  // Étape 2 — formulaire
  profileBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    alignSelf: 'flex-start', paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm,
    borderRadius: radius.xl, borderWidth: 1, marginBottom: spacing.xl,
  },
  profileBadgeLabel: { fontSize: 13, fontWeight: '700' },

  title:    { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: spacing.xs + 2 },
  subtitle: { fontSize: 15, color: colors.textGray, marginBottom: spacing.xxl + 4 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: colors.error,
    borderRadius: radius.md, padding: spacing.md + 2, marginBottom: spacing.xl,
  },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },

  row:       { flexDirection: 'row', gap: spacing.md },
  halfField: { flex: 1 },
  label:     { color: colors.textLight, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.xs },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardLight, borderRadius: radius.lg,
    paddingHorizontal: spacing.md + 2,
    marginBottom: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm + 2 },
  input: { flex: 1, paddingVertical: spacing.lg, color: colors.text, fontSize: 16 },
  eyeButton: { paddingLeft: spacing.sm + 2, paddingVertical: 6 },

  registerButton: {
    borderRadius: radius.pill,
    paddingVertical: 18, alignItems: 'center',
    marginTop: spacing.sm, marginBottom: spacing.xxl,
  },
  registerButtonText:  { color: '#fff', fontSize: 17, fontWeight: '800' },

  loginRow:  { flexDirection: 'row', justifyContent: 'center' },
  loginText: { color: colors.textGray, fontSize: 15 },
  loginLink: { color: colors.primaryLight, fontSize: 15, fontWeight: '700' },
});
