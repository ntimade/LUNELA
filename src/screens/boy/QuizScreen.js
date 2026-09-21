import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useQuiz, useQuizQuestions, BADGES } from '../../hooks/useQuiz';
import { useLanguage } from '../../context/LanguageContext';

// ─── Composant : card de badge ────────────────────────────────────────────────
function BadgeCard({ badge, earned, styles, colors }) {
  return (
    <View style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
      <Text style={styles.badgeIcon}>{badge.icon}</Text>
      <Text style={[styles.badgeLabel, !earned && { color: colors.textSecondary }]}>
        {badge.label}
      </Text>
      <Text style={[styles.badgeDesc, !earned && { color: colors.textSecondary }]}>
        {badge.desc}
      </Text>
      {!earned && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={16} color="#94A3B8" />
        </View>
      )}
    </View>
  );
}

// ─── Composant : résumé de progression ───────────────────────────────────────
function ProgressHeader({ progress, accentColor, styles, colors }) {
  const { t } = useLanguage();
  const pct = progress.earnedBadges.length / BADGES.length;

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{progress.totalPoints}</Text>
          <Text style={styles.statLbl}>{t('points_label')}</Text>
        </View>
        <View style={[styles.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }]}>
          <Text style={styles.statNum}>{progress.totalQuizzes}</Text>
          <Text style={styles.statLbl}>{t('quizzes_done_label')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{progress.streak}</Text>
          <Text style={styles.statLbl}>{t('streak_label')}</Text>
        </View>
      </View>

      {/* Barre de progression badges */}
      <View style={{ marginTop: 14 }}>
        <View style={styles.badgeBarRow}>
          <Text style={styles.badgeBarLabel}>{t('badges_count', { n: progress.earnedBadges.length, total: BADGES.length })}</Text>
          <Text style={[styles.badgeBarPct, { color: accentColor }]}>{Math.round(pct * 100)} %</Text>
        </View>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: accentColor }]} />
        </View>
      </View>
    </View>
  );
}

