import React, { useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';

// Les réponses peuvent contenir soit la clé stable ('female'/'male'/'other'/'not_specified')
// soit d'anciennes valeurs françaises brutes (Femme/Homme/Autre/Non précisé) — on gère les deux.
const GENDER_GROUPS = [
  { key: 'female', match: v => v === 'female' || v === 'Femme', color: '#EC4899', labelKey: 'gender_female' },
  { key: 'male',   match: v => v === 'male'   || v === 'Homme', color: '#3B82F6', labelKey: 'gender_male' },
  { key: 'other',  match: v => v === 'other' || v === 'not_specified' || v === 'Autre/Non précisé', color: '#9CA3AF', labelKey: 'gender_other' },
];

export default function SurveyReportScreen({ route, navigation }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, role);
  const { surveyId } = route.params ?? {};
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(React.useCallback(() => { loadReport(); }, []));

  const loadReport = async () => {
    if (!surveyId) { setLoading(false); return; }
    try {
      const [surveySnap, responsesSnap] = await Promise.all([
        getDoc(doc(db, 'surveys', surveyId)),
        getDocs(query(collection(db, 'survey_responses'), where('surveyId', '==', surveyId))),
      ]);
      setSurvey({ id: surveyId, ...surveySnap.data() });
      setResponses(responsesSnap.docs.map(d => d.data()));
    } catch (e) {
      console.warn('loadReport error', e);
    } finally { setLoading(false); }
  };

  const getOptionCount = (option) => responses.filter(r => r.answer === option).length;
  const getGenderCount = (group) => responses.filter(r => group.match(r.gender)).length;
  const getOptionGenderCount = (option, group) => responses.filter(r => r.answer === option && group.match(r.gender)).length;

  const exportReport = async () => {
    if (!survey) return;
    let text = `📊 ${t('report_survey_prefix')}\n`;
    text += `================\n`;
    text += `${t('report_title_field')}: ${survey.title}\n`;
    text += `${t('report_question_field')}: ${survey.question}\n`;
    text += `${t('report_total_responses_field')}: ${responses.length}\n\n`;
    text += `${t('report_by_answer')}\n`;
    survey.options?.forEach(opt => {
      const count = getOptionCount(opt);
      const pct = responses.length > 0 ? Math.round(count / responses.length * 100) : 0;
      text += `  ${opt}: ${count} (${pct}%)\n`;
    });
    text += `\n${t('report_by_gender')}\n`;
    GENDER_GROUPS.forEach(g => {
      text += `  ${t(g.labelKey)}: ${getGenderCount(g)}\n`;
    });
    await Share.share({ message: text, title: t('report_share_title', { title: survey.title }) });
  };

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={role.admin} size="large" />
    </View>
  );

  const total = responses.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title={t('survey_report_title')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        rightIcon="share-outline"
        onRightPress={exportReport}
        insetTop={insets.top}
      />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]} showsVerticalScrollIndicator={false}>
        <Card shadow="sm" padding="lg" style={styles.surveyCard}>
          <Text style={styles.surveyTitle}>{survey?.title}</Text>
          <Text style={styles.surveyQuestion}>{survey?.question}</Text>
          <View style={styles.surveyMeta}>
            {survey?.isMandatory && <View style={styles.mandatoryTag}><Text style={styles.mandatoryText}>⚡ {t('mandatory_badge')}</Text></View>}
            <View style={styles.totalTag}><Text style={styles.totalText}>{t('total_responses', { n: total })}</Text></View>
          </View>
        </Card>

        {/* Répartition par réponse */}
        <Text style={styles.sectionTitle}>{t('results_by_answer')}</Text>
        {survey?.options?.map((opt, i) => {
          const count = getOptionCount(opt);
          const pct = total > 0 ? Math.round(count / total * 100) : 0;
          return (
            <Card key={i} shadow="sm" padding="md" style={styles.optionCard}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionLabel}>{opt}</Text>
                <Text style={styles.optionCount}>{count} ({pct}%)</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: role.admin }]} />
              </View>
              {survey.requireGender && (
                <View style={styles.genderBreakdown}>
                  {GENDER_GROUPS.map(g => {
                    const gc = getOptionGenderCount(opt, g);
                    if (gc === 0) return null;
                    return (
                      <Text key={g.key} style={[styles.genderSub, { color: g.color }]}>
                        {t(g.labelKey)}: {gc}
                      </Text>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })}

        {/* Répartition par sexe */}
        {survey?.requireGender && total > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('gender_breakdown_title')}</Text>
            <View style={styles.genderGrid}>
              {GENDER_GROUPS.map(g => {
                const count = getGenderCount(g);
                const pct = total > 0 ? Math.round(count / total * 100) : 0;
                return (
                  <View key={g.key} style={[styles.genderCard, { borderColor: g.color + '66' }]}>
                    <Text style={[styles.genderValue, { color: g.color }]}>{count}</Text>
                    <Text style={styles.genderPct}>{pct}%</Text>
                    <Text style={styles.genderLabel}>{t(g.labelKey)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {total === 0 && (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>{t('no_response_yet')}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.exportBtnFull} onPress={exportReport}>
          <Ionicons name="share-outline" size={16} color={role.admin} />
          <Text style={styles.exportBtnText}>{t('export_report_action')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors, spacing, radius, role) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg },
  surveyCard: { marginBottom: spacing.xl },
  surveyTitle: { color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: spacing.xs + 2 },
  surveyQuestion: { color: colors.textGray, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm + 2 },
  surveyMeta: { flexDirection: 'row', gap: spacing.sm + 2 },
  mandatoryTag: { backgroundColor: colors.error + '22', borderRadius: radius.sm - 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  mandatoryText: { color: colors.error, fontSize: 11, fontWeight: '700' },
  totalTag: { backgroundColor: colors.primary + '22', borderRadius: radius.sm - 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  totalText: { color: colors.primaryLight, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: spacing.md },
  optionCard: { marginBottom: spacing.sm + 2 },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  optionLabel: { color: colors.textLight, fontWeight: '600', fontSize: 14, flex: 1 },
  optionCount: { color: colors.primaryLight, fontWeight: '700', fontSize: 14 },
  barBg: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginBottom: spacing.sm },
  barFill: { height: 8, borderRadius: 4 },
  genderBreakdown: { flexDirection: 'row', gap: spacing.md },
  genderSub: { fontSize: 11, fontWeight: '600' },
  genderGrid: { flexDirection: 'row', gap: spacing.sm + 2, marginBottom: spacing.xl },
  genderCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1 },
  genderValue: { fontSize: 24, fontWeight: '800' },
  genderPct: { color: colors.textGray, fontSize: 12, marginBottom: 4 },
  genderLabel: { color: colors.textGray, fontSize: 11, textAlign: 'center' },
  noData: { alignItems: 'center', padding: spacing.xxl - 2 },
  noDataText: { color: colors.textGray, fontSize: 15 },
  exportBtnFull: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: role.admin },
  exportBtnText: { color: role.admin, fontWeight: '700', fontSize: 16 },
});
