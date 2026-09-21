import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { GIRL_CATEGORIES } from './defaultContent';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useEducationContent } from '../../hooks/useEducationContent';

// ─── Formattage du texte (markdown léger) ────────────────────────────────────
// Transforme **texte** en gras et \n en saut de ligne

function FormattedText({ text, style, colors }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <Text key={li} style={[style, li > 0 && { marginTop: 4 }]}>
            {parts.map((part, pi) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <Text key={pi} style={{ fontWeight: '800', color: colors.text }}>
                    {part.slice(2, -2)}
                  </Text>
                );
              }
              return <Text key={pi}>{part}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
}

// ─── Modal article détail ─────────────────────────────────────────────────────

function ArticleModal({ article, categoryColor, onClose, colors, radius, spacing }) {
  const { t } = useLanguage();
  const modal = makeModalStyles(colors, radius, spacing);
  if (!article) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[modal.header, { borderBottomColor: categoryColor + '40' }]}>
          <TouchableOpacity onPress={onClose} style={modal.backBtn}>
            <Ionicons name="arrow-back" size={22} color={categoryColor} />
          </TouchableOpacity>
          <Text style={modal.headerTitle} numberOfLines={1}>{article.title}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={modal.scroll}
        >
          {/* Badge catégorie */}
          <View style={[modal.catBadge, { backgroundColor: categoryColor + '18', borderColor: categoryColor + '40' }]}>
            <Text style={[modal.catBadgeText, { color: categoryColor }]}>
              {article.categoryLabel}
            </Text>
          </View>

          <Text style={modal.title}>{article.title}</Text>

          <View style={[modal.divider, { backgroundColor: categoryColor + '30' }]} />

          <FormattedText text={article.body} style={modal.body} colors={colors} />

          {/* Pied de page conseil */}
          <View style={modal.tipBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={modal.tipText}>
              {t('article_educational_note')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const makeModalStyles = (colors, radius, spacing) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, backgroundColor: colors.card,
  },
  backBtn:     { padding: 6 },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center', marginHorizontal: 8 },
  scroll:      { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: 48 },
  catBadge: {
    alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.pill, borderWidth: 1, marginBottom: 14,
  },
  catBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title:   { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 14, lineHeight: 30 },
  divider: { height: 2, borderRadius: 1, marginBottom: 18 },
  body:    { fontSize: 15, color: colors.textLight, lineHeight: 26 },
  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 28, padding: spacing.md + 2, borderRadius: radius.md,
    backgroundColor: colors.cardLight, borderWidth: 1, borderColor: colors.primaryLight + '44',
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textGray, lineHeight: 19 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function EducationScreen() {
  const { t } = useLanguage();
  const { colors, radius, spacing } = useTheme();
  const styles = makeStyles(colors, radius, spacing);
  const { userRole } = useAuth();
  const targetProfile = userRole === 'boy' ? 'boy' : 'girl';
  const { articles, loading } = useEducationContent();
  const [activeCategory, setActiveCategory] = useState(GIRL_CATEGORIES[0].key);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedColor,   setSelectedColor]   = useState(GIRL_CATEGORIES[0].color);

  const openArticle = useCallback((article, color, categoryLabel) => {
    setSelectedArticle({ ...article, categoryLabel });
    setSelectedColor(color);
  }, []);

  const activeCat   = GIRL_CATEGORIES.find((c) => c.key === activeCategory);
  const activeItems = articles
    .filter(a => a.category === activeCategory
      && (a.targetProfile === targetProfile || a.targetProfile === 'both'))
    .map(a => ({ ...a, sort_order: a.order ?? 0 }));

  return (
    <View style={styles.container}>

      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('nav_education')}</Text>
        <Text style={styles.subtitle}>{t('education_subtitle')}</Text>
      </View>

      {/* Onglets catégories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {GIRL_CATEGORIES.map((cat) => {
          const isActive = cat.key === activeCategory;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tab, isActive && { backgroundColor: cat.color }]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, isActive && { color: '#fff', fontWeight: '700' }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Description catégorie active */}
      {activeCat && (
        <View
          style={[styles.catBanner, { backgroundColor: activeCat.color + '15', borderColor: activeCat.color + '30' }]}
        >
          <Ionicons name={activeCat.icon} size={22} color={activeCat.color} />
          <Text style={[styles.catDesc, { color: activeCat.color }]}>
            {activeCat.description}
          </Text>
        </View>
      )}

      {/* Liste des articles */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {activeItems.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>{t('no_content_category')}</Text>
            </View>
          ) : (
            activeItems
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.articleCard}
                  onPress={() => openArticle(item, activeCat.color, activeCat.label)}
                  activeOpacity={0.85}
                >
                  {/* Numéro */}
                  <View style={[styles.articleNum, { backgroundColor: activeCat.color + '18' }]}>
                    <Text style={[styles.articleNumText, { color: activeCat.color }]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>

                  {/* Texte */}
                  <View style={styles.articleInfo}>
                    <Text style={styles.articleTitle}>{item.title}</Text>
                    <Text style={styles.articlePreview} numberOfLines={2}>
                      {item.body.replace(/\*\*/g, '').split('\n')[0]}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={activeCat.color} />
                </TouchableOpacity>
              ))
          )}

          {/* Bas de page */}
          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.footerNoteText}>
              {t('content_validated_note')}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Modal article */}
      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          categoryColor={selectedColor}
          onClose={() => setSelectedArticle(null)}
          colors={colors}
          radius={radius}
          spacing={spacing}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors, radius, spacing) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  title:  { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textGray, marginTop: 2 },

  // Onglets
  tabsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  tab: {
    alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.cardLight,
  },
  tabLabel: { fontSize: 13, color: colors.textGray, fontWeight: '600' },

  // Bannière catégorie
  catBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.lg, marginBottom: 14,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
  },
  catDesc: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  // Carte article
  articleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  articleNum: {
    width: 40, height: 40, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  articleNumText:  { fontSize: 15, fontWeight: '800' },
  articleInfo:     { flex: 1 },
  articleTitle:    { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  articlePreview:  { fontSize: 12, color: colors.textGray, lineHeight: 17 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 14 },
  emptyText: { color: colors.textGray, textAlign: 'center', fontSize: 15, lineHeight: 22 },

  footerNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', paddingTop: 20,
  },
  footerNoteText: { fontSize: 12, color: colors.textGray },
});
