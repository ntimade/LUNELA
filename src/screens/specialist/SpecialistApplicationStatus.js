import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Statut de candidature spécialiste, intégré (pas d'écran plein/bloquant) ──
// Contrairement à PendingApprovalScreen (utilisé pour les comptes spécialiste
// purs), ce composant s'affiche DANS le menu habituel fille/garçon — le
// compte garde un accès complet au reste de l'app pendant l'attente
// d'approbation, pas de bouton déconnexion (déjà dans le menu latéral).
export default function SpecialistApplicationStatus() {
  const { t } = useLanguage();
  const { specialistData, specialistStatus, refreshUser } = useAuth();
  const { colors, semantic, spacing, radius, shadows, typography } = useTheme();
  const styles = makeStyles(colors, semantic, spacing, radius, shadows, typography);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.iconBox}>
        <Ionicons name="time-outline" size={40} color={semantic.warning} />
      </View>
      <Text style={styles.title}>{t('specialist_application_pending_title')}</Text>
      <Text style={styles.subtitle}>{t('specialist_application_pending_sub')}</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRowWrap}>
          <Ionicons name="person-outline" size={16} color={colors.textGray} />
          <Text style={styles.infoRow}><Text style={styles.infoVal}>{specialistData?.displayName}</Text></Text>
        </View>
        <View style={styles.infoRowWrap}>
          <Ionicons name="business-outline" size={16} color={colors.textGray} />
          <Text style={styles.infoRow}><Text style={styles.infoVal}>{specialistData?.speciality}</Text></Text>
        </View>
        <View style={styles.infoRowWrap}>
          <Ionicons name="bar-chart" size={16} color={colors.textGray} />
          <Text style={styles.infoRow}>
            {t('status_label')}{' '}
            <Text style={[styles.infoVal, { color: semantic.warning }]}>{t('pending_status')}</Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.refreshBtn} onPress={refreshUser} activeOpacity={0.85}>
        <Ionicons name="refresh" size={20} color="#fff" />
        <Text style={styles.refreshText}>{t('check_status_action')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors, semantic, spacing, radius, shadows, typography) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  iconBox: { width: 84, height: 84, borderRadius: radius.pill, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl, borderWidth: 2, borderColor: semantic.warning, ...shadows.sm },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm + 2, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textGray, textAlign: 'center', lineHeight: 21, marginBottom: spacing.xxl },
  infoCard: { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm + 2, marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  infoRowWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoRow: { color: colors.textGray, fontSize: 14 },
  infoVal: { color: colors.textLight ?? colors.text, fontWeight: '600' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, width: '100%', backgroundColor: semantic.warning, borderRadius: radius.md, paddingVertical: spacing.lg, ...shadows.md },
  refreshText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
