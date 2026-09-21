import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function VerifyEmailScreen() {
  const { t } = useLanguage();
  const { user, resendVerification, refreshUser, logout } = useAuth();
  const { colors, isDark, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, shadows);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleCheckVerification = async () => {
    setVerifying(true);
    try {
      await refreshUser();
      if (!user?.emailVerified) {
        Alert.alert(
          t('not_yet_verified_title'),
          t('not_yet_verified_msg'),
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert(t('network_error_title'), t('network_error_msg'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await resendVerification();
      setResendCooldown(60);
      Alert.alert(t('email_sent_title'), t('email_sent_msg', { email: user?.email }));
    } catch (e) {
      Alert.alert(t('error_generic'), t('resend_email_error'));
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = user?.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 6)) + c)
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
        <View style={[styles.iconGradient, { backgroundColor: colors.primary }]}>
          <Ionicons name="mail" size={48} color="#fff" />
        </View>
      </Animated.View>

      <Text style={styles.title}>{t('verify_email_title')}</Text>
      <Text style={styles.emailHighlight}>{maskedEmail}</Text>
      <Text style={styles.subtitle}>
        {t('verify_email_sub')}
      </Text>

      <View style={styles.stepsCard}>
        <Step n="1" text={t('verify_step1')} colors={colors} spacing={spacing} />
        <Step n="2" text={t('verify_step2')} colors={colors} spacing={spacing} />
        <Step n="3" text={t('verify_step3')} colors={colors} spacing={spacing} />
        <Step n="4" text={t('verify_step4')} colors={colors} spacing={spacing} />
      </View>

      <TouchableOpacity
        style={styles.verifyButton}
        onPress={handleCheckVerification}
        disabled={verifying}
        activeOpacity={0.85}
      >
        {verifying
          ? <ActivityIndicator color="#fff" />
          : (
            <View style={styles.btnRow}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.verifyButtonText}>{t('confirmed_email_action')}</Text>
            </View>
          )
        }
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleResend}
        disabled={resendCooldown > 0 || loading}
        style={styles.resendButton}
      >
        {loading
          ? <ActivityIndicator color={colors.primary} size="small" />
          : (
            <View style={styles.btnRow}>
              <Ionicons name="refresh" size={16} color={resendCooldown > 0 ? colors.textGray : colors.primary} />
              <Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabled]}>
                {resendCooldown > 0 ? t('resend_in_seconds', { n: resendCooldown }) : t('resend_email_action')}
              </Text>
            </View>
          )
        }
      </TouchableOpacity>

      <View style={styles.spamNotice}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textGray} />
        <Text style={styles.spamText}>{t('spam_notice')}</Text>
      </View>

      <TouchableOpacity onPress={logout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>{t('logout_action')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Step({ n, text, colors, spacing }) {
  const stepStyles = makeStepStyles(colors, spacing);
  return (
    <View style={stepStyles.row}>
      <View style={stepStyles.circle}>
        <Text style={stepStyles.n}>{n}</Text>
      </View>
      <Text style={stepStyles.text}>{text}</Text>
    </View>
  );
}

const makeStepStyles = (colors, spacing) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
  circle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '22', borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  n: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  text: { color: colors.textLight, fontSize: 14, flex: 1 },
});

const makeStyles = (colors, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  iconContainer: { marginBottom: spacing.xxl },
  iconGradient: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.xs + 2, textAlign: 'center' },
  emailHighlight: { fontSize: 15, color: colors.primary, fontWeight: '700', marginBottom: spacing.sm },
  subtitle: { fontSize: 14, color: colors.textGray, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xxl },
  stepsCard: {
    width: '100%', backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg + 2, marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.border,
    ...shadows.sm,
  },
  verifyButton: {
    width: '100%', borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center',
    backgroundColor: colors.primary, marginBottom: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendButton: { marginBottom: spacing.lg, paddingVertical: spacing.sm },
  resendText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: colors.textGray },
  spamNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xxl },
  spamText: { color: colors.textGray, fontSize: 12 },
  logoutButton: { paddingVertical: spacing.sm },
  logoutText: { color: colors.error, fontSize: 14 },
});
