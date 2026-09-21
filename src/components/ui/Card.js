import React from 'react';
import { Card as PaperCard } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';

// ─── Conteneur carte — sur React Native Paper (Material 3) ─────────────────
// Élévation/forme gérées nativement par Paper (rendu très différent du
// View+StyleSheet fait main utilisé auparavant). `style` s'applique
// directement à la racine du Card (pas de Card.Content intermédiaire) pour
// que les mises en page flexDirection:'row' déjà utilisées par les écrans
// appelants continuent de fonctionner à l'identique.
const SHADOW_TO_ELEVATION = { none: 0, sm: 1, md: 3, lg: 5 };

export default function Card({ children, style, shadow = 'sm', outlined = true, padding = 'lg' }) {
  const { spacing } = useTheme();
  const pad = spacing[padding] ?? spacing.lg;
  return (
    <PaperCard
      mode={outlined ? 'outlined' : 'elevated'}
      elevation={SHADOW_TO_ELEVATION[shadow] ?? 1}
      style={[{ padding: pad }, style]}
    >
      {children}
    </PaperCard>
  );
}
