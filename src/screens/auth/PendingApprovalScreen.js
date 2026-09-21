import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function PendingApprovalScreen() {
  const { t } = useLanguage();
  const { userRole, roleData, logout, refreshUser } = useAuth();
  const { colors, role, spacing, radius, shadows } = useTheme();
  const isAdmin = userRole === ROLES.ADMIN_PENDING;
  const accent = isAdmin ? role.admin : role.specialist;
  const styles = makeStyles(colors, accent, spacing, radius, shadows);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.iconBox}>
        {isAdmin
          ? <Ionicons name="shield-checkmark" size={44} color={role.admin} />
          : <Ionicons name="medkit" size={44} color={role.specialist} />
        }
      </View>
      <Text style={styles.title}>{t('pending_request_title')}</Text>
      <Text style={styles.subtitle}>
        {isAdmin
          ? t('pending_admin_sub')
          : t('pending_specialist_sub')}
      </Text>

      <View style={styles.infoCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="mail" size={16} color={colors.textGray} />
          <Text style={styles.infoRow}><Text style={styles.infoVal}>{roleData?.email}</Text></Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="person-outline" size={16} color={colors.textGray} />
          <Text style={styles.infoRow}><Text style={styles.infoVal}>{roleData?.displayName}</Text></Text>
        </View>
        {!isAdmin && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="business-outline" size={16} color={colors.textGray} />
            <Text style={styles.infoRow}><Text style={styles.infoVal}>{roleData?.speciality}</Text></Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="bar-chart" size={16} color={colors.textGray} />
          <Text style={styles.infoRow}>{t('status_label')} <Text style={[styles.infoVal, { color: colors.warning }]}>{t('pending_status')}</Text></Text>
        </View>
      </View>

      <TouchableOpacity style={styles.refreshBtn} onPress={refreshUser} activeOpacity={0.85}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshText}>{t('check_status_action')}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>{t('logout_action')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors, accent, spacing, radius, shadows) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  iconBox: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl, borderWidth: 2, borderColor: accent, ...shadows.sm },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textGray, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xxl },
  infoCard: { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md - 2, marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  infoRow: { color: colors.textGray, fontSize: 14 },
  infoVal: { color: colors.textLight, fontWeight: '600' },
  refreshBtn: { width: '100%', backgroundColor: accent, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  refreshText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logoutBtn: { paddingVertical: spacing.md },
  logoutText: { color: colors.error, fontSize: 14 },
});
