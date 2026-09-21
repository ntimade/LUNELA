import React from 'react';
import { Appbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

// ─── En-tête retour / titre / action — sur React Native Paper (Appbar) ─────
// Remplace l'en-tête fait main dupliqué dans chaque écran gestionnaire admin.
// Rendu très différent (hauteur, élévation, ripple Material) du header
// View+TouchableOpacity utilisé auparavant.
export default function ScreenHeader({
  title, onBack, accentColor,
  rightIcon, onRightPress, rightLabel,
  insetTop = 0,
}) {
  const { colors } = useTheme();
  const accent = accentColor ?? colors.primary;

  return (
    <Appbar.Header
      statusBarHeight={insetTop}
      style={{ backgroundColor: colors.card }}
      elevated
    >
      {onBack && (
        <Appbar.Action
          icon={({ size }) => <Ionicons name="arrow-back" size={size} color={accent} />}
          onPress={onBack}
        />
      )}
      <Appbar.Content title={title} titleStyle={{ fontWeight: '800', color: colors.text }} />
      {onRightPress && rightIcon && (
        <Appbar.Action
          icon={({ size }) => <Ionicons name={rightIcon} size={size} color="#fff" />}
          onPress={onRightPress}
          style={{ backgroundColor: accent, marginRight: 8, borderRadius: 12 }}
        />
      )}
    </Appbar.Header>
  );
}
