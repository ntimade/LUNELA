import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, ROLES } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import SideMenu, { MENU_ITEMS_GIRL, MENU_ITEMS_BOY } from '../components/SideMenu';
import TabBar from '../components/TabBar';

// ─── Auth ─────────────────────────────────────────────────────────────────────
import WelcomeScreen          from '../screens/auth/WelcomeScreen';
import LoginScreen            from '../screens/auth/LoginScreen';
import RegisterScreen         from '../screens/auth/RegisterScreen';
import VerifyEmailScreen      from '../screens/auth/VerifyEmailScreen';
import PendingApprovalScreen  from '../screens/auth/PendingApprovalScreen';
import AdminRegisterScreen    from '../screens/auth/AdminRegisterScreen';
import SpecialistRegisterScreen from '../screens/auth/SpecialistRegisterScreen';

// ─── Écrans communs ───────────────────────────────────────────────────────────
import CycleScreen          from '../screens/cycle/CycleScreen';
import ChatScreen           from '../screens/chat/ChatScreen';
import ProfileScreen        from '../screens/profile/ProfileScreen';
import ContraceptivesScreen from '../screens/contraceptives/ContraceptivesScreen';
import SurveyGate           from '../screens/SurveyGate';

// ─── Écrans Fille ─────────────────────────────────────────────────────────────
import SymptomsScreen from '../screens/symptoms/SymptomsScreen';
import EducationScreen from '../screens/education/EducationScreen';

// ─── Écrans Garçon ────────────────────────────────────────────────────────────
import HealthScreen from '../screens/boy/HealthScreen';
import UnderstandCycleScreen from '../screens/boy/UnderstandCycleScreen';
import QuizScreen     from '../screens/boy/QuizScreen';
import PartnerScreen         from '../screens/boy/PartnerScreen';
import ResponsibilityScreen  from '../screens/boy/ResponsibilityScreen';

// ─── Admin ────────────────────────────────────────────────────────────────────
import AdminDashboard           from '../screens/admin/AdminDashboard';
import SpecialistApprovalScreen from '../screens/admin/SpecialistApprovalScreen';
import SurveyManagerScreen      from '../screens/admin/SurveyManagerScreen';
import CreateSurveyScreen       from '../screens/admin/CreateSurveyScreen';
import SurveyReportScreen       from '../screens/admin/SurveyReportScreen';
import AdminManagementScreen    from '../screens/admin/AdminManagementScreen';
import ContraceptivesManagerScreen from '../screens/admin/ContraceptivesManagerScreen';
import ForumModerationScreen    from '../screens/admin/ForumModerationScreen';
import QuizManagerScreen        from '../screens/admin/QuizManagerScreen';
import EducationManagerScreen   from '../screens/admin/EducationManagerScreen';

// ─── Spécialiste / Personnel de santé ────────────────────────────────────────
import SpecialistDashboard from '../screens/specialist/SpecialistDashboard';
import BecomeSpecialistScreen from '../screens/specialist/BecomeSpecialistScreen';
import SpecialistApplicationStatus from '../screens/specialist/SpecialistApplicationStatus';
import OnboardingScreen, { ONBOARDING_KEY } from '../screens/OnboardingScreen';
import ForumScreen from '../screens/ForumScreen';

const Stack = createNativeStackNavigator();

// QuizScreen est conçu pour le profil garçon (palette bleue) ; on l'accentue en
// rose/orange pour le profil fille sans dupliquer l'écran.
function GirlQuizScreen() {
  const { colors } = useTheme();
  return <QuizScreen accentColor={colors.primary} accentLight={colors.primary + '15'} />;
}

// ─── Titres par écran (clés de traduction) ────────────────────────────────────
const GIRL_TITLES = {
  Cycle:       'nav_cycle',
  Symptomes:   'nav_symptoms',
  Education:   'nav_education',
  Quiz:        'nav_quiz',
  Forum:       'nav_forum',
  Chat:        'nav_chat',
  Profil:      'nav_profile',
  BecomeSpecialist:  'nav_become_specialist',
  SpecialistPending: 'nav_specialist_pending',
  SpecialistHub:     'nav_specialist_space',
};

const BOY_TITLES = {
  MaSante:        'nav_health',
  Comprendre:     'nav_understand',
  Quiz:           'nav_quiz',
  Partenaire:     'nav_partner',
  Responsabilite: 'nav_responsibility',
  Forum:          'nav_forum',
  Chat:           'nav_chat',
  Profil:         'nav_profile',
  BecomeSpecialist:  'nav_become_specialist',
  SpecialistPending: 'nav_specialist_pending',
  SpecialistHub:     'nav_specialist_space',
};

