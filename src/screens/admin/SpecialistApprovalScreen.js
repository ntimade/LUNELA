import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, StatusBar, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, updateDoc, getDocsFromServer } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

const STATUS_TABS = ['pending', 'approved', 'blocked'];
const STATUS_LABEL_KEYS = { pending: 'pending_label', approved: 'approved_label', blocked: 'blocked_label' };
const STATUS_ICONS  = { pending: 'time-outline', approved: 'checkmark-circle', blocked: 'ban' };

export default function SpecialistApprovalScreen({ navigation }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, role);
  const STATUS_COLORS = { pending: semantic.warning, approved: semantic.success, blocked: semantic.error };
  const [specialists, setSpecialists] = useState([]);
  const [tab,         setTab]         = useState('pending');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [updating,    setUpdating]    = useState(null);

  // ── Charge forcée depuis le serveur (pull-to-refresh) ─────────────────────
  const forceRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const snap = await getDocsFromServer(collection(db, 'specialists'));
      setSpecialists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError(t('load_error_prefix', { error: e.message }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Listener temps réel ───────────────────────────────────────────────────
  useEffect(() => {
    setError(null);
    const unsub = onSnapshot(
      collection(db, 'specialists'),
      (snap) => {
        setSpecialists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        // Afficher l'erreur réelle plutôt que de l'ignorer
        setError(t('specialists_load_error', { error: err.message }));
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const updateStatus = async (id, status, name) => {
    const labels = { approved: t('action_approve'), blocked: t('action_block'), pending: t('action_reset_pending') };
    Alert.alert(
      `${status === 'blocked' ? '🚫' : '✅'} ${t('confirm_title')}`,
      t('confirm_action_person', { action: labels[status], name }),
      [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('confirm_action'),
          style: status === 'blocked' ? 'destructive' : 'default',
          onPress: async () => {
            setUpdating(id);
            try {
              await updateDoc(doc(db, 'specialists', id), { status, updatedAt: new Date().toISOString() });
              // onSnapshot met à jour automatiquement
              Alert.alert(t('success_title'), t('status_updated', { status: t(STATUS_LABEL_KEYS[status]) }));
            } catch (e) {
              Alert.alert(t('error_generic'), t('update_failed', { error: e.message }));
            } finally { setUpdating(null); }
          }
        }
      ]
    );
  };

  const filtered = specialists.filter(s => s.status === tab);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScreenHeader
        title={t('specialist_management_title')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        insetTop={insets.top}
      />
      <View style={[styles.liveWrap, { top: insets.top + spacing.md + 6 }]}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>

      {/* Onglets */}
      <View style={styles.tabs}>
        {STATUS_TABS.map(statusTab => (
          <TouchableOpacity key={statusTab} style={[styles.tab, tab === statusTab && { borderBottomColor: STATUS_COLORS[statusTab], borderBottomWidth: 2 }]} onPress={() => setTab(statusTab)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={STATUS_ICONS[statusTab]} size={14} color={tab === statusTab ? STATUS_COLORS[statusTab] : colors.textGray} />
              <Text style={[styles.tabText, { color: tab === statusTab ? STATUS_COLORS[statusTab] : colors.textGray }]}>
                {t(STATUS_LABEL_KEYS[statusTab])} ({specialists.filter(s => s.status === statusTab).length})
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={role.admin} size="large" style={{ marginTop: 60 }} />
      ) : error ? (
        <ScrollView
          contentContainerStyle={styles.errorWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={forceRefresh} tintColor={role.admin} />}
        >
          <Ionicons name="cloud-offline-outline" size={52} color={semantic.error} />
          <Text style={styles.errorTitle}>{t('loading_impossible')}</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={forceRefresh}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryTxt}>{t('retry_action')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={forceRefresh} tintColor={role.admin} />}
        >
          <EmptyState icon="people-outline" title={t('no_specialists_category')} text={t('pull_to_refresh_hint')} />
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={forceRefresh} tintColor={role.admin} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          renderItem={({ item }) => (
            <Card shadow="sm" padding="lg" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.displayName?.[0] || '?'}</Text></View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{item.displayName}</Text>
                  <Text style={styles.cardSpec}>{item.speciality}</Text>
                  <Text style={styles.cardEmail}>{item.email}</Text>
                </View>
              </View>
              {item.institution ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="business-outline" size={14} color={colors.textGray} />
                  <Text style={styles.detail}>{item.institution}</Text>
                </View>
              ) : null}
              {item.credentials ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="document-text-outline" size={14} color={colors.textGray} />
                  <Text style={styles.detail}>{item.credentials}</Text>
                </View>
              ) : null}
              {item.phone ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="call-outline" size={14} color={colors.textGray} />
                  <Text style={styles.detail}>{item.phone}</Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                {tab === 'pending' && (
                  <>
                    <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => updateStatus(item.id, 'approved', item.displayName)} disabled={updating === item.id}>
                      {updating === item.id ? <ActivityIndicator size="small" color="#fff" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                          <Text style={styles.btnText}>{t('approve_action')}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.blockBtn]} onPress={() => updateStatus(item.id, 'blocked', item.displayName)} disabled={updating === item.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="ban" size={16} color="#fff" />
                        <Text style={styles.btnText}>{t('reject_action')}</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {tab === 'approved' && (
                  <TouchableOpacity style={[styles.btn, styles.blockBtn]} onPress={() => updateStatus(item.id, 'blocked', item.displayName)} disabled={updating === item.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="ban" size={16} color="#fff" />
                      <Text style={styles.btnText}>{t('block_action')}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {tab === 'blocked' && (
                  <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => updateStatus(item.id, 'approved', item.displayName)} disabled={updating === item.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.btnText}>{t('unblock_action')}</Text>
                    </View>
                  </TouchableOpacity>
                )}
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
  liveWrap: { position: 'absolute', right: spacing.lg, zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success + '22', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 10, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '600' },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm + 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: role.admin, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  cardInfo: { flex: 1 },
  cardName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  cardSpec: { color: colors.primaryLight, fontSize: 13, fontWeight: '600' },
  cardEmail: { color: colors.textGray, fontSize: 12 },
  detail: { color: colors.textGray, fontSize: 13, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.md },
  btn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  approveBtn: { backgroundColor: colors.success },
  blockBtn: { backgroundColor: colors.error },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  errorWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl - 4, gap: spacing.md },
  errorTitle: { color: colors.error, fontSize: 17, fontWeight: '700' },
  errorMsg:   { color: colors.textGray, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: role.admin, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, marginTop: spacing.sm },
  retryTxt:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});
