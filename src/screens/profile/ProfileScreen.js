import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Modal, Image, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useQuiz, BADGES } from '../../hooks/useQuiz';
import { useNotifications } from '../../hooks/useNotifications';

const NOTIF_PREF_KEY = 'lunela_notifications_enabled';

// ─── Config par profil (clés de traduction pour label/fallback) ──────────────
const buildProfileConfig = (roleColors) => ({
  [ROLES.GIRL]: {
    color:      roleColors.girl,
    labelKey:   'profile_feminine',
    icon:       'female',
  },
  [ROLES.BOY]: {
    color:      roleColors.boy,
    labelKey:   'profile_masculine',
    icon:       'male',
  },
  [ROLES.SPECIALIST]: {
    color:      roleColors.specialist,
    labelKey:   'professional_profile',
    icon:       'medkit',
  },
});

const getConfig = (userRole, colors, roleColors) =>
  buildProfileConfig(roleColors)[userRole] ?? {
    color:    colors.primary,
    labelKey: 'my_profile_title',
    icon:     'person',
  };

// ─── Données formulaire (clés de traduction) ──────────────────────────────────
const AGE_GROUP_KEYS = ['age_under_18', 'age_18_25', 'age_26_35', 'age_36_45', 'age_over_45'];
const GIRL_GOAL_KEYS = ['goal_avoid_pregnancy', 'goal_plan_pregnancy', 'goal_sex_education', 'goal_health_tracking', 'goal_other'];
const BOY_GOAL_KEYS  = ['goal_understand_cycle', 'goal_sex_education', 'goal_support_partner', 'goal_health_tracking', 'goal_reproductive_responsibility', 'goal_other'];

// ─── Composant : section card ─────────────────────────────────────────────────
function SectionCard({ title, icon, children, styles, colors }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon && <Ionicons name={icon} size={16} color={colors.textSecondary} />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Composant : ligne d'info ─────────────────────────────────────────────────
function InfoRow({ label, value, valueColor, styles, t }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>
        {value || t('not_specified')}
      </Text>
    </View>
  );
}

