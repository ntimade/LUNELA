import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ─── Boîte de dialogue de confirmation cross-plateforme ───────────────────────
// Remplace Alert.alert(title, message, buttons) pour les cas à plusieurs boutons
// personnalisés : react-native-web ne rend pas fiablement ces configurations
// (seul un window.confirm binaire OK/Annuler est supporté nativement par le
// navigateur), ce qui bloque silencieusement l'action au clic. Un Modal
// fonctionne de façon identique sur web et natif.
export default function ConfirmDialog({ visible, title, message, buttons = [], onRequestClose }) {
  const { colors, radius, spacing, semantic } = useTheme();
  const styles = makeStyles(colors, radius, spacing, semantic);

  if (!visible) return null;

  const handlePress = (btn) => {
    onRequestClose?.();
    btn.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonRow}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.button,
                  btn.style === 'cancel' && styles.buttonCancel,
                  btn.style === 'destructive' && styles.buttonDestructive,
                  btn.style !== 'cancel' && btn.style !== 'destructive' && styles.buttonDefault,
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.buttonText,
                  btn.style === 'cancel' && styles.buttonTextCancel,
                  btn.style === 'destructive' && styles.buttonTextDestructive,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors, radius, spacing, semantic) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xxl - 2 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  message: { fontSize: 14, color: colors.textLight, lineHeight: 20, marginBottom: spacing.xxl, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  button: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  buttonDefault: { backgroundColor: colors.primary },
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonDestructive: { backgroundColor: semantic.error },
  buttonText: { fontWeight: '700', fontSize: 14, color: '#fff' },
  buttonTextCancel: { color: colors.textGray },
  buttonTextDestructive: { color: '#fff' },
});