// Entrée de menu additionnelle fusionnée selon le statut de candidature
// spécialiste — permet à un compte fille/garçon d'accéder progressivement
// au formulaire, au statut d'attente, puis à l'espace spécialiste complet,
// sans jamais quitter son menu habituel.
const specialistMenuExtra = (status) => {
  if (status === 'approved') return { name: 'SpecialistHub',     labelKey: 'nav_specialist_space',   icon: 'medkit-outline', lib: 'Ionicons' };
  if (status === 'pending' || status === 'blocked')
                             return { name: 'SpecialistPending', labelKey: 'nav_specialist_pending', icon: 'time-outline',   lib: 'Ionicons' };
  return                            { name: 'BecomeSpecialist',  labelKey: 'nav_become_specialist',  icon: 'medkit-outline', lib: 'Ionicons' };
};

const LEGACY_TITLES = {
  Cycle:         'nav_cycle',
  Contraceptifs: 'nav_contraceptives',
  Chat:          'nav_chat',
  Profil:        'nav_profile',
};

// ─── Composant App générique (réutilisé par GirlApp, BoyApp, UserApp) ─────────
// Barre d'onglets fixe en bas (au lieu du menu hamburger + tiroir) : `tabs`
// contient les 4 onglets visibles + un onglet "Plus" qui ouvre la grille
// plein écran (`overflowItems`) pour le reste. Le profil garçon garde
// volontairement sa palette bleue fixe : le mode sombre n'est pour l'instant
// proposé qu'aux profils fille / spécialiste / legacy.
function AppShell({ defaultScreen, titles, tabs, overflowItems, renderScreen, accentColor, isBoyTheme = false }) {
  const { colors, role, spacing, radius, shadows } = useTheme();
  const { t } = useLanguage();
  const chrome = isBoyTheme ? boyFixedLight(role) : colors;
  const resolvedAccent = accentColor ?? chrome.primary;
  const styles = makeShellStyles(chrome, spacing, radius, shadows);
  const [plusOpen,     setPlusOpen]     = useState(false);
  const [activeScreen, setActiveScreen] = useState(defaultScreen);
  const insets = useSafeAreaInsets();

  const handleTabPress = (name) => {
    if (name === 'Plus') { setPlusOpen(true); return; }
    setActiveScreen(name);
  };

  return (
    <View style={{ flex: 1, backgroundColor: chrome.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle} numberOfLines={1}>{t(titles[activeScreen] ?? activeScreen)}</Text>
      </View>

      {/* Contenu */}
      <View style={{ flex: 1 }}>
        {renderScreen(activeScreen, setActiveScreen)}
      </View>

      {/* Barre d'onglets */}
      <TabBar items={tabs} active={activeScreen} onPress={handleTabPress} accentColor={resolvedAccent} backgroundColor={chrome.card} />

      {/* Grille "Plus" plein écran */}
      <SideMenu
        visible={plusOpen}
        onClose={() => setPlusOpen(false)}
        activeScreen={activeScreen}
        onNavigate={(name) => setActiveScreen(name)}
        menuItems={overflowItems}
        accentColor={resolvedAccent}
        chromeColors={chrome}
      />
    </View>
  );
}

// Palette claire fixe utilisée pour le profil garçon (indépendante du thème global).
// Dérivée de `role.boy` / `role.boyLight` pour rester cohérente avec la couleur de
// marque du profil garçon, tout en gardant un chrome toujours clair (voir note ci-dessus).
const boyFixedLight = (role) => ({
  background: '#EFF9FF',
  card: '#FFFFFF',
  cardLight: role.boyLight,
  border: '#B8E6FF',
  text: '#1A1A2E',
  textGray: '#6B7280',
  primary: role.boy,
  error: '#EF4444',
});

// ─── Onglets fixes (barre du bas) — icônes MaterialCommunityIcons ────────────
const TABS_GIRL = [
  { name: 'Cycle',     labelKey: 'nav_cycle',     icon: 'moon-waning-crescent' },
  { name: 'Education', labelKey: 'nav_education', icon: 'book-open-page-variant' },
  { name: 'Forum',     labelKey: 'nav_forum',     icon: 'forum' },
  { name: 'Profil',    labelKey: 'nav_profile',   icon: 'account-circle' },
  { name: 'Plus',      labelKey: 'nav_more',      icon: 'view-grid-plus' },
];

const TABS_BOY = [
  { name: 'MaSante',    labelKey: 'nav_health',           icon: 'heart-pulse' },
  { name: 'Comprendre', labelKey: 'nav_understand_short', icon: 'school' },
  { name: 'Forum',      labelKey: 'nav_forum',            icon: 'forum' },
  { name: 'Profil',     labelKey: 'nav_profile',          icon: 'account-circle' },
  { name: 'Plus',       labelKey: 'nav_more',             icon: 'view-grid-plus' },
];

const TABS_LEGACY = [
  { name: 'Cycle',         labelKey: 'nav_cycle',          icon: 'moon-waning-crescent' },
  { name: 'Contraceptifs', labelKey: 'nav_contraceptives', icon: 'pill' },
  { name: 'Chat',          labelKey: 'nav_chat',           icon: 'chat-processing' },
  { name: 'Profil',        labelKey: 'nav_profile',        icon: 'account-circle' },
];

const findItems = (source, names) => names.map(n => source.find(i => i.name === n)).filter(Boolean);

// ─── GirlApp ──────────────────────────────────────────────────────────────────
function GirlApp() {
  const { specialistStatus, specialistData } = useAuth();
  const overflowItems = [...findItems(MENU_ITEMS_GIRL, ['Symptomes', 'Quiz', 'Chat']), specialistMenuExtra(specialistStatus)];

  const renderScreen = (active, setActive) => {
    switch (active) {
      case 'Cycle':     return <CycleScreen onOpenChat={() => setActive('Chat')} />;
      case 'Symptomes': return <SymptomsScreen />;
      case 'Education': return <EducationScreen />;
      case 'Quiz':      return <GirlQuizScreen />;
      case 'Forum':     return <ForumScreen />;
      case 'Chat':      return <ChatScreen />;
      case 'Profil':    return <ProfileScreen />;
      case 'BecomeSpecialist':  return <BecomeSpecialistScreen onSubmitted={() => setActive('SpecialistPending')} />;
      case 'SpecialistPending': return <SpecialistApplicationStatus />;
      case 'SpecialistHub':     return <SpecialistDashboard overrideRoleData={specialistData} />;
      default:          return <CycleScreen onOpenChat={() => setActive('Chat')} />;
    }
  };

  return (
    <SurveyGate>
      <AppShell
        defaultScreen="Cycle"
        titles={GIRL_TITLES}
        tabs={TABS_GIRL}
        overflowItems={overflowItems}
        renderScreen={renderScreen}
      />
    </SurveyGate>
  );
}

// ─── BoyApp ───────────────────────────────────────────────────────────────────
function BoyApp() {
  const { specialistStatus, specialistData } = useAuth();
  const overflowItems = [...findItems(MENU_ITEMS_BOY, ['Quiz', 'Partenaire', 'Responsabilite', 'Chat']), specialistMenuExtra(specialistStatus)];

  const renderScreen = (active, setActive) => {
    switch (active) {
      case 'MaSante':        return <HealthScreen onOpenChat={() => setActive('Chat')} />;
      case 'Comprendre':     return <UnderstandCycleScreen onGoToQuiz={() => setActive('Quiz')} />;
      case 'Quiz':           return <QuizScreen />;
      case 'Partenaire':     return <PartnerScreen />;
      case 'Responsabilite': return <ResponsibilityScreen />;
      case 'Forum':          return <ForumScreen />;
      case 'Chat':           return <ChatScreen />;
      case 'Profil':         return <ProfileScreen />;
      case 'BecomeSpecialist':  return <BecomeSpecialistScreen onSubmitted={() => setActive('SpecialistPending')} />;
      case 'SpecialistPending': return <SpecialistApplicationStatus />;
      case 'SpecialistHub':     return <SpecialistDashboard overrideRoleData={specialistData} />;
      default:               return <HealthScreen onOpenChat={() => setActive('Chat')} />;
    }
  };

  return (
    <SurveyGate>
      <AppShell
        defaultScreen="MaSante"
        titles={BOY_TITLES}
        tabs={TABS_BOY}
        overflowItems={overflowItems}
        renderScreen={renderScreen}
        accentColor="#3B82F6"
        isBoyTheme
      />
    </SurveyGate>
  );
}

// ─── UserApp (anciens comptes sans profil défini) ─────────────────────────────
function UserApp() {
  const renderScreen = (active, setActive) => {
    switch (active) {
      case 'Cycle':         return <CycleScreen onOpenChat={() => setActive('Chat')} />;
      case 'Contraceptifs': return <ContraceptivesScreen />;
      case 'Chat':          return <ChatScreen />;
      case 'Profil':        return <ProfileScreen />;
      default:              return <CycleScreen onOpenChat={() => setActive('Chat')} />;
    }
  };

  return (
    <SurveyGate>
      <AppShell
        defaultScreen="Cycle"
        titles={LEGACY_TITLES}
        tabs={TABS_LEGACY}
        overflowItems={[]}
        renderScreen={renderScreen}
      />
    </SurveyGate>
  );
}

// ─── AdminNavigator ───────────────────────────────────────────────────────────
function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard"        component={AdminDashboard} />
      <Stack.Screen name="SpecialistApproval"    component={SpecialistApprovalScreen} />
      <Stack.Screen name="SurveyManager"         component={SurveyManagerScreen} />
      <Stack.Screen name="CreateSurvey"          component={CreateSurveyScreen} />
      <Stack.Screen name="SurveyReport"          component={SurveyReportScreen} />
      <Stack.Screen name="AdminManagement"       component={AdminManagementScreen} />
      <Stack.Screen name="ContraceptivesManager" component={ContraceptivesManagerScreen} />
      <Stack.Screen name="ForumModeration"       component={ForumModerationScreen} />
      <Stack.Screen name="QuizManager"           component={QuizManagerScreen} />
      <Stack.Screen name="EducationManager"      component={EducationManagerScreen} />
    </Stack.Navigator>
  );
}

