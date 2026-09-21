import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, RefreshControl, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, onSnapshot, query, where,
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DonutRing, AnimatedBarChart, HorizontalProgress } from '../../components/Charts';
import { useLanguage } from '../../context/LanguageContext';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (date, locale = 'fr-FR') =>
  date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

// ─── Stat Card animée ─────────────────────────────────────────────────────────
function StatCard({ iconName, value, label, color, loading, spacing, radius, colors }) {
  const anim = useRef(new Animated.Value(0)).current;
  const statStyles = makeStatStyles(colors, spacing, radius);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[{ flex: 1, minWidth: '30%', transform: [{ scale: anim }], opacity: anim }]}>
      <Card shadow="sm" padding="md" style={[statStyles.card, { borderColor: color + '44' }]}>
        <View style={[statStyles.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={iconName} size={20} color={color} />
        </View>
        {loading
          ? <ActivityIndicator size="small" color={color} style={{ marginVertical: 4 }} />
          : <Text style={[statStyles.value, { color }]}>{value}</Text>
        }
        <Text style={statStyles.label}>{label}</Text>
      </Card>
    </Animated.View>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({ iconName, label, sub, color, badge, onPress, styles }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <Card shadow="sm" padding="lg" style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: color + '1A' }]}>
            <Ionicons name={iconName} size={26} color={color} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>{label}</Text>
            <Text style={styles.actionSub}>{sub}</Text>
          </View>
          {badge > 0 && <Badge count={badge} color={color} style={styles.actionBadge} />}
          <View style={[styles.arrowWrap, { backgroundColor: color + '18' }]}>
            <Ionicons name="chevron-forward" size={16} color={color} />
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Indicateur temps réel ────────────────────────────────────────────────────
function LiveIndicator({ lastUpdate, styles }) {
  const { t, lang } = useLanguage();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.liveRow}>
      <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
      <Text style={styles.liveText}>
        {t('live_updated', { time: lastUpdate ? fmtTime(lastUpdate, lang === 'en' ? 'en-US' : 'fr-FR') : '—' })}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Dashboard Admin ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard({ navigation }) {
  const { t } = useLanguage();
  const { user, roleData, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows } = useTheme();
  const styles = makeStyles(colors, spacing, radius, shadows, role);

  const [stats, setStats] = useState({
    pendingSpec: 0, approvedSpec: 0, blockedSpec: 0,
    totalUsers: 0, totalGirls: 0, totalBoys: 0,
    activeSurveys: 0, totalSurveys: 0,
    pendingAdmins: 0, approvedAdmins: 0,
    pendingReports: 0,
  });
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdate,  setLastUpdate]  = useState(null);

  // ── Listeners temps réel ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [];

    // Spécialistes
    unsubs.push(onSnapshot(collection(db, 'specialists'), (snap) => {
      const specs = snap.docs.map(d => d.data());
      setStats(prev => ({
        ...prev,
        pendingSpec:  specs.filter(s => s.status === 'pending').length,
        approvedSpec: specs.filter(s => s.status === 'approved').length,
        blockedSpec:  specs.filter(s => s.status === 'blocked').length,
      }));
      setLastUpdate(new Date());
      setLoading(false);
    }));

    // Utilisateurs
    unsubs.push(onSnapshot(collection(db, 'users'), (snap) => {
      const users = snap.docs.map(d => d.data());
      setStats(prev => ({
        ...prev,
        totalUsers: snap.size,
        totalGirls: users.filter(u => u.profile === 'girl').length,
        totalBoys:  users.filter(u => u.profile === 'boy').length,
      }));
      setLastUpdate(new Date());
    }));

    // Sondages actifs
    unsubs.push(onSnapshot(
      query(collection(db, 'surveys'), where('isActive', '==', true)),
      (snap) => {
        setStats(prev => ({ ...prev, activeSurveys: snap.size }));
        setLastUpdate(new Date());
      }
    ));

    // Tous les sondages
    unsubs.push(onSnapshot(collection(db, 'surveys'), (snap) => {
      setStats(prev => ({ ...prev, totalSurveys: snap.size }));
    }));

    // Admins en attente
    unsubs.push(onSnapshot(
      query(collection(db, 'admins'), where('status', '==', 'pending')),
      (snap) => {
        setStats(prev => ({ ...prev, pendingAdmins: snap.size }));
        setLastUpdate(new Date());
      }
    ));

    // Admins approuvés
    unsubs.push(onSnapshot(
      query(collection(db, 'admins'), where('status', '==', 'approved')),
      (snap) => {
        setStats(prev => ({ ...prev, approvedAdmins: snap.size }));
      }
    ));

    // Signalements du forum en attente
    unsubs.push(onSnapshot(
      query(collection(db, 'forum_reports'), where('status', '==', 'pending')),
      (snap) => {
        setStats(prev => ({ ...prev, pendingReports: snap.size }));
        setLastUpdate(new Date());
      }
    ));

    return () => unsubs.forEach(u => u());
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Les listeners onSnapshot rechargent automatiquement
    // On simule juste un court délai visuel
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const ACTIONS = [
    {
      iconName: 'medkit',
      label:    t('specialists_label'),
      sub:      stats.pendingSpec > 0
                  ? t('pending_specialist_approval', { n: stats.pendingSpec })
                  : t('approved_count', { n: stats.approvedSpec }),
      color:    role.specialist,
      screen:   'SpecialistApproval',
      badge:    stats.pendingSpec,
    },
    {
      iconName: 'bar-chart',
      label:    t('surveys_label'),
      sub:      t('active_of_total_surveys', { active: stats.activeSurveys, total: stats.totalSurveys }),
      color:    colors.primary,
      screen:   'SurveyManager',
      badge:    0,
    },
    {
      iconName: 'shield-checkmark',
      label:    t('administrators_label'),
      sub:      stats.pendingAdmins > 0
                  ? t('pending_count', { n: stats.pendingAdmins })
                  : t('active_count', { n: stats.approvedAdmins }),
      color:    colors.warning,
      screen:   'AdminManagement',
      badge:    stats.pendingAdmins,
    },
    {
      iconName: 'heart-circle-outline',
      label:    t('contraceptives_label'),
      sub:      t('manage_contraceptive_methods'),
      color:    role.girl,
      screen:   'ContraceptivesManager',
      badge:    0,
    },
    {
      iconName: 'help-circle-outline',
      label:    t('quiz_manager_title'),
      sub:      t('manage_quiz_questions'),
      color:    colors.warning,
      screen:   'QuizManager',
      badge:    0,
    },
    {
      iconName: 'book-outline',
      label:    t('education_manager_title'),
      sub:      t('manage_education_content'),
      color:    colors.secondary,
      screen:   'EducationManager',
      badge:    0,
    },
    {
      iconName: 'flag-outline',
      label:    t('forum_moderation_label'),
      sub:      stats.pendingReports > 0
                  ? t('pending_reports_count', { n: stats.pendingReports })
                  : t('no_pending_reports'),
      color:    semantic.error,
      screen:   'ForumModeration',
      badge:    stats.pendingReports,
    },
  ];

  const totalAlerts = stats.pendingSpec + stats.pendingAdmins + stats.pendingReports;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View
          style={[styles.headerCard, { backgroundColor: role.admin, paddingTop: insets.top + spacing.xl }]}
        >
          <View style={styles.headerTop}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {(roleData?.displayName || user?.displayName || 'A')[0].toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          <Text style={styles.greeting}>{t('greeting_hello')}</Text>
          <Text style={styles.name}>{roleData?.displayName || user?.displayName || t('admin_default_name')}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#A78BFA" />
            <Text style={styles.roleText}>{t('admin_role_badge')}</Text>
          </View>
          <LiveIndicator lastUpdate={lastUpdate} styles={styles} />
        </View>

        {/* ── Alerte si éléments en attente ───────────────────────────────── */}
        {totalAlerts > 0 && (
          <View style={styles.alertBanner}>
            <Ionicons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.alertText}>
              {t('elements_pending_action', { n: totalAlerts, s: totalAlerts > 1 ? 's' : '' })}
            </Text>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{totalAlerts}</Text>
            </View>
          </View>
        )}

        {/* ── Vue d'ensemble ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('overview_title')}</Text>

        {/* Ligne 1 : utilisateurs */}
        <View style={styles.statsGroup}>
          <Text style={styles.statsGroupLabel}>{t('users_group_label')}</Text>
          <View style={styles.statsRow}>
            <StatCard iconName="people"  value={stats.totalUsers}  label={t('total_label')}  color={colors.primary} loading={loading} spacing={spacing} radius={radius} colors={colors} />
            <StatCard iconName="female"  value={stats.totalGirls}  label={t('women_label')}  color={role.girl}      loading={loading} spacing={spacing} radius={radius} colors={colors} />
            <StatCard iconName="male"    value={stats.totalBoys}   label={t('men_label')}    color={role.boy}       loading={loading} spacing={spacing} radius={radius} colors={colors} />
          </View>
        </View>

        {/* Ligne 2 : spécialistes */}
        <View style={styles.statsGroup}>
          <Text style={styles.statsGroupLabel}>{t('specialists_group_label')}</Text>
          <View style={styles.statsRow}>
            <StatCard iconName="checkmark-circle" value={stats.approvedSpec} label={t('approved_label')} color={role.specialist} loading={loading} spacing={spacing} radius={radius} colors={colors} />
            <StatCard iconName="time-outline"      value={stats.pendingSpec}  label={t('pending_label')}  color={colors.warning}  loading={loading} spacing={spacing} radius={radius} colors={colors} />
            <StatCard iconName="ban"               value={stats.blockedSpec}  label={t('blocked_label')}  color={colors.error}    loading={loading} spacing={spacing} radius={radius} colors={colors} />
          </View>
        </View>

        {/* Ligne 3 : sondages & admins */}
        <View style={styles.statsGroup}>
          <Text style={styles.statsGroupLabel}>{t('platform_group_label')}</Text>
          <View style={styles.statsRow}>
            <StatCard iconName="bar-chart"        value={stats.activeSurveys} label={t('active_surveys_label')} color={colors.secondary} loading={loading} spacing={spacing} radius={radius} colors={colors} />
            <StatCard iconName="documents-outline" value={stats.totalSurveys}  label={t('total_surveys_label')}  color={colors.secondary} loading={loading} spacing={spacing} radius={radius} colors={colors} />
            <StatCard iconName="shield-checkmark" value={stats.pendingAdmins}  label={t('admins_pending_label')}  color={colors.warning}   loading={loading} spacing={spacing} radius={radius} colors={colors} />
          </View>
        </View>

        {/* ── Analytiques ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('analytics_title')}</Text>

        {/* Répartition utilisateurs — Donut */}
        <Card shadow="sm" padding="lg" style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <Ionicons name="pie-chart-outline" size={16} color={colors.primary} />
            <Text style={styles.chartCardTitle}>{t('users_distribution')}</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <DonutRing
              size={110}
              thickness={18}
              centerTitle={stats.totalUsers}
              centerSub={t('total_word')}
              segments={[
                { value: stats.totalGirls, color: role.girl, label: t('women_label') },
                { value: stats.totalBoys,  color: role.boy,  label: t('men_label') },
                ...(stats.totalUsers - stats.totalGirls - stats.totalBoys > 0
                  ? [{ value: stats.totalUsers - stats.totalGirls - stats.totalBoys, color: colors.textGray, label: t('others_label') }]
                  : []),
              ]}
            />
          )}
        </Card>

        {/* Statut spécialistes — Barres */}
        <Card shadow="sm" padding="lg" style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <Ionicons name="bar-chart-outline" size={16} color={role.specialist} />
            <Text style={styles.chartCardTitle}>{t('specialists_status')}</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={role.specialist} style={{ marginVertical: 20 }} />
          ) : (
            <AnimatedBarChart
              height={130}
              data={[
                { label: t('approved_label'),  value: stats.approvedSpec, color: role.specialist },
                { label: t('pending_label'), value: stats.pendingSpec,  color: colors.warning },
                { label: t('blocked_label'),    value: stats.blockedSpec,  color: colors.error },
              ]}
            />
          )}
        </Card>

        {/* Progression sondages — Barres horizontales */}
        <Card shadow="sm" padding="lg" style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <Ionicons name="stats-chart-outline" size={16} color={colors.secondary} />
            <Text style={styles.chartCardTitle}>{t('platform_label')}</Text>
          </View>
          <HorizontalProgress
            label={t('active_surveys_label')}
            icon="📊"
            value={stats.activeSurveys}
            total={Math.max(stats.totalSurveys, 1)}
            color={colors.secondary}
          />
          <HorizontalProgress
            label={t('active_admins_label')}
            icon="🛡️"
            value={stats.approvedAdmins}
            total={Math.max(stats.approvedAdmins + stats.pendingAdmins, 1)}
            color={colors.warning}
          />
          <HorizontalProgress
            label={t('approved_specialists_label')}
            icon="🩺"
            value={stats.approvedSpec}
            total={Math.max(stats.approvedSpec + stats.pendingSpec + stats.blockedSpec, 1)}
            color={role.specialist}
          />
        </Card>

        {/* ── Gestion ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('management_title')}</Text>
        {ACTIONS.map((a) => (
          <ActionCard
            key={a.screen}
            iconName={a.iconName}
            label={a.label}
            sub={a.sub}
            color={a.color}
            badge={a.badge}
            onPress={() => navigation.navigate(a.screen)}
            styles={styles}
          />
        ))}

        {/* ── Bouton créer sondage ────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateSurvey')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.createBtnText}>{t('create_new_survey')}</Text>
        </TouchableOpacity>

        {/* ── Rapports ────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={() => navigation.navigate('SurveyManager')}
          activeOpacity={0.85}
        >
          <Ionicons name="stats-chart-outline" size={18} color={role.admin} />
          <Text style={styles.reportBtnText}>{t('view_survey_reports')}</Text>
          <Ionicons name="chevron-forward" size={16} color={role.admin} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStatStyles = (colors, spacing, radius) => StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  value: { fontSize: 22, fontWeight: '800' },
  label: { color: colors.textGray, fontSize: 10, textAlign: 'center', marginTop: 3 },
});

const makeStyles = (colors, spacing, radius, shadows, role) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  scroll:       { paddingHorizontal: spacing.lg },

  // Header
  headerCard:   {
    borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg, paddingHorizontal: spacing.xl,
  },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  avatarWrap:   {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(139,92,246,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(139,92,246,0.5)',
  },
  avatarText:   { color: '#fff', fontSize: 22, fontWeight: '800' },
  logoutBtn:    { padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md },
  greeting:     { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 2 },
  name:         { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: spacing.sm + 2 },
  roleBadge:    {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: spacing.sm + 2,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)',
  },
  roleText:     { color: '#A78BFA', fontSize: 12, fontWeight: '700' },

  // Live indicator
  liveRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  liveDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4ADE80' },
  liveText:     { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  // Alert banner
  alertBanner:  {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2,
    backgroundColor: colors.error, borderRadius: radius.lg,
    padding: spacing.md + 2, marginBottom: spacing.xl,
  },
  alertText:    { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  alertBadge:   { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  alertBadgeText:{ color: '#fff', fontWeight: '800', fontSize: 13 },

  // Sections
  sectionTitle:  { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.md, marginTop: 4 },
  statsGroup:    { marginBottom: spacing.lg },
  statsGroupLabel:{ color: colors.textGray, fontSize: 12, fontWeight: '600', marginBottom: spacing.sm },
  statsRow:      { flexDirection: 'row', gap: spacing.sm + 2 },

  // Action cards
  actionCard:    {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 0,
  },
  actionIcon:    { width: 52, height: 52, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md + 2 },
  actionInfo:    { flex: 1 },
  actionLabel:   { color: colors.text, fontWeight: '700', fontSize: 16 },
  actionSub:     { color: colors.textGray, fontSize: 12, marginTop: 3 },
  actionBadge:   { marginRight: spacing.sm + 2 },
  arrowWrap:     { width: 32, height: 32, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },

  // Boutons
  createBtn:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: role.admin, borderRadius: radius.pill,
    paddingVertical: spacing.xl - 2,
    marginTop: spacing.sm, marginBottom: spacing.sm + 2, ...shadows.lg,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  reportBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: role.admin + '30',
    marginBottom: spacing.sm,
  },
  reportBtnText: { flex: 1, color: role.admin, fontWeight: '700', fontSize: 14 },

  // Chart cards
  chartCard: {
    marginBottom: spacing.md + 2,
  },
  chartCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  chartCardTitle:  { fontSize: 14, fontWeight: '700', color: colors.text },
});
