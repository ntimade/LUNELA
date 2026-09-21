import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, setDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db as firestore } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import EmptyState from '../../components/ui/EmptyState';

// ─── Génère un code d'invitation unique (6 caractères alphanumériques) ────────
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0,O,1,I pour éviter confusion
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const buildStatusIcons = (colors, role, semantic) => ({
  pending: { icon: 'time-outline', color: semantic.warning },
  active:  { icon: 'checkmark-circle-outline', color: semantic.success },
  revoked: { icon: 'close-circle-outline', color: colors.textGray },
});

const fmtDate = (ts, locale) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Carte d'un lien partenaire ────────────────────────────────────────────────
function PartnerLinkCard({ link, onRevoke, revoking, colors, role, semantic, radius, spacing }) {
  const { t, lang } = useLanguage();
  const card = makeCardStyles(colors, role, radius, spacing);
  const STATUS_ICONS = buildStatusIcons(colors, role, semantic);
  const s = STATUS_ICONS[link.status] ?? STATUS_ICONS.pending;
  const statusLabel = t(`status_${link.status ?? 'pending'}`);
  return (
    <View style={card.container}>
      <View style={card.row}>
        {/* Code */}
        <View style={card.codeBox}>
          <Text style={card.codeLabel}>{t('code_label')}</Text>
          <Text style={card.code}>{link.inviteCode}</Text>
        </View>

        {/* Statut */}
        <View style={[card.statusBadge, { backgroundColor: s.color + '18', borderColor: s.color + '40' }]}>
          <Ionicons name={s.icon} size={13} color={s.color} />
          <Text style={[card.statusText, { color: s.color }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={card.date}>{t('created_on', { date: fmtDate(link.createdAt, lang === 'en' ? 'en-US' : 'fr-FR') })}</Text>

      {link.status === 'active' && link.boyDisplayName && (
        <View style={card.partnerRow}>
          <Ionicons name="person-circle-outline" size={16} color={role.boy} />
          <Text style={card.partnerName}>{t('partner_label', { name: link.boyDisplayName })}</Text>
        </View>
      )}

      {/* Actions */}
      {link.status !== 'revoked' && (
        <View style={card.actions}>
          {link.status === 'pending' && (
            <TouchableOpacity
              style={card.shareBtn}
              onPress={() =>
                Share.share({
                  message: t('share_join_message', { code: link.inviteCode }),
                  title: t('share_join_title'),
                })
              }
              activeOpacity={0.8}
            >
              <Ionicons name="share-social-outline" size={15} color={colors.primary} />
              <Text style={card.shareBtnText}>{t('share_code_action')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={card.revokeBtn}
            onPress={() => onRevoke(link)}
            disabled={revoking === link.id}
            activeOpacity={0.8}
          >
            {revoking === link.id
              ? <ActivityIndicator size="small" color={colors.error} />
              : <>
                  <Ionicons name="close-circle-outline" size={15} color={colors.error} />
                  <Text style={card.revokeBtnText}>{t('revoke_action')}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeCardStyles = (colors, role, radius, spacing) => StyleSheet.create({
  container: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
    elevation: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  codeBox:     { gap: 2 },
  codeLabel:   { fontSize: 10, color: colors.textGray, textTransform: 'uppercase', letterSpacing: 1 },
  code:        { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  statusText:  { fontSize: 12, fontWeight: '700' },
  date:        { fontSize: 12, color: colors.textGray, marginBottom: 6 },
  partnerRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  partnerName: { fontSize: 13, color: role.boy, fontWeight: '600' },
  actions:     { flexDirection: 'row', gap: 10, marginTop: 8 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: radius.sm,
    backgroundColor: colors.primary + '12', borderWidth: 1, borderColor: colors.primary + '30',
  },
  shareBtnText:  { color: colors.primary, fontSize: 13, fontWeight: '700' },
  revokeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: radius.sm,
    backgroundColor: colors.error + '10', borderWidth: 1, borderColor: colors.error + '30',
  },
  revokeBtnText: { color: colors.error, fontSize: 13, fontWeight: '700' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function ShareCycleScreen({ visible, onClose }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { colors, role, semantic, radius, spacing } = useTheme();
  const styles = makeStyles(colors, radius, spacing);
  const [links,    setLinks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    if (visible && user) loadLinks();
  }, [visible, user?.uid]);

  // ── Écoute temps réel : détecter quand un partenaire accepte le lien ──────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(firestore, 'partnerLinks'),
      where('girlUid', '==', user.uid),
      where('status',  '==', 'active')
    );
    const unsub = onSnapshot(q, (snap) => {
      const activeDoc = snap.docs[0];
      if (activeDoc) {
        const boyUid = activeDoc.data().boyUid;
        if (boyUid) {
          // Sauvegarder partnerUid dans le doc user de la fille
          setDoc(doc(firestore, 'users', user.uid), { partnerUid: boyUid }, { merge: true }).catch(() => {});
        }
      }
    }, () => {});
    return unsub;
  }, [user?.uid]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(firestore, 'partnerLinks'),
          where('girlUid', '==', user.uid)
        )
      );
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Trier : actifs en premier, puis en attente, puis révoqués
      data.sort((a, b) => {
        const order = { active: 0, pending: 1, revoked: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });
      setLinks(data);
    } catch (_) {
      Alert.alert(t('error_generic'), t('load_shares_error'));
    } finally {
      setLoading(false);
    }
  };

  // Crée un nouveau lien d'invitation
  const handleCreate = useCallback(async () => {
    // Vérifier qu'il n'y a pas déjà un lien actif ou en attente
    const existing = links.find((l) => l.status === 'active' || l.status === 'pending');
    if (existing) {
      Alert.alert(
        t('existing_link_title'),
        t('existing_link_msg'),
      );
      return;
    }

    setCreating(true);
    try {
      // Générer un code unique (vérifier unicité dans Firestore)
      let code = generateCode();
      let attempts = 0;
      while (attempts < 5) {
        const check = await getDocs(
          query(collection(firestore, 'partnerLinks'), where('inviteCode', '==', code))
        );
        if (check.empty) break;
        code = generateCode();
        attempts++;
      }

      const docRef = await addDoc(collection(firestore, 'partnerLinks'), {
        girlUid:    user.uid,
        girlName:   user.displayName ?? t('default_user_name'),
        boyUid:     null,
        inviteCode: code,
        status:     'pending',
        createdAt:  serverTimestamp(),
      });

      const newLink = {
        id:         docRef.id,
        girlUid:    user.uid,
        girlName:   user.displayName ?? t('default_user_name'),
        boyUid:     null,
        inviteCode: code,
        status:     'pending',
        createdAt:  new Date(),
      };

      setLinks((prev) => [newLink, ...prev]);

      // Proposer de partager immédiatement
      await Share.share({
        message: t('share_join_message', { code }),
        title:   t('share_join_title'),
      });
    } catch (_) {
      Alert.alert(t('error_generic'), t('create_share_error'));
    } finally {
      setCreating(false);
    }
  }, [links, user]);

  // Révoque un lien
  const handleRevoke = useCallback((link) => {
    Alert.alert(
      t('revoke_share_title'),
      link.status === 'active' ? t('revoke_active_msg') : t('revoke_pending_msg'),
      [
        { text: t('cancel_action'), style: 'cancel' },
        {
          text: t('revoke_action'),
          style: 'destructive',
          onPress: async () => {
            setRevoking(link.id);
            try {
              await updateDoc(doc(firestore, 'partnerLinks', link.id), {
                status:    'revoked',
                revokedAt: serverTimestamp(),
              });
              // Effacer partnerUid du doc user de la fille
              await setDoc(doc(firestore, 'users', user.uid), { partnerUid: null }, { merge: true });
              setLinks((prev) =>
                prev.map((l) => l.id === link.id ? { ...l, status: 'revoked' } : l)
              );
            } catch (_) {
              Alert.alert(t('error_generic'), t('revoke_error'));
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  }, [t]);

  const activeLinks  = links.filter((l) => l.status !== 'revoked');
  const revokedLinks = links.filter((l) => l.status === 'revoked');
  const hasActive    = activeLinks.some((l) => l.status === 'active' || l.status === 'pending');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('share_cycle_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Explication */}
          <View style={[styles.infoBanner, { backgroundColor: colors.secondaryLight }]}>
            <Ionicons name="people-outline" size={28} color={role.girl} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>{t('how_it_works')}</Text>
              <Text style={styles.infoText}>
                {t('share_cycle_explain')}
              </Text>
            </View>
          </View>

          {/* Garanties */}
          <View style={styles.guaranteeRow}>
            {[
              { icon: 'lock-closed-outline', text: t('revocable_access'), color: semantic.success },
              { icon: 'eye-off-outline',     text: t('limited_info'),  color: semantic.info },
              { icon: 'shield-checkmark-outline', text: t('secure_data'), color: colors.secondary },
            ].map((g) => (
              <View key={g.text} style={styles.guaranteeItem}>
                <Ionicons name={g.icon} size={18} color={g.color} />
                <Text style={[styles.guaranteeText, { color: g.color }]}>{g.text}</Text>
              </View>
            ))}
          </View>

          {/* Bouton créer */}
          {!hasActive && (
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: role.girl }]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>{t('generate_invite_code')}</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {/* Liste liens actifs / en attente */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              {activeLinks.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    {hasActive ? t('current_share') : t('no_active_share')}
                  </Text>
                  {activeLinks.map((link) => (
                    <PartnerLinkCard
                      key={link.id}
                      link={link}
                      onRevoke={handleRevoke}
                      revoking={revoking}
                      colors={colors}
                      role={role}
                      semantic={semantic}
                      radius={radius}
                      spacing={spacing}
                    />
                  ))}
                </>
              )}

              {/* Historique révoqués */}
              {revokedLinks.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{t('history_label')}</Text>
                  {revokedLinks.map((link) => (
                    <PartnerLinkCard
                      key={link.id}
                      link={link}
                      onRevoke={handleRevoke}
                      revoking={revoking}
                      colors={colors}
                      role={role}
                      semantic={semantic}
                      radius={radius}
                      spacing={spacing}
                    />
                  ))}
                </>
              )}

              {links.length === 0 && (
                <EmptyState
                  icon="people-outline"
                  title={t('no_share_title')}
                  text={t('no_share_desc')}
                />
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, radius, spacing) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  closeBtn:    { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 48 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md + 2,
    borderWidth: 1, borderColor: colors.primary + '20',
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 4 },
  infoText:  { fontSize: 13, color: colors.textGray, lineHeight: 19 },

  guaranteeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: spacing.xxl, gap: spacing.sm,
  },
  guaranteeItem: { flex: 1, alignItems: 'center', gap: 4 },
  guaranteeText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm + 2, paddingVertical: spacing.lg,
    borderRadius: radius.pill, marginBottom: spacing.xxl,
    elevation: 4, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textGray,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: spacing.sm + 2,
  },
});