// ─── Navigation principale ────────────────────────────────────────────────────
const isEmailProvider = (user) => user?.providerData?.[0]?.providerId === 'password';

export default function Navigation() {
  const { user, userRole, loading } = useAuth();
  const { colors } = useTheme();
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(v => setOnboardingDone(v === 'true'));
  }, []);

  if (loading || onboardingDone === null) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Premier lancement : montrer l'onboarding avant tout
  if (!onboardingDone && !user) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  const REQUIRE_EMAIL_VERIFICATION = false;
  const emailNotVerified =
    REQUIRE_EMAIL_VERIFICATION &&
    user && isEmailProvider(user) && !user.emailVerified &&
    userRole !== ROLES.SPECIALIST && userRole !== ROLES.SPECIALIST_PENDING;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>

        {/* ── Non connecté ────────────────────────────────────────── */}
        {!user ? (
          <>
            <Stack.Screen name="Welcome"            component={WelcomeScreen} />
            <Stack.Screen name="Login"              component={LoginScreen} />
            <Stack.Screen name="Register"           component={RegisterScreen} />
            <Stack.Screen name="AdminRegister"      component={AdminRegisterScreen} />
            <Stack.Screen name="SpecialistRegister" component={SpecialistRegisterScreen} />
          </>

        /* ── Vérification email ──────────────────────────────────── */
        ) : emailNotVerified ? (
          <Stack.Screen name="VerifyEmail"     component={VerifyEmailScreen} />

        /* ── En attente d'approbation ────────────────────────────── */
        ) : userRole === ROLES.ADMIN_PENDING || userRole === ROLES.SPECIALIST_PENDING ? (
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />

        /* ── Admin ───────────────────────────────────────────────── */
        ) : userRole === ROLES.ADMIN ? (
          <Stack.Screen name="AdminApp"        component={AdminNavigator} />

        /* ── Personnel de santé (spécialiste approuvé) ───────────── */
        ) : userRole === ROLES.SPECIALIST ? (
          <Stack.Screen name="SpecialistApp"   component={SpecialistDashboard} />

        /* ── Profil Fille ────────────────────────────────────────── */
        ) : userRole === ROLES.GIRL ? (
          <Stack.Screen name="GirlApp"         component={GirlApp} />

        /* ── Profil Garçon ───────────────────────────────────────── */
        ) : userRole === ROLES.BOY ? (
          <Stack.Screen name="BoyApp"          component={BoyApp} />

        /* ── Fallback anciens comptes (ROLES.USER) ───────────────── */
        ) : (
          <Stack.Screen name="UserApp"         component={UserApp} />
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loader: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
});

const makeShellStyles = (chrome, spacing, radius, shadows) => StyleSheet.create({
  header: {
    backgroundColor: chrome.card,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: chrome.border,
    ...shadows.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: chrome.text,
  },
});
