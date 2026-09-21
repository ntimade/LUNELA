import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

// ─── Barre d'onglets fixe en bas — style plat minimal (icônes seules) ─────
// Remplace le menu hamburger + tiroir. Volontairement épurée (pas de libellés,
// pas de pastille active) pour coller au gabarit de référence fourni par
// l'utilisateur : barre fine, icônes MaterialCommunityIcons espacées, seule
// la couleur change entre onglet actif/inactif.
// `items` : 4 onglets fixes + un dernier onglet `{ name: 'Plus', ... }` qui ouvre
// la grille plein écran. L'onglet Plus reste actif tant que l'écran affiché
// n'est pas l'un des onglets fixes (couvre aussi les écrans ouverts depuis Plus).
export default function TabBar({ items, active, onPress, accentColor, backgroundColor }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = accentColor ?? colors.primary;

  const primaryNames = items.filter(i => i.name !== 'Plus').map(i => i.name);
  const isPrimaryActive = primaryNames.includes(active);

  return (
    <View style={[
      styles.bar,
      { backgroundColor: backgroundColor ?? colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 },
    ]}>
      {items.map((item) => {
        const isActive = item.name === 'Plus' ? !isPrimaryActive : active === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={styles.item}
            onPress={() => onPress(item.name)}
            activeOpacity={0.6}
          >
            <MaterialCommunityIcons name={item.icon} size={25} color={isActive ? accent : colors.textGray} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
});
