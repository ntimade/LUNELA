import React from 'react';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { useTheme } from './ThemeContext';

// ─── Pont entre notre système de tokens (ThemeContext) et React Native Paper ──
// Traduit nos couleurs (déjà réactives au mode sombre) dans la forme attendue
// par Paper (Material Design 3), pour que TOUS les composants Paper utilisés
// dans src/components/ui/ suivent automatiquement notre thème et le mode sombre.
export default function PaperThemeBridge({ children }) {
  const { isDark, colors, role, radius } = useTheme();
  const base = isDark ? MD3DarkTheme : MD3LightTheme;

  const paperTheme = {
    ...base,
    roundness: radius.md / 4, // Paper multiplie roundness par 4 en interne pour les rayons de composant
    colors: {
      ...base.colors,
      primary: colors.primary,
      onPrimary: '#FFFFFF',
      primaryContainer: colors.primaryLight,
      onPrimaryContainer: colors.primaryDark,
      secondary: colors.secondary,
      onSecondary: '#FFFFFF',
      secondaryContainer: colors.secondaryLight,
      onSecondaryContainer: colors.primaryDark,
      background: colors.background,
      onBackground: colors.text,
      surface: colors.card,
      onSurface: colors.text,
      surfaceVariant: colors.cardLight,
      onSurfaceVariant: colors.textGray,
      outline: colors.border,
      error: colors.error,
      onError: '#FFFFFF',
    },
  };

  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
}
