import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const SPECIALITIES = ['Gynécologue', 'Sage-femme', 'Sexologue', 'Endocrinologue', 'Médecin généraliste', 'Psychologue', 'Infirmière', 'Autre'];

// ─── Candidature spécialiste depuis un compte fille/garçon déjà connecté ──────
// Version allégée de SpecialistRegisterScreen : pas de champs email/mot de
// passe (le compte existe déjà), soumet via applyAsSpecialist() qui écrit
// directement sur le uid courant sans créer de nouveau compte Firebase Auth.
export default function BecomeSpecialistScreen({ onSubmitted }) {
  const { t } = useLanguage();
  const { user, applyAsSpecialist, error, clearError } = useAuth();
  const { colors, role, semantic, spacing, radius, shadows, typography } = useTheme();
  const styles = makeStyles(colors, role, semantic, spacing, radius, shadows, typography);
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    speciality: '', institution: '', credentials: '', phone: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (f, v) => { setForm(p => ({ ...p, [f]: v })); clearError(); };

  const handleSubmit = async () => {
    const { displayName, speciality, credentials } = form;
    if (!displayName.trim() || !speciality || !credentials.trim()) {
      Alert.alert(t('error_generic'), t('fill_required_fields'));
      return;
    }
    setLoading(true);
    try {
      await applyAsSpecialist({
        displayName: displayName.trim(), speciality,
        institution: form.institution.trim(), credentials: credentials.trim(),
        phone: form.phone.trim(),
      });
      Alert.alert(t('application_submitted_title'), t('application_submitted_msg'));
      onSubmitted?.();
    } catch (e) {} finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.iconBox}>
            <Ionicons name="medkit" size={40} color={role.specialist} />
          </View>
          <Text style={styles.intro}>{t('become_specialist_intro')}</Text>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          <Text style={styles.label}>{t('full_name_required')}</Text>
          <TextInput style={styles.input} placeholder="Dr. Prénom Nom" placeholderTextColor={colors.textGray} value={form.displayName} onChangeText={v => update('displayName', v)} />

          <Text style={styles.label}>{t('speciality_required')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
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

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('submit_request_action')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors, role, semantic, spacing, radius, shadows, typography) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl + spacing.lg },
  iconBox: { alignSelf: 'center', width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md + 2, borderWidth: 2, borderColor: role.specialist, ...shadows.sm },
  intro: { color: colors.textGray, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl, paddingHorizontal: spacing.sm },
  errorBox: { backgroundColor: semantic.error + '26', borderRadius: radius.md, borderWidth: 1, borderColor: semantic.error, padding: spacing.md, marginBottom: spacing.lg },
  errorText: { color: semantic.error, fontSize: 14 },
  label: { ...typography.bodyBold, color: colors.textLight ?? colors.text, marginBottom: spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg + 2 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipsScroll: { marginBottom: spacing.lg + 2 },
  chip: { alignSelf: 'center', paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.card, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: role.specialist, borderColor: role.specialist },
  chipText: { color: colors.textGray, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { borderRadius: radius.md, backgroundColor: role.specialist, paddingVertical: spacing.lg + 2, alignItems: 'center', marginTop: spacing.sm, ...shadows.md },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
