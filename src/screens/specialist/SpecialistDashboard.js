import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue, off, push } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { useNotifications } from '../../hooks/useNotifications';
import ResourcesScreen from './ResourcesScreen';
import ForumScreen from '../ForumScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rtdb, db as firestoreDb } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SmoothLineChart, DonutRing, AnimatedBarChart } from '../../components/Charts';
import PatientDataSheet from '../../components/PatientDataSheet';
import EmptyState from '../../components/ui/EmptyState';
import { useLanguage } from '../../context/LanguageContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (ts, locale = 'fr-FR') => !ts ? '' : new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ts, locale = 'fr-FR') => {
  if (!ts) return '';
  const d     = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return fmtTime(ts, locale);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};
const getInitial = (name) => name ? name[0].toUpperCase() : '?';

/** Extrait le UID du patient depuis l'ID de conversation.
 *  Format attendu : "{patientUid}_{specialistUid}" */
const patientUidFromConvId = (convId, specialistUid) => {
  const parts = convId.split('_');
  return parts.find(p => p !== specialistUid) ?? null;
};

// ─── Cache local des profils patients ─────────────────────────────────────────
const profileCache = {};

async function fetchPatientProfile(uid) {
  if (!uid) return null;
  if (profileCache[uid]) return profileCache[uid];
  try {
    const snap = await getDoc(doc(firestoreDb, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      profileCache[uid] = {
        name:    data.displayName ?? null,
        profile: data.profile     ?? null,
        email:   data.email       ?? null,
      };
      return profileCache[uid];
    }
  } catch (_) {}
  return null;
}

const PROFILE_LABEL_KEYS = { girl: 'profile_female_label', boy: 'profile_male_label', health_worker: 'health_worker_label' };
// Couleurs des profils patients — alignées sur les tokens de rôle (girl/boy).
const PROFILE_COLOR = { girl: '#FB4FEA', boy: '#0284C7', health_worker: '#10B981' };

// ═══════════════════════════════════════════════════════════════════════════════
// ── Vue Chat ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function ChatView({ convId, patientProfile, onBack, roleData, user }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const insets   = useSafeAreaInsets();
  const { sendPushToUser } = useNotifications();
  const { colors, role, spacing, radius, typography } = useTheme();
  const chatStyles = makeChatStyles(colors, role, radius, spacing, typography);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [showDossier, setShowDossier] = useState(false);
  const flatRef = useRef(null);
  const patientUidForDossier = patientUidFromConvId(convId, user?.uid);

  useEffect(() => {
    const msgRef = ref(rtdb, `chats/${convId}/messages`);
    onValue(msgRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        list.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(list);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      } else setMessages([]);
    });
    return () => off(msgRef);
  }, [convId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    try {
      await push(ref(rtdb, `chats/${convId}/messages`), {
        text,
        senderId:    user.uid,
        senderName:  roleData?.displayName || t('default_specialist'),
        isSpecialist: true,
        timestamp:   Date.now(),
      });
      setInput('');

      // 🔔 Notifier le patient (UID extrait de convId)
      const patientUid = patientUidFromConvId(convId, user.uid);
      if (patientUid) {
        sendPushToUser(
          patientUid,
          t('new_reply_notification', { name: roleData?.displayName || t('default_specialist_short') }),
          text.length > 60 ? text.slice(0, 60) + '…' : text,
          { type: 'chat', convId }
        );
      }
    } catch { Alert.alert(t('error_generic'), t('message_not_sent_short')); }
  };

  const profileColor = PROFILE_COLOR[patientProfile?.profile] ?? role.specialist;
  const patientName  = patientProfile?.name ?? t('patient_default');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={[chatStyles.header, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity onPress={onBack} style={chatStyles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={role.specialist} />
          </TouchableOpacity>
          <View style={[chatStyles.avatarSmall, { backgroundColor: profileColor + '22' }]}>
            <Text style={[chatStyles.avatarInitial, { color: profileColor }]}>
              {getInitial(patientName)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={chatStyles.headerName}>{patientName}</Text>
            {patientProfile?.profile && (
              <Text style={[chatStyles.headerSub, { color: profileColor }]}>
                {t(PROFILE_LABEL_KEYS[patientProfile.profile])}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={chatStyles.dossierBtn}
            onPress={() => setShowDossier(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={14} color={role.specialist} />
            <Text style={chatStyles.dossierBtnTxt}>{t('dossier_label')}</Text>
          </TouchableOpacity>
        </View>

        {/* Dossier patient modal */}
        <PatientDataSheet
          visible={showDossier}
          onClose={() => setShowDossier(false)}
          patientUid={patientUidForDossier}
          patientName={patientProfile?.name}
        />

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={i => i.id}
          contentContainerStyle={chatStyles.list}
          ListEmptyComponent={
            <EmptyState icon="chatbubbles-outline" text={t('no_message_yet')} />
          }
          renderItem={({ item }) => {
            const isMe = item.isSpecialist;
            return (
              <View style={[chatStyles.bubble, isMe ? chatStyles.bubbleMe : chatStyles.bubbleThem]}>
                {!isMe && <Text style={chatStyles.senderName}>{item.senderName}</Text>}
                <Text style={[chatStyles.bubbleText, isMe && chatStyles.bubbleTextMe]}>{item.text}</Text>
                <Text style={[chatStyles.bubbleTime, isMe && chatStyles.bubbleTimeMe]}>{fmtTime(item.timestamp, locale)}</Text>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={[chatStyles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
          <TextInput
            style={chatStyles.input}
            placeholder={t('professional_response_placeholder')}
            placeholderTextColor={colors.textGray}
            value={input} onChangeText={setInput}
            multiline maxLength={500}
          />
          <TouchableOpacity
            style={[chatStyles.sendBtn, !input.trim() && chatStyles.sendBtnOff]}
            onPress={sendMessage} disabled={!input.trim()}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Vue Conversations ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function ConversationsView({ conversations, onSelect, onBack, specialistUid }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const insets  = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, typography } = useTheme();
  const convStyles = makeConvStyles(colors, role, semantic, radius, spacing, typography);
  const [profiles, setProfiles] = useState({});
  const [filter,   setFilter]   = useState('all'); // all | urgent

  useEffect(() => {
    conversations.forEach(async (c) => {
      const uid = patientUidFromConvId(c.id, specialistUid);
      if (uid && !profiles[uid]) {
        const profile = await fetchPatientProfile(uid);
        if (profile) setProfiles(prev => ({ ...prev, [uid]: profile }));
      }
    });
  }, [conversations]);

  const urgentCount = conversations.filter(c => c.unread > 0).length;
  const displayed   = filter === 'urgent'
    ? conversations.filter(c => c.unread > 0)
    : conversations;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[convStyles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={onBack} style={convStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={role.specialist} />
        </TouchableOpacity>
        <Text style={convStyles.title}>{t('conversations_title')}</Text>
        {urgentCount > 0 && (
          <View style={convStyles.urgentBadge}>
            <Ionicons name="alert-circle" size={13} color="#fff" />
            <Text style={convStyles.urgentBadgeTxt}>{t('urgent_count_label', { n: urgentCount, s: urgentCount > 1 ? 's' : '' })}</Text>
          </View>
        )}
      </View>

      {/* Filtres */}
      <View style={convStyles.filterRow}>
        {[
          { key: 'all',    label: t('all_count', { n: conversations.length }) },
          { key: 'urgent', label: t('urgent_only_count', { n: urgentCount }) },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[convStyles.filterBtn, filter === f.key && convStyles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[convStyles.filterTxt, filter === f.key && convStyles.filterTxtActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {displayed.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={filter === 'urgent' ? t('no_urgent_conv') : t('no_conversation')}
          text={filter === 'urgent' ? t('all_conv_uptodate') : t('patients_appear_here')}
        />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={i => i.id}
          contentContainerStyle={[convStyles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          renderItem={({ item }) => {
            const uid     = patientUidFromConvId(item.id, specialistUid);
            const profile = uid ? profiles[uid] : null;
            const pColor  = PROFILE_COLOR[profile?.profile] ?? role.specialist;
            const isUrgent = item.unread > 0;

            return (
              <TouchableOpacity
                style={[convStyles.card, isUrgent && convStyles.cardUrgent]}
                onPress={() => onSelect(item.id, profile)}
                activeOpacity={0.8}
              >
                {/* Flag urgent */}
                {isUrgent && (
                  <View style={convStyles.urgentFlag}>
                    <Ionicons name="alert-circle" size={12} color="#fff" />
                    <Text style={convStyles.urgentFlagTxt}>{t('urgent_flag')}</Text>
                  </View>
                )}
                <View style={[convStyles.avatar, { backgroundColor: pColor + '22' }]}>
                  <Text style={[convStyles.avatarInitial, { color: pColor }]}>
                    {getInitial(profile?.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={convStyles.nameRow}>
                    <Text style={convStyles.cardName}>{profile?.name ?? t('patient_default')}</Text>
                    {profile?.profile && (
                      <View style={[convStyles.profileTag, { backgroundColor: pColor + '18' }]}>
                        <Text style={[convStyles.profileTagTxt, { color: pColor }]}>
                          {t(PROFILE_LABEL_KEYS[profile.profile])}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={convStyles.cardLast} numberOfLines={1}>
                    {item.lastMessage?.text || t('start_conv_placeholder')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <Text style={convStyles.cardTime}>{fmtDate(item.lastMessage?.timestamp, locale)}</Text>
                  {isUrgent && (
                    <View style={convStyles.unreadBadge}>
                      <Text style={convStyles.unreadText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Vue Statistiques ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function StatsView({ conversations, onBack, roleData }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows, typography } = useTheme();
  const statsStyles = makeStatsStyles(colors, radius, spacing, shadows, typography);

  // Calculs
  const totalConvs     = conversations.length;
  const totalMsgs      = conversations.reduce((a, c) => a + c.msgCount, 0);
  const totalUnread    = conversations.reduce((a, c) => a + c.unread, 0);
  const totalResponded = conversations.filter(c => c.hasSpecialistMsg).length;
  const responseRate   = totalConvs > 0 ? Math.round((totalResponded / totalConvs) * 100) : 0;
  const avgMsgs        = totalConvs > 0 ? (totalMsgs / totalConvs).toFixed(1) : 0;

  // Activité des 7 derniers jours
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString(locale, { weekday: 'short' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd   = dayStart + 86400000;
    const count    = conversations.reduce((acc, c) => {
      return acc + (c.allMessages?.filter(m => m.timestamp >= dayStart && m.timestamp < dayEnd).length ?? 0);
    }, 0);
    last7.push({ label: dateStr, count });
  }
  const maxDay = Math.max(...last7.map(d => d.count), 1);

  // Répartition profils
  const profileCounts = { girl: 0, boy: 0, other: 0 };
  conversations.forEach(c => {
    const p = c.patientProfile?.profile;
    if (p === 'girl') profileCounts.girl++;
    else if (p === 'boy') profileCounts.boy++;
    else profileCounts.other++;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[statsStyles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={onBack} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color={role.specialist} />
        </TouchableOpacity>
        <Text style={statsStyles.title}>{t('stats_title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>

        {/* KPIs */}
        <View style={statsStyles.kpiGrid}>
          {[
            { label: t('kpi_conversations'),   value: totalConvs,    icon: 'chatbubbles',        color: role.specialist },
            { label: t('kpi_messages_received'),  value: totalMsgs,     icon: 'mail',               color: '#3B82F6'      },
            { label: t('kpi_unread'),         value: totalUnread,   icon: 'alert-circle',       color: semantic.error },
            { label: t('kpi_response_rate'),    value: `${responseRate}%`, icon: 'checkmark-circle', color: semantic.success },
            { label: t('kpi_avg_msgs'),  value: avgMsgs,       icon: 'stats-chart',        color: '#8B5CF6'      },
            { label: t('kpi_answered_conv'), value: totalResponded,icon: 'chatbox-ellipses',   color: semantic.warning },
          ].map((k, i) => (
            <View key={i} style={[statsStyles.kpiCard, { borderTopColor: k.color, borderTopWidth: 3 }]}>
              <Ionicons name={k.icon} size={20} color={k.color} style={{ marginBottom: 6 }} />
              <Text style={[statsStyles.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={statsStyles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Activité 7 jours — Courbe lisse */}
        <View style={statsStyles.card}>
          <View style={statsStyles.cardTitleRow}>
            <Ionicons name="pulse-outline" size={16} color={role.specialist} />
            <Text style={statsStyles.cardTitle}>{t('activity_7d_title')}</Text>
          </View>
          {last7.every(d => d.count === 0) ? (
            <View style={statsStyles.noDataWrap}>
              <Ionicons name="bar-chart-outline" size={36} color={colors.border} />
              <Text style={statsStyles.noDataTxt}>{t('no_activity_recorded')}</Text>
            </View>
          ) : (
            <SmoothLineChart
              color={role.specialist}
              height={130}
              data={last7.map(d => ({ value: d.count, label: d.label }))}
            />
          )}
        </View>

        {/* Répartition profils — Donut */}
        <View style={statsStyles.card}>
          <View style={statsStyles.cardTitleRow}>
            <Ionicons name="pie-chart-outline" size={16} color="#8B5CF6" />
            <Text style={statsStyles.cardTitle}>{t('patient_distribution')}</Text>
          </View>
          <DonutRing
            size={100}
            thickness={16}
            centerTitle={totalConvs}
            centerSub={t('patients_word')}
            segments={[
              { value: profileCounts.girl,  color: role.girl,  label: t('women_label')  },
              { value: profileCounts.boy,   color: role.boy,   label: t('men_label') },
              ...(profileCounts.other > 0 ? [{ value: profileCounts.other, color: '#94A3B8', label: t('others_label') }] : []),
            ].filter(s => s.value > 0)}
          />
        </View>

        {/* Réponses vs non lus — Barres */}
        <View style={statsStyles.card}>
          <View style={statsStyles.cardTitleRow}>
            <Ionicons name="bar-chart-outline" size={16} color={semantic.success} />
            <Text style={statsStyles.cardTitle}>{t('exchange_quality')}</Text>
          </View>
          <AnimatedBarChart
            height={120}
            data={[
              { label: t('total_conv_short'),    value: totalConvs,     color: role.specialist },
              { label: t('answered_short'),      value: totalResponded, color: semantic.success },
              { label: t('unread_short'),        value: totalUnread,    color: semantic.error  },
              { label: t('avg_msgs_short'),      value: Math.round(parseFloat(avgMsgs)), color: '#8B5CF6' },
            ]}
          />
        </View>

        {/* Infos spécialiste */}
        <View style={statsStyles.card}>
          <Text style={statsStyles.cardTitle}>{t('professional_profile')}</Text>
          {[
            { icon: 'medkit-outline',        label: t('speciality_field'),  value: roleData?.speciality },
            roleData?.institution && { icon: 'business-outline',   label: t('institution_field'), value: roleData.institution },
            roleData?.phone && { icon: 'call-outline',             label: t('phone_field'),   value: roleData.phone },
            roleData?.credentials && { icon: 'document-text-outline', label: t('diplomas_field'), value: roleData.credentials },
            { icon: 'checkmark-circle-outline', label: t('status_field'),   value: t('approved_check'), valueColor: semantic.success },
          ].filter(Boolean).map((row, i) => (
            <View key={i} style={statsStyles.infoRow}>
              <Ionicons name={row.icon} size={15} color={colors.textGray} />
              <Text style={statsStyles.infoLabel}>{row.label}</Text>
              <Text style={[statsStyles.infoValue, row.valueColor && { color: row.valueColor }]}>
                {row.value ?? '—'}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Dashboard principal ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function SpecialistDashboard({ overrideRoleData } = {}) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { user, roleData: authRoleData, logout } = useAuth();
  // Un compte double-profil (fille/garçon + spécialiste) a son roleData
  // Firestore consommateur dans useAuth() — le doc specialists/{uid} réel
  // (nom/spécialité) est passé explicitement via cette prop dans ce cas.
  const roleData = overrideRoleData ?? authRoleData;
  const insets = useSafeAreaInsets();
  const { colors, role, semantic, spacing, radius, shadows, typography } = useTheme();
  const dashStyles = makeDashStyles(colors, semantic, radius, spacing, shadows, typography);

  const [conversations,    setConversations]    = useState([]);
  const [patientProfiles,  setPatientProfiles]  = useState({});
  const [selected,         setSelected]         = useState(null);
  const [selectedProfile,  setSelectedProfile]  = useState(null);
  const [view,             setView]             = useState('dashboard'); // dashboard | conversations | chat | stats | resources

  // ── Écoute RTDB ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const chatsRef = ref(rtdb, 'chats');
    onValue(chatsRef, (snap) => {
      const data    = snap.val() || {};
      const specId  = user.uid;
      const convs = Object.entries(data)
        .filter(([id]) => id.includes(specId))
        .map(([id, val]) => {
          const msgs           = val.messages ? Object.values(val.messages) : [];
          const sorted         = msgs.sort((a, b) => b.timestamp - a.timestamp);
          const last           = sorted[0];
          const unread         = msgs.filter(m => !m.isSpecialist).length;
          const hasSpecialistMsg = msgs.some(m => m.isSpecialist);
          return { id, lastMessage: last, unread, msgCount: msgs.length, hasSpecialistMsg, allMessages: msgs };
        })
        .sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));
      setConversations(convs);
    });
    return () => off(ref(rtdb, 'chats'));
  }, [user?.uid]);

  // ── Chargement des profils patients ─────────────────────────────────────────
  useEffect(() => {
    conversations.forEach(async (c) => {
      const uid = patientUidFromConvId(c.id, user?.uid);
      if (uid && !patientProfiles[uid]) {
        const profile = await fetchPatientProfile(uid);
        if (profile) setPatientProfiles(prev => ({ ...prev, [uid]: profile }));
      }
    });
  }, [conversations]);

  // Enrichir conversations avec profils pour StatsView
  const enrichedConvs = conversations.map(c => {
    const uid = patientUidFromConvId(c.id, user?.uid);
    return { ...c, patientProfile: uid ? patientProfiles[uid] : null };
  });

  const totalUnread  = conversations.reduce((a, c) => a + c.unread, 0);
  const urgentConvs  = conversations.filter(c => c.unread > 0);

  // ── Navigation ───────────────────────────────────────────────────────────────
  if (view === 'chat' && selected) {
    return (
      <ChatView
        convId={selected}
        patientProfile={selectedProfile}
        onBack={() => { setSelected(null); setSelectedProfile(null); setView('conversations'); }}
        roleData={roleData}
        user={user}
      />
    );
  }
  if (view === 'conversations') {
    return (
      <ConversationsView
        conversations={enrichedConvs}
        specialistUid={user?.uid}
        onSelect={(id, profile) => { setSelected(id); setSelectedProfile(profile); setView('chat'); }}
        onBack={() => setView('dashboard')}
      />
    );
  }
  if (view === 'stats') {
    return (
      <StatsView
        conversations={enrichedConvs}
        onBack={() => setView('dashboard')}
        roleData={roleData}
      />
    );
  }
  if (view === 'resources') {
    return (
      <View style={{ flex: 1 }}>
        {/* Header retour */}
        <View style={{ backgroundColor: role.specialist, paddingTop: insets.top + spacing.xxl, paddingBottom: spacing.md + 2, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <TouchableOpacity onPress={() => setView('dashboard')} style={{ padding: 6 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: '#fff' }}>{t('professional_resources')}</Text>
        </View>
        <ResourcesScreen />
      </View>
    );
  }
  if (view === 'forum') {
    return <ForumScreen onBack={() => setView('dashboard')} />;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[dashStyles.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <View style={[dashStyles.hero, { backgroundColor: role.specialist }]}>
          <View style={dashStyles.heroTop}>
            <View style={dashStyles.heroAvatar}>
              <Text style={dashStyles.heroAvatarText}>{getInitial(roleData?.displayName)}</Text>
            </View>
            <TouchableOpacity onPress={logout} style={dashStyles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
          <Text style={dashStyles.heroGreeting}>{t('greeting_hello_comma')}</Text>
          <Text style={dashStyles.heroName}>{roleData?.displayName || t('default_specialist')}</Text>
          <View style={dashStyles.heroBadge}>
            <Ionicons name="medkit" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={dashStyles.heroBadgeText}>{roleData?.speciality || t('health_specialist_default')}</Text>
          </View>
        </View>

        {/* ── Alerte urgences ─────────────────────────────────────────────── */}
        {urgentConvs.length > 0 && (
          <TouchableOpacity
            style={dashStyles.urgentBanner}
            onPress={() => setView('conversations')}
            activeOpacity={0.85}
          >
            <View style={dashStyles.urgentBannerLeft}>
              <Ionicons name="alert-circle" size={22} color="#fff" />
              <View>
                <Text style={dashStyles.urgentBannerTitle}>
                  {t('urgent_conversations_count', { n: urgentConvs.length, s: urgentConvs.length > 1 ? 's' : '' })}
                </Text>
                <Text style={dashStyles.urgentBannerSub}>
                  {t('messages_awaiting_reply', { n: totalUnread, s: totalUnread > 1 ? 's' : '' })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ── Stats rapides ────────────────────────────────────────────────── */}
        <View style={dashStyles.statsRow}>
          <StatCard icon="chatbubbles"  value={conversations.length} label={t('conversations_stat')} color={role.specialist} />
          <StatCard icon="alert-circle" value={totalUnread}          label={t('unread_stat')}        color={semantic.error} />
          <StatCard icon="stats-chart"  value={conversations.reduce((a,c)=>a+c.msgCount,0)} label={t('messages_stat')} color={semantic.success} />
        </View>

        {/* ── Boutons d'action ────────────────────────────────────────────── */}
        <View style={dashStyles.actionsRow}>
          <TouchableOpacity
            style={[dashStyles.actionBtn, { backgroundColor: role.specialist }]}
            onPress={() => setView('conversations')}
            activeOpacity={0.85}
          >
            <View style={dashStyles.actionBtnInner}>
              <View style={dashStyles.actionIcon}>
                <Ionicons name="chatbubbles" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dashStyles.actionTitle}>{t('conversations_stat')}</Text>
                <Text style={dashStyles.actionSub}>
                  {conversations.length === 0 ? t('none_label') : t('conversations_count_label', { n: conversations.length, s: conversations.length > 1 ? 's' : '' })}
                </Text>
              </View>
              {totalUnread > 0 && (
                <View style={dashStyles.unreadBadge}>
                  <Text style={dashStyles.unreadText}>{totalUnread}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dashStyles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => setView('stats')}
            activeOpacity={0.85}
          >
            <View style={dashStyles.actionBtnInner}>
              <View style={[dashStyles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="stats-chart" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dashStyles.actionTitle}>{t('stats_title')}</Text>
                <Text style={dashStyles.actionSub}>{t('overview_label')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dashStyles.actionBtn, { backgroundColor: role.specialist }]}
            onPress={() => setView('resources')}
            activeOpacity={0.85}
          >
            <View style={dashStyles.actionBtnInner}>
              <View style={[dashStyles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="library" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dashStyles.actionTitle}>{t('resources_label')}</Text>
                <Text style={dashStyles.actionSub}>{t('resources_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dashStyles.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => setView('forum')}
            activeOpacity={0.85}
          >
            <View style={dashStyles.actionBtnInner}>
              <View style={[dashStyles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="people-circle" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dashStyles.actionTitle}>{t('anonymous_forum_label')}</Text>
                <Text style={dashStyles.actionSub}>{t('follow_exchanges_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Conversations urgentes ───────────────────────────────────────── */}
        {urgentConvs.length > 0 && (
          <>
            <Text style={dashStyles.sectionTitle}>
              <Ionicons name="alert-circle" size={15} color={semantic.error} /> {t('priority_treatment')}
            </Text>
            {urgentConvs.slice(0, 3).map(item => {
              const uid     = patientUidFromConvId(item.id, user?.uid);
              const profile = uid ? patientProfiles[uid] : null;
              const pColor  = PROFILE_COLOR[profile?.profile] ?? role.specialist;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={dashStyles.urgentCard}
                  onPress={() => { setSelected(item.id); setSelectedProfile(profile); setView('chat'); }}
                  activeOpacity={0.8}
                >
                  <View style={[dashStyles.recentAvatar, { backgroundColor: pColor + '22' }]}>
                    <Text style={[dashStyles.avatarInitial, { color: pColor }]}>
                      {getInitial(profile?.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dashStyles.recentName}>{profile?.name ?? t('patient_default')}</Text>
                    <Text style={dashStyles.recentLast} numberOfLines={1}>
                      {item.lastMessage?.text || '...'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={dashStyles.recentTime}>{fmtDate(item.lastMessage?.timestamp, locale)}</Text>
                    <View style={dashStyles.miniUnread}>
                      <Text style={dashStyles.miniUnreadText}>{item.unread}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ── Conversations récentes ───────────────────────────────────────── */}
        {conversations.filter(c => c.unread === 0).length > 0 && (
          <>
            <Text style={dashStyles.sectionTitle}>{t('recent_label')}</Text>
            {conversations.filter(c => c.unread === 0).slice(0, 3).map(item => {
              const uid     = patientUidFromConvId(item.id, user?.uid);
              const profile = uid ? patientProfiles[uid] : null;
              const pColor  = PROFILE_COLOR[profile?.profile] ?? role.specialist;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={dashStyles.recentCard}
                  onPress={() => { setSelected(item.id); setSelectedProfile(profile); setView('chat'); }}
                  activeOpacity={0.8}
                >
                  <View style={[dashStyles.recentAvatar, { backgroundColor: pColor + '22' }]}>
                    <Text style={[dashStyles.avatarInitial, { color: pColor }]}>
                      {getInitial(profile?.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={dashStyles.recentName}>{profile?.name ?? t('patient_default')}</Text>
                      {profile?.profile && (
                        <View style={[dashStyles.profileTag, { backgroundColor: pColor + '18' }]}>
                          <Text style={[dashStyles.profileTagTxt, { color: pColor }]}>
                            {t(PROFILE_LABEL_KEYS[profile.profile])}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={dashStyles.recentLast} numberOfLines={1}>{item.lastMessage?.text || '...'}</Text>
                  </View>
                  <Text style={dashStyles.recentTime}>{fmtDate(item.lastMessage?.timestamp, locale)}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Aucune conversation */}
        {conversations.length === 0 && (
          <EmptyState
            icon="chatbubbles-outline"
            title={t('no_conversation')}
            text={t('patients_appear_here')}
            style={{ paddingTop: 40 }}
          />
        )}

      </ScrollView>
    </View>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  const { colors, radius, spacing, shadows } = useTheme();
  return (
    <View style={[
      { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 2, alignItems: 'center', borderWidth: 1, borderColor: color + '33' },
      shadows.sm,
    ]}>
      <Ionicons name={icon} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text style={{ fontSize: 24, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ color: colors.textGray, fontSize: 10, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Styles ────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const makeDashStyles = (colors, semantic, radius, spacing, shadows, typography) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg },

  // Hero
  hero:          { borderRadius: radius.xl, padding: spacing.xxl, marginBottom: spacing.lg },
  heroTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  heroAvatar:    { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  heroAvatarText:{ color: '#fff', fontSize: 24, fontWeight: '800' },
  logoutBtn:     { padding: spacing.sm },
  heroGreeting:  { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  heroName:      { ...typography.h1, color: '#fff', marginBottom: spacing.sm + 2 },
  heroBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  heroBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },

  // Urgent banner
  urgentBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: semantic.error, borderRadius: radius.lg, padding: spacing.md + 2, marginBottom: spacing.lg, gap: spacing.md },
  urgentBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  urgentBannerTitle:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  urgentBannerSub:  { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  // Stats
  statsRow:   { flexDirection: 'row', gap: spacing.sm + 2, marginBottom: spacing.lg },

  // Actions
  actionsRow:       { gap: spacing.sm + 2, marginBottom: spacing.xxl - 4 },
  actionBtn:        { borderRadius: radius.pill, overflow: 'hidden', ...shadows.md },
  actionBtnInner:   { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.md + 2 },
  actionIcon:       { width: 44, height: 44, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  actionTitle:      { color: '#fff', fontSize: 16, fontWeight: '800' },
  actionSub:        { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  unreadBadge:      { backgroundColor: semantic.error, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 3, marginRight: 4 },
  unreadText:       { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Section
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm + 2, marginTop: 4 },

  // Urgent card
  urgentCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: semantic.error + '0D', borderRadius: radius.md, padding: spacing.md + 2, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: semantic.error + '55', gap: spacing.md },

  // Recent card
  recentCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md + 2, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  recentAvatar:  { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '800' },
  recentName:    { color: colors.text, fontWeight: '700', fontSize: 14 },
  recentLast:    { color: colors.textGray, fontSize: 12, marginTop: 2 },
  recentTime:    { color: colors.textGray, fontSize: 11 },
  miniUnread:    { backgroundColor: semantic.error, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  miniUnreadText:{ color: '#fff', fontSize: 10, fontWeight: '700' },
  profileTag:    { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  profileTagTxt: { fontSize: 10, fontWeight: '700' },
});

const makeConvStyles = (colors, role, semantic, radius, spacing, typography) => StyleSheet.create({
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, gap: spacing.sm + 2 },
  backBtn:          { padding: 4 },
  title:            { ...typography.h2, flex: 1, color: colors.text },
  urgentBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: semantic.error, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  urgentBadgeTxt:   { color: '#fff', fontSize: 11, fontWeight: '700' },
  filterRow:        { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterBtn:        { alignSelf: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.lg - 2, paddingVertical: spacing.sm - 2, backgroundColor: colors.background },
  filterBtnActive:  { backgroundColor: role.specialist + '18' },
  filterTxt:        { fontSize: 13, color: colors.textGray, fontWeight: '600' },
  filterTxtActive:  { color: role.specialist },
  list:             { padding: spacing.lg, gap: spacing.sm },
  card:             { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 2, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  cardUrgent:       { borderColor: semantic.error + '55', borderWidth: 1.5, backgroundColor: semantic.error + '0D' },
  urgentFlag:       { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: semantic.error, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  urgentFlagTxt:    { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  avatar:           { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarInitial:    { fontSize: 20, fontWeight: '800' },
  nameRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  cardName:         { color: colors.text, fontWeight: '700', fontSize: 14 },
  profileTag:       { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  profileTagTxt:    { fontSize: 10, fontWeight: '700' },
  cardLast:         { color: colors.textGray, fontSize: 12 },
  cardTime:         { color: colors.textGray, fontSize: 11 },
  unreadBadge:      { backgroundColor: semantic.error, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  unreadText:       { color: '#fff', fontSize: 11, fontWeight: '700' },
});

const makeStatsStyles = (colors, radius, spacing, shadows, typography) => StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, gap: spacing.md },
  title:       { ...typography.h2, flex: 1, color: colors.text },
  kpiGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2, marginBottom: spacing.lg },
  kpiCard:     { width: '30%', flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md + 2, alignItems: 'center', ...shadows.sm },
  kpiValue:    { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  kpiLabel:    { fontSize: 10, color: colors.textGray, textAlign: 'center' },
  card:         { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl - 2, marginBottom: spacing.md + 2, borderWidth: 1, borderColor: colors.border, ...shadows.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md + 2 },
  cardTitle:    { ...typography.bodyBold, color: colors.text },
  noDataWrap:   { alignItems: 'center', paddingVertical: 20, gap: spacing.sm },
  noDataTxt:    { textAlign: 'center', color: colors.textGray, fontSize: 12 },
  // Info rows
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel:   { flex: 1, fontSize: 13, color: colors.textGray },
  infoValue:   { fontSize: 13, fontWeight: '600', color: colors.text, flex: 2, textAlign: 'right' },
});

const makeChatStyles = (colors, role, radius, spacing, typography) => StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, gap: spacing.sm + 2 },
  backBtn:       { padding: 4 },
  avatarSmall:   { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 17, fontWeight: '800' },
  headerName:    { ...typography.h3, color: colors.text },
  headerSub:     { fontSize: 11, fontWeight: '600', marginTop: 1 },
  dossierBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: role.specialist + '15', paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2, borderRadius: radius.sm, borderWidth: 1, borderColor: role.specialist + '30' },
  dossierBtnTxt: { color: role.specialist, fontSize: 11, fontWeight: '700' },
  list:          { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, flexGrow: 1 },
  bubble:        { maxWidth: '80%', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMe:      { alignSelf: 'flex-end', backgroundColor: role.specialist, borderWidth: 0, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: 4 },
  bubbleThem:    {},
  senderName:    { color: colors.primaryLight, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bubbleText:    { color: colors.text, fontSize: 15, lineHeight: 22 },
  bubbleTextMe:  { color: '#fff' },
  bubbleTime:    { color: colors.textGray, fontSize: 10, marginTop: 4 },
  bubbleTimeMe:  { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  inputBar:      { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm + 2, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, gap: spacing.sm + 2 },
  input:         { flex: 1, backgroundColor: colors.background, borderRadius: 22, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, color: colors.text, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: role.specialist, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff:    { backgroundColor: colors.border },
});
