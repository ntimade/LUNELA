import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { colors, radius, spacing, shadows } = useTheme();
  const styles = makeStyles(colors, radius, spacing);

  const provider = user?.providerData?.[0]?.providerId;
  const providerLabel = provider === 'google.com' ? 'Google'
    : provider === 'facebook.com' ? 'Facebook'
    : 'Email';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.avatarContainer, shadows.lg, { shadowColor: colors.primary }]}>
        <Text style={styles.avatarText}>
          {user?.displayName ? user.displayName[0].toUpperCase() : '?'}
        </Text>
      </View>

      <Text style={styles.welcome}>Bienvenue 🌙</Text>
      <Text style={styles.name}>{user?.displayName || 'Utilisateur'}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>Connecté via {providerLabel}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors, radius, spacing) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, backgroundColor: colors.background },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarText: { fontSize: 38, fontWeight: '800', color: '#fff' },
  welcome: { fontSize: 18, color: colors.textGray, marginBottom: 6 },
  name: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 6 },
  email: { fontSize: 15, color: colors.textGray, marginBottom: spacing.xl },
  badge: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: spacing.xxxl + spacing.sm,
  },
  badgeText: { color: colors.primaryLight, fontWeight: '600', fontSize: 13 },
  logoutButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxxl + spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: '700' },
});
