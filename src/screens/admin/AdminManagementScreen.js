import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ScreenHeader from '../../components/ui/ScreenHeader';

export default function AdminManagementScreen({ navigation }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, role);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [tab, setTab] = useState('pending');

  // Listener temps réel
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admins'), (snap) => {
      setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const updateStatus = async (id, status, name) => {
    Alert.alert(t('confirm_title'), t('approve_or_reject_admin', { action: status === 'approved' ? t('approve_action') : t('reject_action'), name }), [
      { text: t('cancel_action'), style: 'cancel' },
      {
        text: t('confirm_action'),
        onPress: async () => {
          setUpdating(id);
          try {
            await updateDoc(doc(db, 'admins', id), { status, updatedAt: new Date().toISOString() });
            // onSnapshot met à jour automatiquement
          } finally { setUpdating(null); }
        }
      }
    ]);
  };

  const filtered = admins.filter(a => a.status === tab);
  const tabs = [
    { key: 'pending', label: t('pending_label'), count: admins.filter(a => a.status === 'pending').length },
    { key: 'approved', label: t('approved_label'), count: admins.filter(a => a.status === 'approved').length },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title={t('administrators_label')}
        onBack={() => navigation.goBack()}
        accentColor={role.admin}
        insetTop={insets.top}
      />

      <View style={styles.infoBanner}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.textGray} />
        <Text style={styles.infoText}>
          {t('first_admin_auto_note')}
        </Text>
      </View>

      <View style={styles.tabs}>
        {tabs.map(tabItem => (
          <TouchableOpacity key={tabItem.key} style={[styles.tab, tab === tabItem.key && styles.tabActive]} onPress={() => setTab(tabItem.key)}>
            <Text style={[styles.tabText, tab === tabItem.key && styles.tabTextActive]}>
              {tabItem.label} ({tabItem.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={role.admin} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="people-outline" text={t('no_admin_category')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          renderItem={({ item }) => (
            <Card shadow="sm" padding="lg" style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.displayName?.[0] || '?'}</Text></View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.displayName}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  {item.isFirst && <View style={styles.firstBadge}><Text style={styles.firstText}>{t('first_admin_badge')}</Text></View>}
                </View>
              </View>
              {item.id !== user?.uid && tab === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => updateStatus(item.id, 'approved', item.displayName)} disabled={updating === item.id}>
                    {updating === item.id ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Ionicons name="checkmark-circle" size={15} color="#fff" />
                        <Text style={styles.btnText}>{t('approve_action')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => updateStatus(item.id, 'rejected', item.displayName)} disabled={updating === item.id}>
                    <Ionicons name="close-circle" size={15} color="#fff" />
                    <Text style={styles.btnText}>{t('reject_action')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {item.id === user?.uid && <Text style={styles.youText}>{t('you_label')}</Text>}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (colors, spacing, radius, role) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: role.admin + '30' },
  infoText: { flex: 1, color: colors.textGray, fontSize: 12, lineHeight: 18 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: role.admin },
  tabText: { color: colors.textGray, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: role.admin },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: 0 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: role.admin, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  info: { flex: 1 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  email: { color: colors.textGray, fontSize: 12 },
  firstBadge: { backgroundColor: colors.warning + '22', borderRadius: radius.sm - 2, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  firstText: { color: colors.warning, fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm + 2 },
  btn: { flex: 1, flexDirection: 'row', gap: spacing.xs + 2, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  approveBtn: { backgroundColor: colors.success },
  rejectBtn: { backgroundColor: colors.error },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  youText: { color: role.admin, fontWeight: '600', fontSize: 13, textAlign: 'center' },
});
