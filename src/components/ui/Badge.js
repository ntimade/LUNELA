import React from 'react';
import { Badge as PaperBadge } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';

// ─── Pastille de statut / compteur — sur React Native Paper (Material 3) ───
export default function Badge({ label, count, color, style }) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  const content = label ?? count;

  return (
    <PaperBadge
      visible
      size={22}
      style={[
        { backgroundColor: accent, color: '#fff', fontWeight: '800', alignSelf: 'center', position: 'relative', paddingHorizontal: label ? 8 : 0 },
        style,
      ]}
    >
      {content}
    </PaperBadge>
  );
}
