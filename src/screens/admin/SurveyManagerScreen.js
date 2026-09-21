import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, getCountFromServer } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';

export default function SurveyManagerScreen({ navigation }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, role);
  const [surveys, setSurveys] = useState([]);
  const [responseCounts, setResponseCounts] = useState({});
  const [loading, setLoading] = useState(true);

  // Listener temps réel
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'surveys'), async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSurveys(list);
      setLoading(false);
      // Charge le vrai nombre de réponses pour chaque sondage
      const counts = {};
      await Promise.all(list.map(async (s) => {
        try {
          const snap2 = await getCountFromServer(query(collection(db, 'survey_responses'), where('surveyId', '==', s.id)));
          counts[s.id] = snap2.data().count;
        } catch { counts[s.id] = 0; }
      }));
      setResponseCounts(counts);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // onSnapshot gère les mises à jour automatiquement après chaque mutation Firestore
  const toggleActive = async (survey) => {
    await updateDoc(doc(db, 'surveys', survey.id), { isActive: !survey.isActive });
  };

  const toggleMandatory = async (survey) => {
    const msg = survey.isMandatory
      ? t('disable_mandatory_confirm')
      : t('make_mandatory_confirm');
    Alert.alert(t('confirm_title'), msg, [
      { text: t('cancel_action'), style: 'cancel' },
      { text: t('confirm_action'), onPress: async () => {
        await updateDoc(doc(db, 'surveys', survey.id), { isMandatory: !survey.isMandatory });
      }},
    ]);
  };

  const deleteSurvey = (survey) => {
    Alert.alert(t('delete_action'), t('delete_survey_confirm', { title: survey.title }), [
      { text: t('cancel_action'), style: 'cancel' },
      { text: t('delete_action'), style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'surveys', survey.id));
        // onSnapshot retire automatiquement l'entrée supprimée
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title={t('surveys_label')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        rightIcon="add"
        onRightPress={() => navigation.navigate('CreateSurvey')}
        insetTop={insets.top}
      />

      {surveys.length === 0 && !loading ? (
        <View style={styles.empty}>
          <EmptyState icon="bar-chart" title={t('no_survey_created')} />
          <Button
            title={t('create_first_survey')}
            onPress={() => navigation.navigate('CreateSurvey')}
            accentColor={role.admin}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : (
        <FlatList
          data={surveys}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          renderItem={({ item }) => (
            <Card shadow="sm" padding="lg" style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardMeta}>
                  {item.isMandatory && (
                    <View style={styles.mandatoryTag}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="flash" size={10} color={semantic.error} />
                        <Text style={styles.mandatoryText}>{t('mandatory_badge')}</Text>
                      </View>
                    </View>
                  )}
                  {!item.isActive && <View style={styles.closedTag}><Text style={styles.closedText}>{t('closed_badge')}</Text></View>}
                </View>
                <TouchableOpacity onPress={() => deleteSurvey(item)}>
                  <Ionicons name="trash-outline" size={20} color={semantic.error} />
                </TouchableOpacity>
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardQuestion} numberOfLines={2}>{item.question}</Text>

              <View style={styles.cardStats}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="bar-chart" size={12} color={role.admin} />
                  <Text style={styles.statItem}>{t('options_count', { n: item.options?.length || 0 })}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="people-outline" size={12} color={colors.textGray} />
                  <Text style={styles.statItem}>{t('responses_count', { n: responseCounts[item.id] ?? item.responseCount ?? 0 })}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name={item.isPublic ? 'globe-outline' : 'lock-closed-outline'} size={12} color={colors.textGray} />
                  <Text style={styles.statItem}>{item.isPublic ? t('public_label') : t('private_label')}</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.toggle, { backgroundColor: item.isActive ? semantic.success + '22' : colors.border + '66' }]} onPress={() => toggleActive(item)}>
                  <Text style={[styles.toggleText, { color: item.isActive ? semantic.success : colors.textGray }]}>
                    {item.isActive ? t('active_toggle') : t('inactive_toggle')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggle, { backgroundColor: item.isMandatory ? semantic.error + '22' : colors.border + '66' }]} onPress={() => toggleMandatory(item)}>
                  <Text style={[styles.toggleText, { color: item.isMandatory ? semantic.error : colors.textGray }]}>
                    {item.isMandatory
                      ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="flash" size={12} color={item.isMandatory ? semantic.error : colors.textGray} /><Text style={[styles.toggleText, { color: item.isMandatory ? semantic.error : colors.textGray }]}>{t('mandatory_toggle')}</Text></View>
                      : <Text style={[styles.toggleText, { color: colors.textGray }]}>{t('optional_toggle')}</Text>
                    }
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('SurveyReport', { surveyId: item.id })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="trending-up" size={14} color={role.admin} />
                    <Text style={styles.reportText}>{t('report_label')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (colors, spacing, radius, role) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: 0 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardMeta: { flexDirection: 'row', gap: spacing.sm },
  mandatoryTag: { backgroundColor: colors.error + '22', borderRadius: radius.sm - 2, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  mandatoryText: { color: colors.error, fontSize: 10, fontWeight: '800' },
  closedTag: { backgroundColor: colors.border, borderRadius: radius.sm - 2, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  closedText: { color: colors.textGray, fontSize: 10, fontWeight: '800' },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  cardQuestion: { color: colors.textGray, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm + 2 },
  cardStats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statItem: { color: colors.textGray, fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  toggle: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm - 2, borderRadius: radius.sm - 2 },
  toggleText: { fontSize: 12, fontWeight: '600' },
  reportBtn: { backgroundColor: role.admin + '22', paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm - 2, borderRadius: radius.sm - 2 },
  reportText: { color: role.admin, fontSize: 12, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: spacing.xxl },
});
