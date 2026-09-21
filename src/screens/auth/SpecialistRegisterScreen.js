import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const SPECIALITIES = ['Gynécologue', 'Sage-femme', 'Sexologue', 'Endocrinologue', 'Médecin généraliste', 'Psychologue', 'Infirmière', 'Autre'];

export default function SpecialistRegisterScreen({ navigation }) {
  const { t } = useLanguage();
  const { registerSpecialist, error, clearError } = useAuth();
  const { colors, role, spacing, radius, shadows, isDark } = useTheme();
  const styles = makeStyles(colors, role, spacing, radius, shadows);
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '', speciality: '', institution: '', credentials: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const update = (f, v) => { setForm(p => ({ ...p, [f]: v })); clearError(); };

  const handleRegister = async () => {
    const { displayName, email, password, confirm, speciality, credentials } = form;
    if (!displayName.trim() || !email.trim() || !password || !speciality || !credentials.trim()) {
      Alert.alert(t('error_generic'), t('fill_required_fields')); return;
    }
    if (password !== confirm) { Alert.alert(t('error_generic'), t('passwords_mismatch')); return; }
    setLoading(true);
    try {
      await registerSpecialist(email.trim(), password, {
        displayName: displayName.trim(), speciality,
        institution: form.institution.trim(), credentials: credentials.trim(),
        phone: form.phone.trim(),
      });
    } catch (e) {} finally { setLoading(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={role.specialist} />
          </TouchableOpacity>

          <View style={styles.iconBox}>
            <Ionicons name="medkit" size={44} color={role.specialist} />
          </View>
          <Text style={styles.title}>{t('specialist_account_title')}</Text>

          <View style={styles.infoBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="time-outline" size={16} color={colors.warning} />
              <Text style={styles.infoText}>{t('specialist_pending_note')}</Text>
            </View>
          </View>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          <Text style={styles.label}>{t('full_name_required')}</Text>
          <TextInput style={styles.input} placeholder="Dr. Prénom Nom" placeholderTextColor={colors.textGray} value={form.displayName} onChangeText={v => update('displayName', v)} />

          <Text style={styles.label}>{t('email_required')}</Text>
          <TextInput style={styles.input} placeholder="votre@email.com" placeholderTextColor={colors.textGray} value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>{t('speciality_required')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {SPECIALITIES.map(s => (
              <TouchableOpacity key={s} style={[styles.chip, form.speciality === s && styles.chipActive]} onPress={() => update('speciality', s)}>
                <Text style={[styles.chipText, form.speciality === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>{t('credentials_label')}</Text>
          <TextInput style={[styles.input, styles.multiline]} placeholder={t('credentials_placeholder')} placeholderTextColor={colors.textGray} value={form.credentials} onChangeText={v => update('credentials', v)} multiline numberOfLines={3} />

          <Text style={styles.label}>{t('institution_label')}</Text>
          <TextInput style={styles.input} placeholder={t('institution_placeholder')} placeholderTextColor={colors.textGray} value={form.institution} onChangeText={v => update('institution', v)} />

          <Text style={styles.label}>{t('professional_phone_label')}</Text>
          <TextInput style={styles.input} placeholder="+237 000 000 000" placeholderTextColor={colors.textGray} value={form.phone} onChangeText={v => update('phone', v)} keyboardType="phone-pad" />

          <Text style={styles.label}>{t('password_required')}</Text>
          <TextInput style={styles.input} placeholder={t('min_6_chars_placeholder')} placeholderTextColor={colors.textGray} value={form.password} onChangeText={v => update('password', v)} secureTextEntry />

          <Text style={styles.label}>{t('confirm_password_required')}</Text>
          <TextInput style={styles.input} placeholder={t('retype_password_placeholder')} placeholderTextColor={colors.textGray} value={form.confirm} onChangeText={v => update('confirm', v)} secureTextEntry />

          <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('submit_request_action')}</Text>}
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
  iconBox: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, borderWidth: 2, borderColor: role.specialist, ...shadows.sm },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.xl },
  infoBanner: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, marginBottom: spacing.xl },
  infoText: { color: colors.warning, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, padding: spacing.md, marginBottom: spacing.lg },
  errorText: { color: colors.error, fontSize: 14 },
  label: { color: colors.textLight, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg + 2, ...shadows.sm },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipsScroll: { marginBottom: spacing.lg + 2 },
  chip: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.card, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: role.specialist, borderColor: role.specialist },
  chipText: { color: colors.textGray, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: {
    borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center',
    backgroundColor: role.specialist, marginTop: spacing.sm,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
