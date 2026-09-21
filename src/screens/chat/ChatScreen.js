import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, push, onValue, off, set, serverTimestamp } from 'firebase/database';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { rtdb, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const generateAnonymousName = (uid) => {
  const names = ['Rose', 'Lune', 'Étoile', 'Aurore', 'Jade', 'Iris', 'Aube', 'Perle'];
  const idx = uid.charCodeAt(0) % names.length;
  return `${names[idx]}${uid.slice(-3)}`;
};

const fmtTime = (ts, locale = 'fr-FR') => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const getInitial = (name) => name ? name[0].toUpperCase() : '?';

export default function ChatScreen() {
  const { t, lang } = useLanguage();
  const { colors, semantic, spacing, radius } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const { user } = useAuth();
  const { sendPushToSpecialist } = useNotifications();
  const insets = useSafeAreaInsets();
  const [specialists, setSpecialists] = useState([]);
  const [loadingSpecs, setLoadingSpecs] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastMessages, setLastMessages] = useState({});
  const flatRef = useRef(null);
  const anonName = user ? generateAnonymousName(user.uid) : t('anonymous_label');

  const chatId = selectedSpec ? `${[user?.uid, selectedSpec.uid].sort().join('_')}` : null;
  const [onlineMap, setOnlineMap] = useState({});

  // Charger les vrais spécialistes approuvés depuis Firestore
  useEffect(() => {
    const loadSpecialists = async () => {
      try {
        const q = query(collection(db, 'specialists'), where('status', '==', 'approved'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setSpecialists(list);

        // Écouter leur présence + dernier message RTDB
        list.forEach(spec => {
          const presRef = ref(rtdb, `presence/${spec.uid}`);
          onValue(presRef, (snap) => {
            const data = snap.val();
            setOnlineMap(prev => ({ ...prev, [spec.uid]: data?.online === true }));
          });

          if (user) {
            const cid = [user.uid, spec.uid].sort().join('_');
            const msgRef = ref(rtdb, `chats/${cid}/messages`);
            onValue(msgRef, (snap) => {
              const data = snap.val();
              if (data) {
                const msgs = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
                setLastMessages(prev => ({ ...prev, [spec.uid]: msgs[0] }));
              }
            });
          }
        });
      } catch (_) {
      } finally {
        setLoadingSpecs(false);
      }
    };
    loadSpecialists();
  }, []);

  // Publier notre propre présence quand on est dans le chat
  useEffect(() => {
    if (!user || !selectedSpec) return;
    const presRef = ref(rtdb, `presence/${user.uid}`);
    set(presRef, { online: true, lastSeen: Date.now() }).catch(() => {});
    return () => { set(presRef, { online: false, lastSeen: Date.now() }).catch(() => {}); };
  }, [user?.uid, selectedSpec?.uid]);

  // Écouter les messages en temps réel
  useEffect(() => {
    if (!chatId) return;
    const msgRef = ref(rtdb, `chats/${chatId}/messages`);
    onValue(msgRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([k, v]) => ({ id: k, ...v }));
        list.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(list);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        setMessages([]);
      }
    });
    return () => off(msgRef);
  }, [chatId]);

  const sendMessage = async () => {
    if (!input.trim() || !chatId || !selectedSpec) return;
    setSending(true);
    const text = input.trim();
    try {
      const msgRef = ref(rtdb, `chats/${chatId}/messages`);
      await push(msgRef, {
        text,
        senderId:     user.uid,
        senderName:   anonName,
        isSpecialist: false,
        timestamp:    Date.now(),
      });
      setInput('');

      // 🔔 Notifier le spécialiste
      sendPushToSpecialist(
        selectedSpec.uid,
        t('new_patient_message'),
        `${anonName} : ${text.length > 60 ? text.slice(0, 60) + '…' : text}`,
        { type: 'chat', chatId }
      );
    } catch (e) {
      Alert.alert(t('error_generic'), t('message_not_sent'));
    } finally {
      setSending(false);
    }
  };

  // Liste des spécialistes
  if (!selectedSpec) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.listContainer}>

          <Text style={styles.title}>{t('specialist_chat')}</Text>
          <Text style={styles.subtitle}>{t('chat_screen_sub')}</Text>

          {/* Badge anonymat */}
          <View style={styles.anonBadge}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryLight} />
            <Text style={styles.anonText}>{t('you_appear_as')}</Text>
            <Text style={styles.anonName}>{anonName}</Text>
          </View>

          <Text style={styles.sectionLabel}>{t('available_specialists')}</Text>

          {loadingSpecs ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : specialists.length === 0 ? (
            <View style={styles.emptySpecs}>
              <Ionicons name="people-outline" size={48} color={colors.border} />
              <Text style={styles.emptySpecsText}>{t('no_specialist_available')}</Text>
            </View>
          ) : (
            specialists.map((spec) => (
              <TouchableOpacity
                key={spec.uid}
                style={styles.specCard}
                onPress={() => setSelectedSpec(spec)}
                activeOpacity={0.85}
              >
                <View style={styles.specAvatar}>
                  <Text style={styles.specInitial}>{getInitial(spec.displayName)}</Text>
                </View>
                <View style={styles.specInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.specName}>{spec.displayName}</Text>
                    <View style={[styles.onlineDot, { backgroundColor: onlineMap[spec.uid] ? semantic.success : colors.textGray }]} />
                    <Text style={[styles.onlineLabel, { color: onlineMap[spec.uid] ? semantic.success : colors.textGray }]}>
                      {onlineMap[spec.uid] ? t('online_label') : t('offline_label')}
                    </Text>
                  </View>
                  <Text style={styles.specSpec}>{spec.speciality || t('health_specialist_default')}</Text>
                  {lastMessages[spec.uid] ? (
                    <Text style={styles.specDesc} numberOfLines={1}>
                      {lastMessages[spec.uid].senderId === user?.uid ? t('you_prefix') : ''}
                      {lastMessages[spec.uid].text}
                    </Text>
                  ) : spec.description ? (
                    <Text style={styles.specDesc} numberOfLines={1}>{spec.description}</Text>
                  ) : null}
                </View>
                {lastMessages[spec.uid] && (
                  <Text style={styles.lastTime}>{fmtTime(lastMessages[spec.uid].timestamp, lang === 'en' ? 'en-US' : 'fr-FR')}</Text>
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
              </TouchableOpacity>
            ))
          )}

          {/* Note confidentialité */}
          <View style={styles.confidentialNote}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.confidentialTitle}>{t('confidentiality_guaranteed')}</Text>
              <Text style={styles.confidentialText}>
                {t('confidentiality_text')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Écran de chat
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatContainer}>

        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedSpec(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.chatAvatarSmall}>
            <Text style={styles.chatAvatarText}>{getInitial(selectedSpec.displayName)}</Text>
          </View>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{selectedSpec.displayName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={[styles.onlineDot, { backgroundColor: onlineMap[selectedSpec.uid] ? semantic.success : colors.textGray }]} />
              <Text style={[styles.chatHeaderSpec, { color: onlineMap[selectedSpec.uid] ? semantic.success : colors.textGray }]}>
                {onlineMap[selectedSpec.uid] ? t('online_label') : selectedSpec.speciality || t('health_specialist_default')}
              </Text>
            </View>
          </View>
        </View>

        {/* Bandeau anonymat */}
        <View style={styles.anonBanner}>
          <Ionicons name="shield-checkmark-outline" size={12} color={colors.primaryLight} />
          <Text style={styles.anonBannerText}> {t('you_prefix')}{anonName}</Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text style={styles.emptyChatText}>{t('start_conversation')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.uid;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                {!isMe && <Text style={styles.bubbleSender}>{item.senderName || selectedSpec.displayName}</Text>}
                <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                  {item.text}
                </Text>
                <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                  {fmtTime(item.timestamp, lang === 'en' ? 'en-US' : 'fr-FR')}
                </Text>
              </View>
            );
          }}
        />

        {/* Saisie */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.messageInput}
            placeholder={t('message_placeholder')}
            placeholderTextColor={colors.textGray}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  container: { flex: 1 },
  listContainer: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textGray, marginBottom: spacing.lg },
  anonBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.primaryLight + '44',
  },
  anonText: { color: colors.textGray, fontSize: 13 },
  anonName: { color: colors.primaryLight, fontWeight: '700', fontSize: 13 },
  sectionLabel: {
    color: colors.textGray, fontSize: 12, fontWeight: '700',
    marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1,
  },
  specCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
    elevation: 1,
  },
  specAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  specInitial: { fontSize: 22, fontWeight: '800', color: colors.primary },
  specInfo: { flex: 1 },
  specName: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 2 },
  specSpec: { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  specDesc: { color: colors.textGray, fontSize: 12 },
  emptySpecs: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptySpecsText: { color: colors.textGray, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  confidentialNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.md, padding: 14,
    marginTop: spacing.md, borderWidth: 1, borderColor: colors.success + '44',
  },
  confidentialTitle: { color: colors.success, fontWeight: '700', fontSize: 13, marginBottom: 2 },
  confidentialText: { color: colors.textGray, fontSize: 12, lineHeight: 18 },
  chatContainer: { flex: 1 },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: { padding: 4 },
  chatAvatarSmall: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  chatAvatarText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  chatHeaderSpec: { color: colors.textGray, fontSize: 12 },
  anonBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primaryLight + '18',
    paddingVertical: 7, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.primaryLight + '30',
  },
  anonBannerText: { color: colors.primaryLight, fontSize: 12, fontWeight: '600' },
  messagesList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: spacing.md },
  emptyChatText: { color: colors.textGray, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  bubble: { maxWidth: '80%', borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleSender: { color: colors.primaryLight, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: colors.text },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  bubbleTimeThem: { color: colors.textGray },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  messageInput: {
    flex: 1, backgroundColor: colors.background, borderRadius: 22,
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    color: colors.text, fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  onlineDot:   { width: 8, height: 8, borderRadius: 4 },
  onlineLabel: { fontSize: 11, fontWeight: '600' },
  lastTime:    { fontSize: 10, color: colors.textGray, alignSelf: 'flex-start', marginTop: 2 },
});
