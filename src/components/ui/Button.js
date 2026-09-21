import React from 'react';
import { Button as PaperButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

// ─── Bouton — sur React Native Paper (Material 3) ──────────────────────────
// Forme/ripple/élévation gérés par Paper (très différent du TouchableOpacity
// fait main utilisé auparavant). Les noms d'icône passés restent au format
// Ionicons (déjà utilisé par tous les écrans appelants) — rendus via une
// icône personnalisée plutôt que le résolveur d'icônes interne de Paper
// (qui attend des noms MaterialCommunityIcons), pour ne rien casser.
export default function Button({
  title, onPress, variant = 'primary', icon,
  loading = false, disabled = false, accentColor, style,
}) {
  const { colors, semantic } = useTheme();
  const accent = variant === 'destructive' ? semantic.error : (accentColor ?? colors.primary);
  const mode = variant === 'outline' ? 'outlined' : 'contained';

  return (
    <PaperButton
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      buttonColor={mode === 'contained' ? accent : undefined}
      textColor={mode === 'outlined' ? accent : '#fff'}
      style={[{ borderRadius: 28, borderColor: mode === 'outlined' ? accent : undefined }, style]}
      contentStyle={{ paddingVertical: 8 }}
      icon={icon ? ({ size, color }) => <Ionicons name={icon} size={size} color={color} /> : undefined}
    >
      {title}
    </PaperButton>
  );
}