// ─── Composant : carte de topic ───────────────────────────────────────────────
function TopicCard({ topic, completed, onStart, styles, colors }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      onPress={onStart}
      style={[styles.topicCard, { borderLeftColor: topic.color, borderLeftWidth: 4 }]}
      activeOpacity={0.85}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Text style={styles.topicIcon}>{topic.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.topicLabel}>{topic.label}</Text>
          <Text style={styles.topicCount}>{t('questions_count', { n: topic.questions.length })}</Text>
        </View>
        {completed && (
          <View style={[styles.completedBadge, { backgroundColor: topic.color + '20' }]}>
            <Ionicons name="checkmark-circle" size={18} color={topic.color} />
            <Text style={[styles.completedTxt, { color: topic.color }]}>{t('completed_label')}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={{ marginLeft: 4 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Mélange un tableau (Fisher-Yates) sans muter l'original ─────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Composant : session de quiz ──────────────────────────────────────────────
function QuizSession({ topic, accentColor, accentLight, onFinish, onClose, styles, colors }) {
  const { t } = useLanguage();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected,   setSelected]   = useState(null);
  const [confirmed,  setConfirmed]  = useState(false);
  const [answers,    setAnswers]    = useState([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Ordre des questions et des options mélangé à chaque nouvelle session
  const [questions] = useState(() => shuffle(topic.questions).map(question => {
    const optionOrder = shuffle(question.options.map((_, i) => i));
    return {
      ...question,
      options: optionOrder.map(i => question.options[i]),
      correct: optionOrder.indexOf(question.correct),
    };
  }));

  const q = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;

  const choose = (idx) => {
    if (confirmed) return;
    setSelected(idx);
  };

  const confirm = () => {
    if (selected === null) return;
    setConfirmed(true);
  };

  const next = () => {
    const newAnswers = [...answers, { qId: q.id, selected, correct: q.correct }];
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (isLast) {
        const score = newAnswers.filter(a => a.selected === a.correct).length;
        onFinish(score, questions.length, newAnswers);
      } else {
        setAnswers(newAnswers);
        setCurrentIdx(i => i + 1);
        setSelected(null);
        setConfirmed(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      }
    });
  };

  const optionStyle = (idx) => {
    if (!confirmed) {
      return [styles.option, selected === idx && { borderColor: accentColor, backgroundColor: accentLight }];
    }
    if (idx === q.correct)  return [styles.option, styles.optionCorrect];
    if (idx === selected && selected !== q.correct) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDim];
  };

  return (
    <View style={styles.sessionWrap}>
      {/* Header */}
      <View style={styles.sessionHeader}>
        <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.sessionTitle}>{topic.label}</Text>
        <Text style={styles.sessionCount}>{currentIdx + 1}/{questions.length}</Text>
      </View>

      {/* Barre de progression */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${((currentIdx) / questions.length) * 100}%`, backgroundColor: topic.color }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Question */}
          <View style={[styles.questionCard, { borderTopColor: topic.color, borderTopWidth: 3 }]}>
            <Text style={styles.questionText}>{q.text}</Text>
          </View>

          {/* Options */}
          {q.options.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={optionStyle(idx)}
              onPress={() => choose(idx)}
              activeOpacity={0.8}
            >
              <View style={styles.optionBullet}>
                <Text style={styles.optionBulletText}>{String.fromCharCode(65 + idx)}</Text>
              </View>
              <Text style={styles.optionText}>{opt}</Text>
              {confirmed && idx === q.correct && (
                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginLeft: 'auto' }} />
              )}
              {confirmed && idx === selected && selected !== q.correct && (
                <Ionicons name="close-circle" size={20} color="#EF4444" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}

          {/* Explication */}
          {confirmed && (
            <View style={[styles.explanation, { backgroundColor: accentLight }]}>
              <Ionicons name="information-circle" size={18} color={accentColor} />
              <Text style={styles.explanationText}>{q.explanation}</Text>
            </View>
          )}

          {/* Bouton */}
          {!confirmed ? (
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: accentColor, opacity: selected === null ? 0.5 : 1 }]}
              onPress={confirm}
              disabled={selected === null}
            >
              <Text style={styles.confirmBtnText}>{t('validate_action')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: topic.color }]} onPress={next}>
              <Text style={styles.confirmBtnText}>{isLast ? t('see_results') : t('next_question')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Composant : écran de résultats ──────────────────────────────────────────
function ResultScreen({ topic, score, total, points, newBadges, accentColor, onReplay, onBack, styles }) {
  const { t } = useLanguage();
  const pct     = score / total;
  const emoji   = pct === 1 ? '🎉' : pct >= 0.6 ? '👍' : '💪';
  const msg     = pct === 1 ? t('perfect_score') : pct >= 0.6 ? t('good_job') : t('keep_learning');

  return (
    <ScrollView contentContainerStyle={styles.resultWrap}>
      <Text style={styles.resultEmoji}>{emoji}</Text>
      <Text style={styles.resultMsg}>{msg}</Text>
      <Text style={[styles.resultScore, { color: accentColor }]}>{score} / {total}</Text>
      <Text style={styles.resultPoints}>+{points} points</Text>

      {/* Nouveaux badges */}
      {newBadges.length > 0 && (
        <View style={styles.newBadgesWrap}>
          <Text style={styles.newBadgesTitle}>{t('new_badges_title')}</Text>
          {newBadges.map(badgeId => {
            const badge = BADGES.find(b => b.id === badgeId);
            return badge ? (
              <View key={badgeId} style={styles.newBadgeRow}>
                <Text style={styles.newBadgeIcon}>{badge.icon}</Text>
                <View>
                  <Text style={styles.newBadgeLabel}>{badge.label}</Text>
                  <Text style={styles.newBadgeDesc}>{badge.desc}</Text>
                </View>
              </View>
            ) : null;
          })}
        </View>
      )}

      <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: accentColor }]} onPress={onReplay}>
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={[styles.confirmBtnText, { marginLeft: 6 }]}>{t('replay_action')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#64748B', marginTop: 10 }]} onPress={onBack}>
        <Text style={styles.confirmBtnText}>{t('back_to_quizzes')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
// accentColor/accentLight permettent à GirlQuizScreen (navigation/index.js) de
// réutiliser cet écran avec l'identité rose de la fille — par défaut, l'écran
// garçon utilise l'accent bleu fixe (role.boy), non réactif au thème sombre.
export default function QuizScreen({ accentColor, accentLight }) {
  const { t } = useLanguage();
  const { colors, role, spacing, radius, shadows } = useTheme();
  const resolvedAccent      = accentColor ?? role.boy;
  const resolvedAccentLight = accentLight ?? role.boyLight;
  const AMBER = '#F59E0B';
  const styles = makeStyles(colors, resolvedAccent, spacing, radius, shadows);

  const { progress, loading, saveQuizResult } = useQuiz();
  const { topics, loading: topicsLoading } = useQuizQuestions();
  const [tab,            setTab]           = useState('quiz');   // 'quiz' | 'badges'
  const [activeTopic,    setActiveTopic]   = useState(null);
  const [quizResult,     setQuizResult]    = useState(null);     // { score, total, points, newBadges }

  const handleFinish = async (score, total) => {
    const { points, newBadges } = await saveQuizResult(activeTopic.id, score, total);
    setQuizResult({ score, total, points, newBadges });
  };

  // ── Quiz en cours ──────────────────────────────────────────────────────────
  if (activeTopic && !quizResult) {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setActiveTopic(null)} statusBarTranslucent>
        <QuizSession
          topic={activeTopic}
          accentColor={resolvedAccent}
          accentLight={resolvedAccentLight}
          onFinish={handleFinish}
          onClose={() => setActiveTopic(null)}
          styles={styles}
          colors={colors}
        />
      </Modal>
    );
  }

  // ── Résultats ──────────────────────────────────────────────────────────────
  if (activeTopic && quizResult) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => { setActiveTopic(null); setQuizResult(null); }} statusBarTranslucent>
        <ResultScreen
          topic={activeTopic}
          score={quizResult.score}
          total={quizResult.total}
          points={quizResult.points}
          newBadges={quizResult.newBadges}
          accentColor={resolvedAccent}
          onReplay={() => { setQuizResult(null); }}
          onBack={() => { setActiveTopic(null); setQuizResult(null); }}
          styles={styles}
        />
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'quiz' && { borderBottomWidth: 2, borderBottomColor: resolvedAccent }]}
          onPress={() => setTab('quiz')}
        >
          <Ionicons name="help-circle" size={18} color={tab === 'quiz' ? resolvedAccent : colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === 'quiz' && { color: resolvedAccent }]}>{t('quiz_tab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'badges' && { borderBottomWidth: 2, borderBottomColor: AMBER }]}
          onPress={() => setTab('badges')}
        >
          <Ionicons name="trophy" size={18} color={tab === 'badges' ? AMBER : colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === 'badges' && { color: AMBER }]}>{t('badges_tab')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Progression */}
        {!loading && <ProgressHeader progress={progress} accentColor={resolvedAccent} styles={styles} colors={colors} />}

        {tab === 'quiz' && (
          <>
            <Text style={styles.sectionTitle}>{t('choose_category')}</Text>
            {topicsLoading ? (
              <ActivityIndicator color={resolvedAccent} style={{ marginTop: 20 }} />
            ) : (
              topics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  completed={progress.completedTopics.includes(topic.id)}
                  onStart={() => topic.questions.length > 0 && setActiveTopic(topic)}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </>
        )}

        {tab === 'badges' && (
          <>
            <Text style={styles.sectionTitle}>{t('your_badges')}</Text>
            <View style={styles.badgesGrid}>
              {BADGES.map(badge => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  earned={progress.earnedBadges.includes(badge.id)}
                  styles={styles}
                  colors={colors}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors, accent, spacing, radius, shadows) => StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.background },

  // Tabs
  tabs:       { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  tabTxt:     { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  // Progress card
  progressCard:  { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xxl, ...shadows.md },
  progressRow:   { flexDirection: 'row' },
  statBox:       { flex: 1, alignItems: 'center' },
  statNum:       { fontSize: 22, fontWeight: '800', color: colors.text },
  statLbl:       { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  badgeBarRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badgeBarLabel: { fontSize: 12, color: colors.textSecondary },
  badgeBarPct:   { fontSize: 12, fontWeight: '700', color: accent },
  barTrack:      { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill:       { height: 6, backgroundColor: accent, borderRadius: 3 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  // Topic cards
  topicCard:    { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, alignItems: 'center', ...shadows.sm },
  topicIcon:    { fontSize: 26, marginRight: 14 },
  topicLabel:   { fontSize: 15, fontWeight: '700', color: colors.text },
  topicCount:   { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  completedTxt:   { fontSize: 12, fontWeight: '600' },

  // Badges grid
  badgesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  badgeCard:    { width: '46%', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, alignItems: 'center', ...shadows.sm },
  badgeCardLocked: { opacity: 0.55 },
  badgeIcon:    { fontSize: 32, marginBottom: 6 },
  badgeLabel:   { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  badgeDesc:    { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  lockOverlay:  { position: 'absolute', top: 8, right: 8 },

  // Quiz session
  sessionWrap:   { flex: 1, backgroundColor: colors.background },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  sessionTitle:  { fontSize: 15, fontWeight: '700', color: colors.text },
  sessionCount:  { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  questionCard:  { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.xxl, ...shadows.md },
  questionText:  { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 24 },

  option:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: colors.border },
  optionCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionWrong:   { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  optionDim:     { opacity: 0.5 },
  optionBullet:  { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  optionBulletText: { fontSize: 13, fontWeight: '700', color: colors.text },
  optionText:    { flex: 1, fontSize: 14, color: colors.text },

  explanation:   { flexDirection: 'row', borderRadius: radius.md, padding: 14, marginBottom: spacing.lg, gap: 8, alignItems: 'flex-start' },
  explanationText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },

  confirmBtn:    { flexDirection: 'row', backgroundColor: accent, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  confirmBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },

  // Result
  resultWrap:   { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  resultEmoji:  { fontSize: 64, marginBottom: 10 },
  resultMsg:    { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  resultScore:  { fontSize: 36, fontWeight: '900', marginBottom: 4 },
  resultPoints: { fontSize: 16, color: '#F59E0B', fontWeight: '700', marginBottom: spacing.xxl },
  newBadgesWrap:{ width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xxl },
  newBadgesTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  newBadgeRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: spacing.md },
  newBadgeIcon: { fontSize: 28 },
  newBadgeLabel:{ fontSize: 14, fontWeight: '700', color: colors.text },
  newBadgeDesc: { fontSize: 12, color: colors.textSecondary },
});
