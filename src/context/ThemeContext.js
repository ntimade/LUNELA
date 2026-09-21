import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS as LIGHT_COLORS, GRADIENTS as LIGHT_GRADIENTS } from '../config/colors';

const THEME_KEY = 'lunela_theme';

// ─── Palette sombre ───────────────────────────────────────────────────────────
// Conserve l'identité indigo/corail de LUNELA sur fond sombre plutôt que
// d'inverser bêtement le clair — les dégradés de marque restent identiques.
export const DARK_COLORS = {
  primary: '#818CF8',
  primaryDark: '#4F46E5',
  primaryLight: '#C7D2FE',
  secondary: '#FF8B6E',
  secondaryLight: '#FFC4B4',
  background: '#121022',
  card: '#1D1B32',
  cardLight: '#26233F',
  text: '#F5F3F7',
  textGray: '#A6A3C4',
  textSecondary: '#A6A3C4',
  textLight: '#D8D5EA',
  google: '#EA4335',
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
  border: '#332F52',
  overlay: 'rgba(0,0,0,0.65)',
};

export const DARK_GRADIENTS = {
  primary: ['#4F46E5', '#FF6B4A'],
  background: ['#121022', '#1D1B32'],
  card: ['#1D1B32', '#26233F'],
  header: ['#4F46E5', '#3730A3'],
  warm: ['#FF8B6E', '#FF6B4A'],
  rose: ['#4F46E5', '#3730A3'],
};

// ─── Couleurs de rôle ─────────────────────────────────────────────────────────
// Distinctes du nouveau primaire indigo pour que chaque profil garde sa
// propre identité visuelle, identiques en clair et en sombre.
export const ROLE_COLORS = {
  girl:       '#FB4FEA',
  girlLight:  '#FDE6FA',
  boy:        '#0284C7',
  boyLight:   '#D6F0FF',
  specialist: '#0D9488',
  specialistLight: '#CCFBF1',
  admin:      '#059669',
  adminLight: '#D1FAE5',
};

export const ROLE_GRADIENTS = {
  girl:       ['#FB4FEA', '#C026D3'],
  boy:        ['#0284C7', '#075985'],
  specialist: ['#0D9488', '#0F766E'],
  admin:      ['#059669', '#065F46'],
};

// ─── Couleurs sémantiques (identiques clair/sombre, pour rester lisibles) ─────
export const SEMANTIC_COLORS = {
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#0284C7',
};

// ─── Échelle d'espacement ──────────────────────────────────────────────────────
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// ─── Échelle de rayons de bordure ──────────────────────────────────────────────
export const RADIUS = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

// ─── Préréglages d'ombre (iOS shadow* + Android elevation) ────────────────────
export const SHADOWS = {
  sm: { elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  md: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  lg: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
};

// ─── Échelle typographique ─────────────────────────────────────────────────────
// `color` est ajouté à l'usage via le token de couleur du thème courant.
export const TYPOGRAPHY = {
  h1:       { fontSize: 26, fontWeight: '800' },
  h2:       { fontSize: 20, fontWeight: '800' },
  h3:       { fontSize: 17, fontWeight: '700' },
  body:     { fontSize: 14, fontWeight: '500' },
  bodyBold: { fontSize: 14, fontWeight: '700' },
  caption:  { fontSize: 12, fontWeight: '600' },
  micro:    { fontSize: 11, fontWeight: '600' },
};

const ThemeContext = createContext({
  isDark: false,
  colors: LIGHT_COLORS,
  gradients: LIGHT_GRADIENTS,
  role: ROLE_COLORS,
  roleGradients: ROLE_GRADIENTS,
  semantic: SEMANTIC_COLORS,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  typography: TYPOGRAPHY,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => { if (v === 'dark') setIsDark(true); });
  }, []);

  const toggleTheme = useCallback(async () => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  const value = {
    isDark,
    colors:        isDark ? DARK_COLORS    : LIGHT_COLORS,
    gradients:     isDark ? DARK_GRADIENTS : LIGHT_GRADIENTS,
    role:          ROLE_COLORS,
    roleGradients: ROLE_GRADIENTS,
    semantic:      SEMANTIC_COLORS,
    spacing:       SPACING,
    radius:        RADIUS,
    shadows:       SHADOWS,
    typography:    TYPOGRAPHY,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
