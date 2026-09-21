import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const GENDER_KEYS = [
  { key: 'female', labelKey: 'gender_female' },
  { key: 'male',   labelKey: 'gender_male' },
  { key: 'other',  labelKey: 'gender_other' },
];

export default function SurveyGate({ children }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const [pendingSurvey, setPendingSurvey] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (user) checkPendingSurveys();
  }, [user]);

  const checkPendingSurveys = async () => {
    try {
      // Récupérer tous les sondages actifs et obligatoires
      const surveysSnap = await getDocs(
        query(collection(db, 'surveys'), where('isActive', '==', true))
      );
      const mandatories = surveysSnap.docs.filter(d => d.data().isMandatory);

      // Vérifier lesquels n'ont pas encore été répondus (via survey_responses)
      for (const surveyDoc of mandatories) {
        const surveyId = surveyDoc.id;
        const existingResp = await getDocs(
          query(
            collection(db, 'survey_responses'),
            where('surveyId', '==', surveyId),
            where('userId',   '==', user.uid)
          )
        );
        if (existingResp.empty) {
          setPendingSurvey({ id: surveyId, ...surveyDoc.data() });
          break;
        }
      }
    } catch (_) {
      // Règles refusées ou Firestore indisponible : on laisse passer sans bloquer
    } finally {
      setChecking(false);
    }
  };

  const submitResponse = async () => {
    if (!selectedAnswer) { Alert.alert(t('mandatory_label'), t('select_answer_required')); return; }
    if (pendingSurvey.requireGender && !selectedGender) { Alert.alert(t('mandatory_label'), t('select_gender_required')); return; }
    setSubmitting(true);
    try {
      // Écriture dans survey_responses (collection racine — couverte par les règles Firestore)
      await addDoc(collection(db, 'survey_responses'), {
        surveyId:  pendingSurvey.id,
        answer:    selectedAnswer,
        gender:    selectedGender || 'not_specified',
        userId:    user.uid,
        timestamp: Date.now(),
      });
      setPendingSurvey(null);
      setSelectedAnswer(null);
      setSelectedGender(null);
      // Vérifier s'il reste d'autres sondages obligatoires
      checkPendingSurveys();
    } catch (_) {
      Alert.alert(t('error_generic'), t('save_response_error'));
    } finally { setSubmitting(false); }
  };

  if (checking) return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  return (
    <>
      {children}
      <Modal visible={!!pendingSurvey} transparent={false} animationType="slide" statusBarTranslucent>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.topBadge}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="flash" size={12} color={colors.error} />
                <Text style={styles.topBadgeText}>{t('mandatory_survey_badge')}</Text>
              </View>
            </View>

            <Text style={styles.title}>{pendingSurvey?.title}</Text>
            <Text style={styles.subtitle}>{t('survey_intro_text')}</Text>
            <Text style={styles.question}>{pendingSurvey?.question}</Text>

            <Text style={styles.sectionLabel}>{t('your_answer_label')}</Text>
            {pendingSurvey?.options?.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.optionBtn, selectedAnswer === opt && styles.optionBtnSelected]}
                onPress={() => setSelectedAnswer(opt)}
              >
                <View style={[styles.optionCircle, selectedAnswer === opt && styles.optionCircleSelected]}>
                  {selectedAnswer === opt && <View style={styles.optionDot} />}
                </View>
                <Text style={[styles.optionText, selectedAnswer === opt && styles.optionTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            ))}

            {pendingSurvey?.requireGender && (
              <>
                <Text style={styles.sectionLabel}>{t('your_gender_label')}</Text>
                <View style={styles.genderRow}>
                  {GENDER_KEYS.map(g => (
                    <TouchableOpacity
                      key={g.key}
                      style={[styles.genderBtn, selectedGender === g.key && styles.genderBtnSelected]}
                      onPress={() => setSelectedGender(g.key)}
                    >
                      <Text style={[styles.genderText, selectedGender === g.key && styles.genderTextSelected]}>{t(g.labelKey)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={submitResponse} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color={colors.text} />
                : <Text style={styles.submitText}>{t('submit_answer')}</Text>
              }
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textGray} />
              <Text style={styles.note}>{t('survey_anon_note')}</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  topBadge: { alignSelf: 'center', backgroundColor: colors.error + '22', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20, borderWidth: 1, borderColor: colors.error },
  topBadgeText: { color: colors.error, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { color: colors.textGray, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  question: { color: colors.textLight, fontSize: 18, fontWeight: '700', lineHeight: 26, marginBottom: 20, textAlign: 'center' },
  sectionLabel: { color: colors.textGray, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: colors.border, gap: 12 },
  optionBtnSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '11' },
  optionCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  optionCircleSelected: { borderColor: colors.primary },
  optionDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  optionText: { color: colors.textLight, fontSize: 15, flex: 1 },
  optionTextSelected: { color: colors.text, fontWeight: '600' },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  genderBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  genderBtnSelected: { backgroundColor: colors.secondary + '22', borderColor: colors.secondary },
  genderText: { color: colors.textGray, fontSize: 14 },
  genderTextSelected: { color: colors.secondary, fontWeight: '700' },
  submitBtn: { borderRadius: radius.pill, paddingVertical: 18, alignItems: 'center', backgroundColor: colors.primary, marginBottom: 16 },
  submitText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  note: { color: colors.textGray, fontSize: 12, textAlign: 'center' },
});
