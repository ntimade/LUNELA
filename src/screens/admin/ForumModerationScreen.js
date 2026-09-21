import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

const fmtDate = (ts, locale = 'fr-FR') => {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function ForumModerationScreen({ navigation }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, role);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId,  setBusyId]  = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, 'forum_reports'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const dismiss = async (report) => {
    setBusyId(report.id);
    try {
      await updateDoc(doc(db, 'forum_reports', report.id), { status: 'dismissed' });
    } catch (_) {
      Alert.alert(t('error_generic'), t('action_impossible'));
    } finally { setBusyId(null); }
  };

  const removeContent = (report) => {
    Alert.alert(
      t('delete_content_title'),
      report.replyId
        ? t('delete_reply_msg')
        : t('delete_discussion_msg'),
      [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('delete_action'), style: 'destructive',
          onPress: async () => {
            setBusyId(report.id);
            try {
              const contentRef = report.replyId
                ? doc(db, 'forum_posts', report.postId, 'replies', report.replyId)
                : doc(db, 'forum_posts', report.postId);
              await deleteDoc(contentRef);
              await updateDoc(doc(db, 'forum_reports', report.id), { status: 'removed' });
            } catch (_) {
              Alert.alert(t('error_generic'), t('delete_impossible'));
            } finally { setBusyId(null); }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title={t('forum_moderation_label')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        insetTop={insets.top}
      />
      {reports.length > 0 && (
        <View style={[styles.headerBadgeWrap, { top: insets.top + spacing.md + 6 }]}>
          <Badge count={reports.length} color={semantic.error} />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={role.admin} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={t('no_pending_reports')}
              text={t('forum_clean_note')}
            />
          }
          renderItem={({ item }) => (
            <Card shadow="sm" padding="md" style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.reasonBadge}>
                  <Ionicons name="flag" size={12} color={semantic.error} />
                  <Text style={styles.reasonTxt}>{item.reason}</Text>
                </View>
                <Text style={styles.cardTime}>{fmtDate(item.createdAt, lang === 'en' ? 'en-US' : 'fr-FR')}</Text>
              </View>
              <Text style={styles.contentType}>
                {item.replyId ? t('reported_reply') : t('reported_discussion')}
              </Text>
              <Text style={styles.snapshot} numberOfLines={3}>{item.contentSnapshot || t('empty_content_label')}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => dismiss(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id
                    ? <ActivityIndicator size="small" color={colors.textGray} />
                    : <Text style={styles.dismissTxt}>{t('ignore')}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeContent(item)}
                  disabled={busyId === item.id}
                >
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                  <Text style={styles.removeTxt}>{t('delete_action')}</Text>
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
  headerBadgeWrap: { position: 'absolute', top: spacing.md, right: spacing.lg, zIndex: 1 },

  card: { marginBottom: 0 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  reasonBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.error + '15', borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  reasonTxt: { fontSize: 12, fontWeight: '700', color: colors.error },
  cardTime: { fontSize: 11, color: colors.textGray },
  contentType: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm - 2 },
  snapshot: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: spacing.md + 2, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: spacing.sm + 2 },
  dismissBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md - 1, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  dismissTxt: { color: colors.textGray, fontWeight: '700', fontSize: 13 },
  removeBtn: { flex: 1, flexDirection: 'row', gap: spacing.sm - 2, borderRadius: radius.md, paddingVertical: spacing.md - 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error },
  removeTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
