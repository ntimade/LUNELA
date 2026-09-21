import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminRegisterScreen({ navigation }) {
  const { t } = useLanguage();
  const { registerAdmin, error, clearError } = useAuth();
  const { colors, role, spacing, radius, shadows, isDark } = useTheme();
  const styles = makeStyles(colors, role, spacing, radius, shadows);
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [isFirst, setIsFirst] = useState(null);

  const update = (f, v) => { setForm(p => ({ ...p, [f]: v })); clearError(); };

  const checkFirst = async () => {
    try {
      const snap = await getDocs(collection(db, 'admins'));
      setIsFirst(snap.empty);
    } catch (e) {
      setIsFirst(true); // supposé premier si Firestore inaccessible
    }
  };

  React.useEffect(() => { checkFirst(); }, []);

  const handleRegister = async () => {
    if (!form.displayName.trim() || !form.email.trim() || !form.password || !form.confirm) {
      Alert.alert(t('error_generic'), t('fill_all_fields')); return;
    }
    if (form.password !== form.confirm) {
      Alert.alert(t('error_generic'), t('passwords_mismatch')); return;
    }
    if (form.password.length < 6) {
      Alert.alert(t('error_generic'), t('password_too_short')); return;
    }
    setLoading(true);
    try {
      await registerAdmin(form.email.trim(), form.password, form.displayName.trim());
    } catch (e) {} finally { setLoading(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={role.admin} />
          </TouchableOpacity>

          <View style={styles.iconBox}>
            <Ionicons name="shield-checkmark" size={44} color={role.admin} />
          </View>
          <Text style={styles.title}>{t('admin_account_title')}</Text>

          {isFirst !== null && (
            <View style={[styles.infoBanner, { borderColor: isFirst ? colors.success : colors.warning }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons
                  name={isFirst ? 'checkmark-circle' : 'time-outline'}
                  size={16}
                  color={isFirst ? colors.success : colors.warning}
                />
                <Text style={[styles.infoText, { color: isFirst ? colors.success : colors.warning }]}>
                  {isFirst
                    ? t('first_admin_note')
                    : t('admin_pending_note')}
                </Text>
              </View>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('full_name_label')}</Text>
          <TextInput style={styles.input} placeholder="Prénom Nom" placeholderTextColor={colors.textGray} value={form.displayName} onChangeText={v => update('displayName', v)} />

          <Text style={styles.label}>{t('email_address_label')}</Text>
          <TextInput style={styles.input} placeholder="admin@lunela.app" placeholderTextColor={colors.textGray} value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>{t('password_label')}</Text>
          <TextInput style={styles.input} placeholder={t('min_6_chars_placeholder')} placeholderTextColor={colors.textGray} value={form.password} onChangeText={v => update('password', v)} secureTextEntry />

          <Text style={styles.label}>{t('confirm_password_label')}</Text>
          <TextInput style={styles.input} placeholder={t('retype_password_placeholder')} placeholderTextColor={colors.textGray} value={form.confirm} onChangeText={v => update('confirm', v)} secureTextEntry />

          <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('create_account_action')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors, role, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: 60, paddingBottom: spacing.xxxl + 8 },
  back: { marginBottom: spacing.xl },
  iconBox: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, borderWidth: 2, borderColor: role.admin, ...shadows.sm },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.xl },
  infoBanner: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.xl },
  infoText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, padding: spacing.md, marginBottom: spacing.lg },
  errorText: { color: colors.error, fontSize: 14 },
  label: { color: colors.textLight, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg + 2, ...shadows.sm },
  submitBtn: {
    borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center',
    backgroundColor: role.admin, marginTop: spacing.sm,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
