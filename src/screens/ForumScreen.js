import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, doc, updateDoc, increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth, ROLES } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

// Nom anonyme stable par UID
const anonName = (uid) => {
  const names = ['Lune', 'Étoile', 'Aurore', 'Jade', 'Iris', 'Rose', 'Aube', 'Perle', 'Fée', 'Nova'];
  return `${names[uid.charCodeAt(0) % names.length]}${uid.slice(-3)}`;
};

const fmtDate = (ts, t, locale = 'fr-FR') => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1)  return t('just_now');
  if (diff < 60) return t('minutes_ago', { n: diff });
  if (diff < 1440) return t('hours_ago', { n: Math.floor(diff / 60) });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

const CATEGORIES = ['Tous', 'Cycle', 'Symptômes', 'Santé', 'Relations', 'Éducation', 'Autre'];
const buildCatColors = (colors, role, semantic) => ({
  Cycle: role.girl, Symptômes: semantic.warning, Santé: semantic.success,
  Relations: colors.secondary, Éducation: semantic.info, Autre: colors.textGray,
});

const REPORT_REASONS = ['Spam', 'Contenu inapproprié', 'Harcèlement', 'Fausse information', 'Autre'];

// Enregistre un signalement (post ou réponse) pour revue par la modération
const submitReport = async ({ postId, replyId, authorId, text }, reason, reporterId) => {
  await addDoc(collection(db, 'forum_reports'), {
    postId,
    replyId: replyId ?? null,
    reportedAuthorId: authorId ?? null,
    reporterId,
    reason,
    contentSnapshot: (text || '').slice(0, 300),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
};

// ─── Modal : signaler un contenu ──────────────────────────────────────────────
function ReportModal({ target, onClose, onSubmit, colors, semantic, s }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!target) return null;

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await onSubmit(reason);
      Alert.alert(t('thanks_label'), t('report_transmitted'));
    } catch (_) {
      Alert.alert(t('error_generic'), t('report_send_error'));
    } finally {
      setSubmitting(false);
      setReason(null);
    }
  };

  return (
    <View style={s.modalOverlay}>
      <View style={s.modalCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={s.modalTitle}>{t('report_content_title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={s.reportSub}>{t('report_content_why')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {REPORT_REASONS.map(r => (
            <TouchableOpacity
              key={r}
              onPress={() => setReason(r)}
              style={[s.catChip, reason === r && { backgroundColor: semantic.error, borderColor: semantic.error }]}
            >
              <Text style={[s.catTxt, reason === r && { color: '#fff' }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[s.postBtn, (!reason || submitting) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!reason || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.postBtnTxt}>{t('send_report_action')}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Réponses d'un post ───────────────────────────────────────────────────────
function RepliesView({ postId, onBack, colors, semantic, s }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { user, userRole, specialistStatus } = useAuth();
  const isSpecialist = userRole === ROLES.SPECIALIST || specialistStatus === 'approved';
  const insets   = useSafeAreaInsets();
  const [post,    setPost]    = useState(null);
  const [replies, setReplies] = useState([]);
  const [input,   setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const flatRef = useRef(null);

  useEffect(() => {
    const unsub1 = onSnapshot(doc(db, 'forum_posts', postId), s => setPost({ id: s.id, ...s.data() }));
    const q      = query(collection(db, 'forum_posts', postId, 'replies'), orderBy('createdAt', 'asc'));
    const unsub2 = onSnapshot(q, s => {
      setReplies(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => { unsub1(); unsub2(); };
  }, [postId]);

  const send = async () => {
    if (!input.trim() || !user) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'forum_posts', postId, 'replies'), {
        text:         input.trim(),
        authorId:     user.uid,
        anonName:     isSpecialist ? t('specialist_professional_label') : anonName(user.uid),
        isSpecialist,
        createdAt:    serverTimestamp(),
      });
      await updateDoc(doc(db, 'forum_posts', postId), { replyCount: increment(1) });
      setInput('');
    } catch (_) {
      Alert.alert(t('error_generic'), t('reply_send_error'));
    } finally { setSending(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{post?.title || t('discussion_default')}</Text>
        </View>

        {/* Post original */}
        {post && (
          <View style={s.origPost}>
            <Text style={s.origText}>{post.text}</Text>
            <View style={s.origFooter}>
              <Text style={s.origMeta}>{post.anonName} · {fmtDate(post.createdAt, t, locale)}</Text>
              {post.authorId !== user?.uid && (
                <TouchableOpacity
                  onPress={() => setReportTarget({ postId, authorId: post.authorId, text: post.text })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="flag-outline" size={14} color={colors.textGray} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Réponses */}
        <FlatList
          ref={flatRef}
          data={replies}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.border} />
              <Text style={{ color: colors.textGray, marginTop: 8 }}>{t('be_first_to_reply')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.authorId === user?.uid;
            return (
              <View style={[s.replyBubble, isMe ? s.replyMe : s.replyThem, item.isSpecialist && !isMe && s.replySpecialist]}>
                {!isMe && (
                  <View style={s.replyAuthorRow}>
                    <Text style={[s.replyAuthor, item.isSpecialist && { color: semantic.success }]}>{item.anonName}</Text>
                    {item.isSpecialist && <Ionicons name="checkmark-circle" size={12} color={semantic.success} />}
                  </View>
                )}
                <Text style={[s.replyText, { color: isMe ? '#fff' : colors.text }]}>{item.text}</Text>
                <View style={s.replyFooter}>
                  <Text style={[s.replyTime, { color: isMe ? 'rgba(255,255,255,0.6)' : colors.textGray }]}>
                    {fmtDate(item.createdAt, t, locale)}
                  </Text>
                  {!isMe && (
                    <TouchableOpacity
                      onPress={() => setReportTarget({ postId, replyId: item.id, authorId: item.authorId, text: item.text })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="flag-outline" size={12} color={colors.textGray} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />

        {/* Saisie */}
        <View style={[s.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={s.input}
            placeholder={t('reply_placeholder')}
            placeholderTextColor={colors.textGray}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={400}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && { backgroundColor: colors.border }]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ReportModal
          target={reportTarget}
          onClose={() => setReportTarget(null)}
          onSubmit={(reason) => submitReport(reportTarget, reason, user.uid).finally(() => setReportTarget(null))}
          colors={colors}
          semantic={semantic}
          s={s}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Écran principal Forum ────────────────────────────────────────────────────
export default function ForumScreen({ onBack }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const { colors, role, semantic, radius, spacing } = useTheme();
  const s = makeStyles(colors, radius, spacing);
  const CAT_COLORS = buildCatColors(colors, role, semantic);
  const { user, userRole, specialistStatus } = useAuth();
  const isSpecialist = userRole === ROLES.SPECIALIST || specialistStatus === 'approved';
  const insets     = useSafeAreaInsets();
  const [posts,    setPosts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [cat,      setCat]      = useState('Tous');
  const [showNew,  setShowNew]  = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText,  setNewText]  = useState('');
  const [newCat,   setNewCat]   = useState('Autre');
  const [posting,  setPosting]  = useState(false);
  const [openPost, setOpenPost] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);

  useEffect(() => {
    const q    = query(collection(db, 'forum_posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const createPost = async () => {
    if (!newTitle.trim() || !newText.trim() || !user) return;
    setPosting(true);
    try {
      await addDoc(collection(db, 'forum_posts'), {
        title:        newTitle.trim(),
        text:         newText.trim(),
        category:     newCat,
        authorId:     user.uid,
        anonName:     isSpecialist ? t('specialist_professional_label') : anonName(user.uid),
        isSpecialist,
        replyCount:   0,
        createdAt:    serverTimestamp(),
      });
      setNewTitle(''); setNewText(''); setShowNew(false);
    } catch (_) {
      Alert.alert(t('error_generic'), t('publish_post_error'));
    } finally { setPosting(false); }
  };

  if (openPost) {
    return <RepliesView postId={openPost} onBack={() => setOpenPost(null)} colors={colors} semantic={semantic} s={s} />;
  }

  const filtered = cat === 'Tous' ? posts : posts.filter(p => p.category === cat);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header — le titre "Forum Anonyme" n'est répété que si l'écran gère
          sa propre navigation (usage autonome, ex. SpecialistDashboard).
          Intégré dans AppShell, le titre est déjà affiché par la barre du haut. */}
      <View style={[s.header, { paddingTop: onBack ? insets.top + 12 : 12 }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onBack
          ? <Text style={s.headerTitle}>{t('forum_title')}</Text>
          : <View style={{ flex: 1 }} />
        }
        <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.newBtnTxt}>{t('post_action')}</Text>
        </TouchableOpacity>
      </View>

      {/* Badge anonymat */}
      <View style={s.anonBanner}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.primaryLight} />
        <Text style={s.anonTxt}>
          {isSpecialist
            ? ' ' + t('specialist_reply_note')
            : <> {t('you_appear_as')}<Text style={{ fontWeight: '800' }}>{user ? anonName(user.uid) : '—'}</Text></>
          }
        </Text>
      </View>

      {/* Filtres catégories */}
      <FlatList
        horizontal
        style={s.catList}
        data={CATEGORIES}
        keyExtractor={c => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setCat(item)}
            style={[s.catChip, cat === item && { backgroundColor: CAT_COLORS[item] || colors.primary }]}
          >
            <Text style={[s.catTxt, cat === item && { color: '#fff' }]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Liste des posts */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text style={{ color: colors.textGray, marginTop: 12, fontSize: 15 }}>
                {t('no_discussion_yet')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.postCard} onPress={() => setOpenPost(item.id)} activeOpacity={0.85}>
              <View style={s.postTop}>
                <View style={[s.catBadge, { backgroundColor: (CAT_COLORS[item.category] || colors.primary) + '20' }]}>
                  <Text style={[s.catBadgeTxt, { color: CAT_COLORS[item.category] || colors.primary }]}>
                    {item.category}
                  </Text>
                </View>
                <Text style={s.postTime}>{fmtDate(item.createdAt, t, locale)}</Text>
              </View>
              <Text style={s.postTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={s.postText} numberOfLines={2}>{item.text}</Text>
              <View style={s.postFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons
                    name={item.isSpecialist ? 'checkmark-circle' : 'eye-off-outline'}
                    size={12}
                    color={item.isSpecialist ? semantic.success : colors.textGray}
                  />
                  <Text style={[s.postAuthor, item.isSpecialist && { color: semantic.success }]}>
                    {item.anonName}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={s.replyCount}>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.textGray} />
                    <Text style={s.replyCountTxt}>{item.replyCount || 0}</Text>
                  </View>
                  {item.authorId !== user?.uid && (
                    <TouchableOpacity
                      onPress={() => setReportTarget({ postId: item.id, authorId: item.authorId, text: item.text })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="flag-outline" size={13} color={colors.textGray} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal nouveau post */}
      {showNew && (
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={s.modalTitle}>{t('new_discussion_title')}</Text>
              <TouchableOpacity onPress={() => setShowNew(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.modalInput}
              placeholder={t('question_title_placeholder')}
              placeholderTextColor={colors.textGray}
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={100}
            />
            <TextInput
              style={[s.modalInput, { height: 90, textAlignVertical: 'top' }]}
              placeholder={t('describe_situation_placeholder')}
              placeholderTextColor={colors.textGray}
              value={newText}
              onChangeText={setNewText}
              multiline
              maxLength={500}
            />

            {/* Catégorie */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {CATEGORIES.filter(c => c !== 'Tous').map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setNewCat(c)}
                  style={[s.catChip, newCat === c && { backgroundColor: CAT_COLORS[c] || colors.primary }]}
                >
                  <Text style={[s.catTxt, newCat === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.postBtn, (!newTitle.trim() || !newText.trim()) && { opacity: 0.5 }]}
              onPress={createPost}
              disabled={!newTitle.trim() || !newText.trim() || posting}
            >
              {posting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.postBtnTxt}>{t('publish_anonymously')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ReportModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={(reason) => submitReport(reportTarget, reason, user.uid).finally(() => setReportTarget(null))}
        colors={colors}
        semantic={semantic}
        s={s}
      />
    </View>
  );
}

const makeStyles = (colors, radius, spacing) => StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 },
  backBtn:   { padding: spacing.sm, marginRight: spacing.sm },
  newBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 7 },
  newBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  anonBanner:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 7, backgroundColor: colors.primaryLight + '18' },
  anonTxt:   { color: colors.primaryLight, fontSize: 12 },

  catList:   { flexGrow: 0, flexShrink: 0, maxHeight: 52 },
  catChip:   { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  catTxt:    { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  postCard:  { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border },
  postTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  catBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeTxt:{ fontSize: 11, fontWeight: '700' },
  postTime:  { fontSize: 11, color: colors.textGray },
  postTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  postText:  { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  postFooter:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postAuthor:{ fontSize: 11, color: colors.textGray, fontWeight: '600' },
  replyCount:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyCountTxt:{ fontSize: 12, color: colors.textGray },

  origPost:  { margin: spacing.md, backgroundColor: colors.primary + '15', borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  origText:  { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  origFooter:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  origMeta:  { color: colors.textGray, fontSize: 11 },

  replyBubble:{ maxWidth: '82%', borderRadius: radius.lg, padding: 10, marginBottom: 4 },
  replyMe:    { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  replyThem:  { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  replySpecialist: { borderColor: colors.success, borderWidth: 1.5, backgroundColor: colors.success + '15' },
  replyAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  replyAuthor:{ color: colors.primaryLight, fontSize: 10, fontWeight: '700' },
  replyText:  { fontSize: 14, lineHeight: 20 },
  replyFooter:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 3 },
  replyTime:  { fontSize: 9 },

  inputBar:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  input:     { flex: 1, backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm, color: colors.text, fontSize: 14, maxHeight: 90, borderWidth: 1, borderColor: colors.border },
  sendBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },

  modalOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: colors.text },
  reportSub:   { fontSize: 13, color: colors.textGray, marginBottom: spacing.md + 2 },
  modalInput:  { backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm + 2 },
  postBtn:     { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center' },
  postBtnTxt:  { color: '#fff', fontWeight: '800', fontSize: 15 },
});
