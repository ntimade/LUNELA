import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Écran temporaire remplacé au fur et à mesure des prompts
export default function Placeholder({ title = 'Écran', icon = 'construct-outline' }) {
  const { colors, spacing } = useTheme();
  const styles = makeStyles(colors, spacing);
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={52} color={colors.border} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>Fonctionnalité en cours de développement</Text>
    </View>
  );
}

const makeStyles = (colors, spacing) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background, padding: spacing.xxxl },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub:   { fontSize: 14, color: colors.textGray, textAlign: 'center' },
});
