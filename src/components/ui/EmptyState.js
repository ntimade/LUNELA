import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

// ─── État vide standard — typographie Material (Paper) ─────────────────────
export default function EmptyState({ icon = 'file-tray-outline', title, text, style }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingTop: spacing.xxxl + spacing.lg, paddingHorizontal: spacing.xl, gap: spacing.sm }, style]}>
      <Ionicons name={icon} size={44} color={colors.border} />
      {!!title && <Text variant="titleMedium" style={{ color: colors.text, marginTop: spacing.sm, textAlign: 'center' }}>{title}</Text>}
      {!!text && <Text variant="bodyMedium" style={{ color: colors.textGray, textAlign: 'center' }}>{text}</Text>}
    </View>
  );
}
