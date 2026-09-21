import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import PaperThemeBridge from './src/context/PaperThemeBridge';
import { LanguageProvider } from './src/context/LanguageContext';
import Navigation from './src/navigation';
import { getDb } from './src/db/database';
import { syncAll } from './src/db/syncService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>❌ Erreur détectée</Text>
          <ScrollView style={eb.scroll}>
            <Text style={eb.message}>{this.state.error?.message || String(this.state.error)}</Text>
            <Text style={eb.stack}>{this.state.error?.stack}</Text>
          </ScrollView>
          <TouchableOpacity style={eb.btn} onPress={() => this.setState({ error: null })}>
            <Text style={eb.btnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff8f6', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#EF4444', marginBottom: 16 },
  scroll: { maxHeight: 400, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 },
  message: { fontSize: 15, color: '#1A1A2E', fontWeight: '600', marginBottom: 8 },
  stack: { fontSize: 11, color: '#6B7280', fontFamily: 'monospace' },
  btn: { backgroundColor: '#FF6B35', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

function AppBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    // Initialise SQLite dès le démarrage
    getDb().catch(() => {});
  }, []);

  useEffect(() => {
    // Sync dès qu'un utilisateur est connecté
    if (user?.uid) syncAll(user.uid).catch(() => {});
  }, [user?.uid]);

  return <Navigation />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <PaperThemeBridge>
              <LanguageProvider>
                <AuthProvider>
                  <AppBootstrap />
                </AuthProvider>
              </LanguageProvider>
            </PaperThemeBridge>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