// ─── Section Badges (Garçon) ──────────────────────────────────────────────────
function BadgesSection({ accentColor, styles, colors, t }) {
  const { progress, loading } = useQuiz();

  if (loading) return null;

  const earned = BADGES.filter(b => progress.earnedBadges.includes(b.id));
  const locked = BADGES.filter(b => !progress.earnedBadges.includes(b.id));

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="trophy" size={16} color={accentColor} />
        <Text style={styles.sectionTitle}>{t('my_badges')}</Text>
        <View style={[styles.badgeCountBadge, { backgroundColor: accentColor + '20' }]}>
          <Text style={[styles.badgeCountTxt, { color: accentColor }]}>
            {earned.length} / {BADGES.length}
          </Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={styles.badgeProgressTrack}>
        <View style={[
          styles.badgeProgressFill,
          { width: `${Math.round((earned.length / BADGES.length) * 100)}%`, backgroundColor: accentColor },
        ]} />
      </View>

      {/* Badges gagnés */}
      {earned.length > 0 && (
        <>
          <Text style={styles.badgeSubtitle}>{t('obtained')}</Text>
          <View style={styles.badgesGrid}>
            {earned.map(badge => (
              <View key={badge.id} style={[styles.badgeCard, { borderColor: accentColor + '40' }]}>
                <Text style={styles.badgeEmoji}>{badge.icon}</Text>
                <Text style={styles.badgeLabel}>{badge.label}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Badges verrouillés */}
      {locked.length > 0 && (
        <>
          <Text style={[styles.badgeSubtitle, { marginTop: earned.length > 0 ? 12 : 0 }]}>{t('to_unlock')}</Text>
          <View style={styles.badgesGrid}>
            {locked.map(badge => (
              <View key={badge.id} style={styles.badgeCardLocked}>
                <Text style={[styles.badgeEmoji, { opacity: 0.35 }]}>{badge.icon}</Text>
                <Text style={[styles.badgeLabel, { color: colors.textSecondary }]}>{badge.label}</Text>
                <Ionicons name="lock-closed" size={10} color={colors.textSecondary} style={{ position: 'absolute', top: 6, right: 6 }} />
              </View>
            ))}
          </View>
        </>
      )}

      {earned.length === 0 && (
        <View style={styles.noBadgeWrap}>
          <Text style={styles.noBadgeEmoji}>🎯</Text>
          <Text style={styles.noBadgeTxt}>{t('no_badge_text')}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Composant : section stats quiz (Garçon) ─────────────────────────────────
function QuizStatsSection({ accentColor, styles, colors, semantic, t }) {
  const { progress, loading } = useQuiz();
  if (loading) return null;
  return (
    <SectionCard title={t('quiz_progression')} icon="stats-chart-outline" styles={styles} colors={colors}>
      <View style={styles.statsRow}>
        {[
          { label: t('points'),       value: progress.totalPoints,  color: accentColor },
          { label: t('quizzes_done'), value: progress.totalQuizzes, color: semantic.success },
          { label: t('streak'),       value: progress.streak,       color: semantic.warning },
        ].map((s, i) => (
          <View key={i} style={styles.statBox}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLbl}>{s.label}</Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, userRole, logout, specialistStatus, specialistData } = useAuth();
  const isApprovedSpecialist = userRole === ROLES.SPECIALIST || specialistStatus === 'approved';
  const { colors, role, semantic, spacing, radius, shadows, typography, isDark, toggleTheme } = useTheme();
  const { lang, t, setLang } = useLanguage();
  const styles = makeStyles(colors, spacing, radius, shadows, typography);
  const config = getConfig(userRole, colors, role);
  const isBoy  = userRole === ROLES.BOY;

  const [profile,  setProfile]  = useState({ ageGroup: '', goals: [], notes: '' });
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState({ ...profile });
  const [loading,  setLoading]  = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);

  const { cancelAll, scheduleDailyTip } = useNotifications();

  const docRef = user ? doc(db, 'users', user.uid, 'profile', 'info') : null;

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user?.uid]);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREF_KEY).then(v => setNotifEnabled(v !== 'false'));
  }, []);

  const toggleNotifications = async (value) => {
    setNotifEnabled(value);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, value ? 'true' : 'false');
    if (value) {
      scheduleDailyTip(8).catch(() => {});
    } else {
      cancelAll().catch(() => {});
    }
  };

  const loadProfile = async () => {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setDraft(data);
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  const saveProfile = async () => {
    try {
      await setDoc(docRef, draft, { merge: true });
      setProfile(draft);
      setEditing(false);
      Alert.alert('✓', 'Profil enregistré avec succès.');
    } catch (_) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer le profil.');
    }
  };

  const toggleGoal = (goal) => {
    const current = draft.goals || [];
    setDraft(p => ({
      ...p,
      goals: current.includes(goal) ? current.filter(g => g !== goal) : [...current, goal],
    }));
  };

  const provider      = user?.providerData?.[0]?.providerId;
  const providerLabel = provider === 'google.com' ? 'Google' : provider === 'facebook.com' ? 'Facebook' : 'Email';
  const initial       = user?.displayName ? user.displayName[0].toUpperCase() : '?';
  const goalKeys       = userRole === ROLES.BOY ? BOY_GOAL_KEYS : GIRL_GOAL_KEYS;

  // Traduit une valeur stockée si c'est une clé connue ; sinon affiche le texte
  // brut tel quel (compat. avec les anciens profils enregistrés avant l'i18n).
  const trValue = (v) => v ? t(v) : v;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: config.color }]}>
          <View style={styles.heroAvatar}>
            {user?.photoURL
              ? <Image source={{ uri: user.photoURL }} style={styles.heroAvatarImg} />
              : <Text style={styles.heroAvatarTxt}>{initial}</Text>
            }
          </View>
          <Text style={styles.heroName}>{user?.displayName || t(config.labelKey)}</Text>
          <Text style={styles.heroEmail}>{user?.email}</Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Ionicons name={config.icon} size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroBadgeTxt}>{t(config.labelKey)}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroBadgeTxt}>{t('via_provider')} {providerLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── Profil santé (Fille + User legacy) ───────────────────────── */}
        {(userRole === ROLES.GIRL || userRole === ROLES.USER || !userRole) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart-outline" size={16} color={config.color} />
              <Text style={styles.sectionTitle}>{t('health_profile_title')}</Text>
              <TouchableOpacity
                onPress={() => { setDraft({ ...profile }); setEditing(true); }}
                style={[styles.editBtn, { borderColor: config.color + '40' }]}
              >
                <Ionicons name="pencil" size={13} color={config.color} />
                <Text style={[styles.editBtnTxt, { color: config.color }]}>{t('edit')}</Text>
              </TouchableOpacity>
            </View>
            <InfoRow label={t('age_group')} value={trValue(profile.ageGroup)} styles={styles} t={t} />
            <InfoRow
              label={t('goals')}
              value={profile.goals?.length > 0 ? profile.goals.map(trValue).join(', ') : null}
              styles={styles} t={t}
            />
            {profile.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>{t('personal_notes')}</Text>
                <Text style={styles.notesTxt}>{profile.notes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Profil garçon ─────────────────────────────────────────────── */}
        {userRole === ROLES.BOY && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={16} color={config.color} />
              <Text style={styles.sectionTitle}>{t('my_profile_title')}</Text>
              <TouchableOpacity
                onPress={() => { setDraft({ ...profile }); setEditing(true); }}
                style={[styles.editBtn, { borderColor: config.color + '40' }]}
              >
                <Ionicons name="pencil" size={13} color={config.color} />
                <Text style={[styles.editBtnTxt, { color: config.color }]}>{t('edit')}</Text>
              </TouchableOpacity>
            </View>
            <InfoRow label={t('age_group')} value={trValue(profile.ageGroup)} styles={styles} t={t} />
            <InfoRow
              label={t('goals')}
              value={profile.goals?.length > 0 ? profile.goals.map(trValue).join(', ') : null}
              styles={styles} t={t}
            />
            {profile.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>{t('personal_notes')}</Text>
                <Text style={styles.notesTxt}>{profile.notes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Stats & badges quiz (Fille et Garçon) ────────────────────── */}
        {(userRole === ROLES.BOY || userRole === ROLES.GIRL) && (
          <>
            <QuizStatsSection accentColor={config.color} styles={styles} colors={colors} semantic={semantic} t={t} />
            <BadgesSection accentColor={config.color} styles={styles} colors={colors} t={t} />
          </>
        )}

        {/* ── Profil spécialiste (aussi affiché pour un compte fille/garçon
             ayant une candidature spécialiste approuvée) ─────────────────── */}
        {isApprovedSpecialist && (
          <SectionCard title={t('professional_profile')} icon="medkit-outline" styles={styles} colors={colors}>
            <InfoRow label={t('specialty')} value={specialistData?.speciality} styles={styles} t={t} />
            <InfoRow label={t('status')} value={t('approved')} valueColor={semantic.success} styles={styles} t={t} />
          </SectionCard>
        )}

        {/* ── Notifications ────────────────────────────────────────────── */}
        <SectionCard title={t('notifications_section')} icon="notifications-outline" styles={styles} colors={colors}>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>{t('reminders_tips')}</Text>
              <Text style={styles.notifDesc}>{t('reminders_desc')}</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: config.color, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        </SectionCard>

        {/* ── Apparence (masqué pour le profil garçon — thème bleu fixe) ── */}
        {!isBoy && (
          <SectionCard title={t('appearance_section')} icon="moon-outline" styles={styles} colors={colors}>
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifLabel}>{t('dark_mode')}</Text>
                <Text style={styles.notifDesc}>{t('dark_mode_desc')}</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ true: config.color, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          </SectionCard>
        )}

        {/* ── Langue ───────────────────────────────────────────────────── */}
        <SectionCard title={t('language_section')} icon="language-outline" styles={styles} colors={colors}>
          <Text style={styles.notifDesc}>{t('language_desc')}</Text>
          <View style={styles.langRow}>
            {[{ code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }].map(l => (
              <TouchableOpacity
                key={l.code}
                onPress={() => setLang(l.code)}
                style={[styles.langChip, lang === l.code && { backgroundColor: config.color, borderColor: config.color }]}
              >
                <Text style={[styles.langChipTxt, lang === l.code && { color: '#fff', fontWeight: '700' }]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* ── Confidentialité ───────────────────────────────────────────── */}
        <SectionCard title={t('privacy_section')} icon="lock-closed-outline" styles={styles} colors={colors}>
          {[
            t('privacy_item1'),
            t('privacy_item2'),
            t('privacy_item3'),
            t('privacy_item4'),
          ].map((item, i) => (
            <View key={i} style={styles.privacyItem}>
              <Ionicons name="checkmark-circle" size={15} color={semantic.success} />
              <Text style={styles.privacyTxt}>{item}</Text>
            </View>
          ))}
        </SectionCard>

        {/* ── Version app ───────────────────────────────────────────────── */}
        <SectionCard title={t('about_section')} icon="information-circle-outline" styles={styles} colors={colors}>
          <InfoRow label={t('version_label')} value="1.0.0" styles={styles} t={t} />
          <InfoRow label={t('app_label')}     value="LUNELA" styles={styles} t={t} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('slogan_label')}</Text>
            <Text style={[styles.infoValue, { fontStyle: 'italic', color: config.color }]}>
              {t('app_slogan')}
            </Text>
          </View>

          {/* Crédit fondatrice */}
          <View style={[styles.creditBox, styles.creditFlat, { backgroundColor: config.color + '12' }]}>
            <Ionicons name="heart" size={16} color={config.color} />
            <View style={styles.creditTextWrap}>
              <Text style={styles.creditLabel}>{t('credit_designed_by')}</Text>
              <Text style={[styles.creditName, { color: config.color }]}>
                Marie-Louise NGO NGWANG
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* ── Déconnexion ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert(
            t('logout_confirm_title'),
            t('logout_confirm_msg'),
            [
              { text: t('cancel'), style: 'cancel' },
              { text: t('logout'), style: 'destructive', onPress: logout },
            ]
          )}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutTxt}>{t('logout')}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Modal édition ─────────────────────────────────────────────── */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{t('edit_profile_modal_title')}</Text>
                <TouchableOpacity onPress={() => setEditing(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>{t('age_group')}</Text>
              <View style={styles.chipGroup}>
                {AGE_GROUP_KEYS.map(agKey => (
                  <TouchableOpacity
                    key={agKey}
                    style={[styles.chip, draft.ageGroup === agKey && { backgroundColor: config.color, borderColor: config.color }]}
                    onPress={() => setDraft(p => ({ ...p, ageGroup: agKey }))}
                  >
                    <Text style={[styles.chipTxt, draft.ageGroup === agKey && { color: '#fff', fontWeight: '700' }]}>{t(agKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('my_goals')}</Text>
              <View style={styles.chipGroup}>
                {goalKeys.map(gKey => (
                  <TouchableOpacity
                    key={gKey}
                    style={[styles.chip, (draft.goals || []).includes(gKey) && { backgroundColor: config.color, borderColor: config.color }]}
                    onPress={() => toggleGoal(gKey)}
                  >
                    <Text style={[styles.chipTxt, (draft.goals || []).includes(gKey) && { color: '#fff', fontWeight: '700' }]}>{t(gKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('notes_optional')}</Text>
              <TextInput
                style={styles.notesInput}
                value={draft.notes}
                onChangeText={v => setDraft(p => ({ ...p, notes: v }))}
                placeholder={t('notes_placeholder')}
                placeholderTextColor={colors.textSecondary}
                multiline numberOfLines={4}
              />
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelTxt}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: config.color }]} onPress={saveProfile}>
                <Text style={styles.saveTxt}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, spacing, radius, shadows, typography) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 40 },

  // Hero
  hero:          { borderRadius: radius.xl, padding: spacing.xxl, marginBottom: spacing.lg, alignItems: 'center', ...shadows.md },
  heroAvatar:    { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  heroAvatarImg: { width: 80, height: 80, borderRadius: 40 },
  heroAvatarTxt: { fontSize: 32, fontWeight: '800', color: '#fff' },
  heroName:      { ...typography.h2, fontSize: 22, color: '#fff', marginBottom: 4 },
  heroEmail:     { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: spacing.md },
  heroBadgeRow:  { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  heroBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  heroBadgeTxt:  { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },

  // Section
  section:       { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md + 2, ...shadows.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md + 2 },
  sectionTitle:  { ...typography.bodyBold, flex: 1, fontSize: 15, color: colors.text },
  editBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  editBtnTxt:    { ...typography.caption },

  // Info rows
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 2, textAlign: 'right' },

  notesBox:   { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.sm + 2 },
  notesLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesTxt:   { fontSize: 13, color: colors.text, lineHeight: 20 },

  // Privacy
  privacyItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  privacyTxt:  { fontSize: 14, color: colors.text },

  // Notifications / Apparence
  notifRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notifLabel:{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
  notifDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  // Langue
  langRow:     { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  langChip:    { flex: 1, paddingVertical: spacing.sm + 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
  langChipTxt: { fontSize: 13, color: colors.textSecondary },

  // Stats (boy)
  statsRow: { flexDirection: 'row' },
  statBox:  { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border },
  statNum:  { fontSize: 22, fontWeight: '800' },
  statLbl:  { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Badges (boy)
  badgeCountBadge:    { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeCountTxt:      { fontSize: 12, fontWeight: '700' },
  badgeProgressTrack: { height: 6, backgroundColor: colors.background, borderRadius: 3, marginBottom: spacing.md + 2, overflow: 'hidden' },
  badgeProgressFill:  { height: 6, borderRadius: 3 },
  badgeSubtitle:      { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  badgesGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeCard:          { width: '30%', flexGrow: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1 },
  badgeCardLocked:    { width: '30%', flexGrow: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm + 2, opacity: 0.5, borderWidth: 1, borderColor: colors.border },
  badgeEmoji:         { fontSize: 24, marginBottom: 4 },
  badgeLabel:         { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center' },
  noBadgeWrap:        { alignItems: 'center', padding: spacing.lg },
  noBadgeEmoji:       { fontSize: 32, marginBottom: spacing.sm },
  noBadgeTxt:         { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  // Crédit fondatrice
  creditBox:      { marginTop: spacing.md + 2 },
  creditFlat:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, padding: spacing.md },
  creditTextWrap: { flex: 1 },
  creditLabel:    { fontSize: 11, color: colors.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  creditName:     { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, paddingVertical: spacing.lg, borderWidth: 1.5, borderColor: colors.error, marginTop: 4 },
  logoutTxt: { color: colors.error, fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, maxHeight: '92%' },
  modalHeaderRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  modalTitle:    { fontSize: 19, fontWeight: '800', color: colors.text },
  fieldLabel:    { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  chipGroup:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl - 2 },
  chip:          { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipTxt:       { fontSize: 13, color: colors.textSecondary },
  notesInput:    { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md + 2, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, minHeight: 90, textAlignVertical: 'top', marginBottom: spacing.lg },
  modalBtns:     { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn:     { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelTxt:     { color: colors.textSecondary, fontWeight: '600' },
  saveBtn:       { flex: 1, padding: spacing.md + 2, borderRadius: radius.md, alignItems: 'center' },
  saveTxt:       { color: '#fff', fontWeight: '700' },
});
