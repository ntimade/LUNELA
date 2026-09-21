import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, StatusBar, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// ─── Modal : mot de passe oublié ──────────────────────────────────────────────
function ForgotPasswordModal({ visible, initialEmail, onClose }) {
  const { resetPassword } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const { t } = useLanguage();
  const fp = makeFpStyles(colors, spacing, radius);
  const [email,   setEmail]   = useState(initialEmail || '');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  useEffect(() => {
    if (visible) { setEmail(initialEmail || ''); setSent(false); }
  }, [visible, initialEmail]);

  const handleSend = async () => {
    if (!isValidEmail(email)) {
      Alert.alert('Email invalide', 'Merci de saisir une adresse email valide.');
      return;
    }
    setSending(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (_) {
      // erreur déjà gérée dans le contexte
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={fp.overlay}>
        <View style={fp.card}>
          <View style={fp.iconWrap}>
            <Ionicons name={sent ? 'checkmark-circle' : 'key-outline'} size={28} color={colors.primary} />
          </View>

          {sent ? (
            <>
              <Text style={fp.title}>{t('email_sent_title')}</Text>
              <Text style={fp.subtitle}>
                Consulte ta boîte mail ({email}) pour réinitialiser ton mot de passe.
              </Text>
              <TouchableOpacity style={[fp.primaryBtn, { backgroundColor: colors.primary }]} onPress={onClose} activeOpacity={0.85}>
                <Text style={fp.primaryBtnText}>{t('back_to_login')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={fp.title}>{t('forgot_title')}</Text>
              <Text style={fp.subtitle}>{t('forgot_subtitle')}</Text>
              <View style={fp.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.textGray} style={fp.inputIcon} />
                <TextInput
                  style={fp.input}
                  placeholder="votre@email.com"
                  placeholderTextColor={colors.textGray}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity style={[fp.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
                {sending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={fp.primaryBtnText}>{t('send_link')}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ marginTop: 4 }}>
                <Text style={fp.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function LoginScreen({ navigation }) {
  const { loginWithEmail, error, clearError } = useAuth();
  const { colors, isDark, spacing, radius, shadows } = useTheme();
  const { t } = useLanguage();
  const styles = makeStyles(colors, spacing, radius, shadows);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showForgot, setShowForgot] = useState(false);

  const emailInvalid = emailTouched && email.trim().length > 0 && !isValidEmail(email);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailTouched(true);
      Alert.alert('Email invalide', 'Merci de saisir une adresse email valide.');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (e) {
      // error géré dans le contexte
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.card}>

            {/* Header */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>

            <Text style={styles.title}>{t('login_title')}</Text>
            <Text style={styles.subtitle}>{t('login_subtitle')}</Text>

            {/* Erreur globale */}
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={clearError}>
                  <Ionicons name="close" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            {/* Formulaire email */}
            <View style={styles.form}>
              <Text style={styles.label}>{t('email_address')}</Text>
              <View style={[
                styles.inputWrap,
                focusedField === 'email' && styles.inputWrapFocused,
                emailInvalid && styles.inputWrapError,
              ]}>
                <TextInput
                  style={styles.input}
                  placeholder="votre@email.com"
                  placeholderTextColor={colors.textGray}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => { setFocusedField(null); setEmailTouched(true); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {emailInvalid && <Text style={styles.fieldError}>{t('email_invalid')}</Text>}

              <Text style={[styles.label, { marginTop: 16 }]}>{t('password')}</Text>
              <View style={[styles.inputWrap, focusedField === 'password' && styles.inputWrapFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textGray}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textGray} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgotPassword} onPress={() => setShowForgot(true)}>
                <Text style={styles.forgotText}>{t('forgot_password')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: colors.primary }]}
                onPress={handleEmailLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.loginButtonText}>{t('login')}</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Lien inscription */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>{t('no_account_pre')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>{t('register_link')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ForgotPasswordModal
        visible={showForgot}
        initialEmail={email}
        onClose={() => setShowForgot(false)}
      />
    </View>
  );
}

const makeStyles = (colors, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl + 8, flexGrow: 1 },

  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },

  backButton: { marginBottom: spacing.xl, alignSelf: 'flex-start', padding: 4 },

  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.xs + 2, textAlign: 'left' },
  subtitle: { fontSize: 15, color: colors.textGray, marginBottom: spacing.xxl + 4, textAlign: 'left' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: radius.md,
    padding: spacing.md + 2,
    marginBottom: spacing.xl,
  },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },
  form: { marginBottom: spacing.xxl },
  label: { color: colors.textLight, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md + 2,
  },
  inputWrapFocused: { borderColor: colors.primary },
  inputWrapError:   { borderColor: colors.error },
  input: {
    flex: 1,
    paddingVertical: spacing.lg,
    color: colors.text,
    fontSize: 16,
  },
  fieldError: { color: colors.error, fontSize: 12, marginTop: spacing.xs + 2 },
  eyeButton: { paddingLeft: spacing.sm + 2, paddingVertical: 6 },

  forgotPassword: { alignSelf: 'flex-end', marginTop: spacing.md, marginBottom: spacing.xxl },
  forgotText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  loginButton: {
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  loginButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  registerText: { color: colors.textGray, fontSize: 15 },
  registerLink: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});

// ─── Styles : modal mot de passe oublié ──────────────────────────────────────
const makeFpStyles = (colors, spacing, radius) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: colors.card,
    borderRadius: radius.xl, padding: spacing.xxl + 2, alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '18',
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textGray, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: spacing.md + 2, marginBottom: spacing.xl,
  },
  inputIcon: { marginRight: spacing.sm + 2 },
  input: { flex: 1, paddingVertical: spacing.md + 2, color: colors.text, fontSize: 15 },
  primaryBtn: { width: '100%', borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelText: { color: colors.textGray, fontSize: 14, fontWeight: '600', paddingVertical: spacing.sm },
});
