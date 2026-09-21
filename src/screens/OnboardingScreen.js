import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, Animated, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { width, height } = Dimensions.get('window');

// Palette limitée à indigo/corail (identité de marque générale) — le rose
// est réservé au profil féminin, jamais utilisé sur cet écran générique
// affiché avant tout choix de profil.
const SLIDES_KEYS = [
  {
    key:       'welcome',
    icon:      'moon',
    iconColor: '#fff',
    gradient:  ['#4F46E5', '#3730A3'],
    titleKey:     'onboard_title_1',
    subtitleKey:  'onboard_sub_1',
    accent:    '#4F46E5',
  },
  {
    key:       'cycle',
    icon:      'calendar',
    iconColor: '#fff',
    gradient:  ['#FF6B4A', '#C2410C'],
    titleKey:     'onboard_title_2',
    subtitleKey:  'onboard_sub_2',
    accent:    '#FF6B4A',
  },
  {
    key:       'specialist',
    icon:      'chatbubbles',
    iconColor: '#fff',
    gradient:  ['#6366F1', '#4338CA'],
    titleKey:     'onboard_title_3',
    subtitleKey:  'onboard_sub_3',
    accent:    '#6366F1',
  },
  {
    key:       'private',
    icon:      'shield-checkmark',
    iconColor: '#fff',
    gradient:  ['#FF8B6E', '#EA580C'],
    titleKey:     'onboard_title_4',
    subtitleKey:  'onboard_sub_4',
    accent:    '#FF8B6E',
  },
];

export const ONBOARDING_KEY = '@lunela_onboarding_done';

export default function OnboardingScreen({ onDone }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const SLIDES = SLIDES_KEYS.map(sl => ({ ...sl, title: t(sl.titleKey), subtitle: t(sl.subtitleKey) }));
  const [current, setCurrent] = useState(0);
  const flatRef  = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (index) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    flatRef.current?.scrollToIndex({ index, animated: true });
    setCurrent(index);
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      finish();
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone?.();
  };

  const slide = SLIDES[current];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Slides (FlatList invisible, on gère la navigation manuellement) */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={s => s.key}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <View style={[styles.slideGradient, { backgroundColor: item.accent }]}>
              {/* Icône */}
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name={item.icon} size={64} color={item.iconColor} />
              </View>

              {/* Texte */}
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      {/* ── Panel bas ──────────────────────────────────────────────────────── */}
      <View style={styles.panel}>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <TouchableOpacity key={s.key} onPress={() => goTo(i)}>
              <View style={[
                styles.dot,
                { backgroundColor: i === current ? slide.accent : colors.border,
                  width: i === current ? 24 : 8 },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Bouton principal */}
        <TouchableOpacity
          onPress={next}
          activeOpacity={0.88}
          style={[styles.nextBtn, { backgroundColor: slide.accent }]}
        >
          <Text style={styles.nextBtnText}>
            {current === SLIDES.length - 1 ? t('start_action') : t('next_action')}
          </Text>
          <Ionicons
            name={current === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={20} color="#fff"
          />
        </TouchableOpacity>

        {/* Passer */}
        {current < SLIDES.length - 1 && (
          <TouchableOpacity onPress={finish} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('skip_action')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#0F172A' },

  slideGradient: {
    width, height: height * 0.68,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },

  iconWrap: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
  },
  slideTitle:    { fontSize: 34, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 42, marginBottom: 16 },
  slideSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24 },

  // Panel bas
  panel: {
    flex: 1, backgroundColor: colors.background,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
    alignItems: 'center',
  },

  // Dots
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 28 },
  dot:  { height: 8, borderRadius: 4 },

  // Bouton suivant
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 999, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 6,
    minWidth: 220, justifyContent: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  skipBtn:  { paddingVertical: 8, paddingHorizontal: 20 },
  skipText: { color: colors.textSecondary, fontSize: 14 },
});
