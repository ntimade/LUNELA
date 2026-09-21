import React from 'react';
import { Chip as PaperChip } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';

// ─── Pastille de filtre / catégorie — sur React Native Paper (Material 3) ──
// Remplace le pattern filterChip/catChip fait main : forme, coche de
// sélection et couleurs gérées nativement par Paper.
export default function Chip({ label, active = false, onPress, color, style }) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;

  return (
    <PaperChip
      mode={active ? 'flat' : 'outlined'}
      selected={active}
      onPress={onPress}
      showSelectedCheck={active}
      style={[
        { marginRight: 8, backgroundColor: active ? accent : colors.card, borderColor: accent },
        style,
      ]}
      textStyle={{ color: active ? '#fff' : accent, fontWeight: '600', fontSize: 12 }}
    >
      {label}
    </PaperChip>
  );
}
