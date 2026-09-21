import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Switch, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function CreateSurveyScreen({ navigation }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, role);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMandatory, setIsMandatory] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [requireGender, setRequireGender] = useState(true);
  const [loading, setLoading] = useState(false);

  const addOption = () => {
    if (options.length >= 8) { Alert.alert(t('max_8_options')); return; }
    setOptions([...options, '']);
  };

  const removeOption = (i) => {
    if (options.length <= 2) { Alert.alert(t('min_2_options')); return; }
    setOptions(options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i, val) => {
    const updated = [...options];
    updated[i] = val;
    setOptions(updated);
  };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert(t('error_generic'), t('enter_title_error')); return; }
    if (!question.trim()) { Alert.alert(t('error_generic'), t('enter_question_error')); return; }
    const filledOptions = options.filter(o => o.trim());
    if (filledOptions.length < 2) { Alert.alert(t('error_generic'), t('min_2_options_error')); return; }

    setLoading(true);
    try {
      await addDoc(collection(db, 'surveys'), {
        title: title.trim(),
        question: question.trim(),
        options: filledOptions,
        isMandatory,
        isPublic,
        requireGender,
        isActive: true,
        responseCount: 0,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      Alert.alert(t('survey_created_title'), isMandatory ? t('survey_created_mandatory_msg') : t('survey_created_active_msg'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert(t('error_generic'), t('create_survey_error'));
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color={role.admin} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('new_survey_title')}</Text>
          </View>

          <Text style={styles.label}>{t('survey_title_label')}</Text>
          <TextInput style={styles.input} placeholder={t('survey_title_placeholder')} placeholderTextColor={colors.textGray} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>{t('question_asked_label')}</Text>
          <TextInput style={[styles.input, styles.multiline]} placeholder={t('question_placeholder')} placeholderTextColor={colors.textGray} value={question} onChangeText={setQuestion} multiline numberOfLines={3} />

          <Text style={styles.label}>{t('response_options_label')}</Text>
          {options.map((opt, i) => (
            <View key={i} style={styles.optionRow}>
              <View style={styles.optionBullet}><Text style={styles.optionBulletText}>{String.fromCharCode(65 + i)}</Text></View>
              <TextInput
                style={styles.optionInput}
                placeholder={t('option_n', { letter: String.fromCharCode(65 + i) })}
                placeholderTextColor={colors.textGray}
                value={opt}
                onChangeText={v => updateOption(i, v)}
              />
              {options.length > 2 && (
                <TouchableOpacity onPress={() => removeOption(i)} style={styles.removeBtn}>
                  <Ionicons name="close" size={16} color={semantic.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addOptionBtn} onPress={addOption}>
            <Text style={styles.addOptionText}>{t('add_option_action')}</Text>
          </TouchableOpacity>

          {/* Paramètres */}
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>{t('settings_title')}</Text>

            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>{t('mandatory_survey_label')}</Text>
                <Text style={styles.settingDesc}>{t('mandatory_survey_desc')}</Text>
              </View>
              <Switch value={isMandatory} onValueChange={setIsMandatory} trackColor={{ true: semantic.error }} thumbColor={isMandatory ? colors.text : colors.textGray} />
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>{t('public_survey_label')}</Text>
                <Text style={styles.settingDesc}>{t('public_survey_desc')}</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: role.admin }} thumbColor={isPublic ? colors.text : colors.textGray} />
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>{t('ask_gender_label')}</Text>
                <Text style={styles.settingDesc}>{t('ask_gender_desc')}</Text>
              </View>
              <Switch value={requireGender} onValueChange={setRequireGender} trackColor={{ true: colors.secondary }} thumbColor={requireGender ? colors.text : colors.textGray} />
            </View>
          </View>

          {isMandatory && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>{t('mandatory_survey_warning')}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
            <Text style={styles.submitText}>{loading ? t('creating_ellipsis') : t('launch_survey_action')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors, spacing, radius, role) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl },
  back: { padding: spacing.sm, marginRight: spacing.sm },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  label: { color: colors.textLight, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  input: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl - 2 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm + 2, gap: spacing.sm + 2 },
  optionBullet: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  optionBulletText: { color: colors.primaryLight, fontWeight: '800', fontSize: 14 },
  optionInput: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md + 2, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  removeBtn: { padding: spacing.sm },
  addOptionBtn: { alignSelf: 'flex-start', paddingVertical: spacing.sm + 2, marginBottom: spacing.xl },
  addOptionText: { color: colors.primaryLight, fontSize: 14, fontWeight: '600' },
  settingsCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  settingsTitle: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: spacing.lg },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border + '66' },
  settingLabel: { color: colors.textLight, fontSize: 14, fontWeight: '600' },
  settingDesc: { color: colors.textGray, fontSize: 12, marginTop: 2, maxWidth: '80%' },
  warningBox: { backgroundColor: colors.error + '22', borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, padding: spacing.md + 2, marginBottom: spacing.lg },
  warningText: { color: colors.error, fontSize: 13, lineHeight: 20 },
  submitBtn: { backgroundColor: role.admin, borderRadius: radius.pill, paddingVertical: spacing.xl - 2, alignItems: 'center', marginTop: spacing.sm },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
