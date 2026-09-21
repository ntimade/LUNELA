import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendEmailVerification,
  GoogleAuthProvider, signInWithCredential,
  reload, updateProfile, sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection, getDocs, serverTimestamp,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { auth, db } from '../config/firebase';

const AuthContext = createContext({});

// ─── Rôles ────────────────────────────────────────────────────────────────────
// Anciens rôles conservés pour compatibilité
// Nouveaux profils : GIRL, BOY, HEALTH_WORKER
export const ROLES = {
  // Profils utilisateurs LUNELA
  GIRL:               'girl',
  BOY:                'boy',
  HEALTH_WORKER:      'health_worker',
  // Rôles admin (conservés)
  ADMIN:              'admin',
  ADMIN_PENDING:      'admin_pending',
  // Rôles spécialiste (conservés — health_worker passe par ce flux)
  SPECIALIST:         'specialist',
  SPECIALIST_PENDING: 'specialist_pending',
  // Fallback anciens comptes sans profil
  USER:               'user',
};

// Profils possibles pour les utilisateurs standard
export const PROFILES = {
  GIRL:         'girl',
  BOY:          'boy',
  HEALTH_WORKER:'health_worker',
};

export const AuthProvider = ({ children }) => {
  const [user,        setUser]        = useState(null);
  const [userRole,    setUserRole]    = useState(ROLES.USER);
  const [userProfile, setUserProfile] = useState(null);   // 'girl'|'boy'|'health_worker'|null
  const [roleData,    setRoleData]    = useState(null);
  // Statut spécialiste indépendant du profil consommateur (fille/garçon) —
  // permet à un même compte d'être à la fois GIRL/BOY et spécialiste approuvé.
  const [specialistStatus, setSpecialistStatus] = useState('none'); // 'none'|'pending'|'approved'|'blocked'
  const [specialistData,   setSpecialistData]   = useState(null);   // doc brut specialists/{uid}
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Pendant une inscription (register*), `createUserWithEmailAndPassword`
  // déclenche déjà `onAuthStateChanged` — qui lirait alors `admins`/`users`
  // AVANT que les écritures Firestore de la fonction d'inscription (qui,
  // elles, déterminent le rôle réel) n'aient eu lieu. Cette course peut faire
  // gagner un rôle par défaut (USER) au lieu du rôle réellement inscrit. Le
  // flag suivant fait sauter cette lecture automatique pendant l'inscription :
  // la fonction d'inscription elle-même reste seule responsable de `userRole`.
  const registeringRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u && registeringRef.current) {
          // Rôle déjà géré par la fonction d'inscription en cours.
        } else if (u) await fetchRole(u.uid);
        else {
          setUserRole(ROLES.USER);
          setUserProfile(null);
          setRoleData(null);
          setSpecialistStatus('none');
          setSpecialistData(null);
        }
      } catch (e) {
        setUserRole(ROLES.USER);
        setUserProfile(null);
        setRoleData(null);
        setSpecialistStatus('none');
        setSpecialistData(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // ─── fetchRole ─────────────────────────────────────────────────────────────
  const fetchRole = async (uid) => {
    try {
      // 1. Vérifier si c'est un admin (rôle exclusif, non combinable)
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      if (adminSnap.exists()) {
        const data = adminSnap.data();
        setRoleData(data);
        setUserProfile(null);
        setSpecialistStatus('none');
        setSpecialistData(null);
        setUserRole(data.status === 'approved' ? ROLES.ADMIN : ROLES.ADMIN_PENDING);
        savePushToken(uid);
        return;
      }

      // 2. Lire le profil consommateur ET le statut spécialiste indépendamment
      // (ni l'un ni l'autre ne court-circuite plus l'autre — un compte peut
      // être à la fois fille/garçon ET spécialiste approuvé).
      const [userSnap, specSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDoc(doc(db, 'specialists', uid)),
      ]);
      const specData        = specSnap.exists() ? specSnap.data() : null;
      const consumerData    = userSnap.exists() ? userSnap.data() : null;
      const consumerProfile = consumerData?.profile ?? null;

      setSpecialistData(specData);
      setSpecialistStatus(
        !specData ? 'none' :
        specData.status === 'approved' ? 'approved' :
        specData.status === 'blocked'  ? 'blocked'  : 'pending'
      );

      // 2a. Profil fille/garçon présent → userRole reste GIRL/BOY quel que
      // soit le statut spécialiste.
      if (consumerProfile === PROFILES.GIRL || consumerProfile === PROFILES.BOY) {
        setRoleData(consumerData);
        setUserProfile(consumerProfile);
        setUserRole(consumerProfile === PROFILES.BOY ? ROLES.BOY : ROLES.GIRL);
        savePushToken(uid, { syncSpecialist: specData?.status === 'approved' });
        return;
      }

      // 2b. Pas de profil consommateur — comportement historique préservé
      // pour les comptes spécialiste purs (créés via l'inscription dédiée).
      if (specData) {
        setRoleData(specData);
        setUserProfile(PROFILES.HEALTH_WORKER);
        setUserRole(specData.status === 'approved' ? ROLES.SPECIALIST : ROLES.SPECIALIST_PENDING);
        savePushToken(uid, { hasConsumerDoc: false, syncSpecialist: true });
        return;
      }

      // 2c. users/{uid} existe mais sans profil choisi (compte legacy)
      if (userSnap.exists()) {
        setRoleData(consumerData);
        setUserProfile(null);
        setUserRole(ROLES.USER);
        savePushToken(uid);
        return;
      }

      // 3. Fallback — rien n'existe
      setUserRole(ROLES.USER);
      setUserProfile(null);
      setRoleData(null);
    } catch (e) {
      setUserRole(ROLES.USER);
      setUserProfile(null);
      return;
    }

    savePushToken(uid);
  };

  // ─── Sauvegarde du push token Expo ───────────────────────────────────────
  // hasConsumerDoc=false évite d'écrire vers users/{uid} pour un compte
  // spécialiste pur (qui n'a pas ce document) ; syncSpecialist duplique le
  // token vers specialists/{uid} pour que les notifications de chat
  // atteignent aussi un compte double-profil approuvé.
  const savePushToken = async (uid, { hasConsumerDoc = true, syncSpecialist = false } = {}) => {
    if (!uid || !Device.isDevice) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      if (!tokenData?.data) return;
      if (hasConsumerDoc) {
        await setDoc(doc(db, 'users', uid), { pushToken: tokenData.data }, { merge: true }).catch(() => {});
      }
      if (syncSpecialist) {
        await setDoc(doc(db, 'specialists', uid), { pushToken: tokenData.data }, { merge: true }).catch(() => {});
      }
    } catch (_) {}
  };

  const clearError = () => setError(null);

  // ─── Inscription utilisateur (fille ou garçon) ────────────────────────────
  // profile : 'girl' | 'boy'
  const registerWithEmail = async (email, password, displayName, profile = PROFILES.GIRL) => {
    registeringRef.current = true;
    try {
      setError(null);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });

      // Sauvegarder le profil dans Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid:         cred.user.uid,
        email,
        displayName,
        profile,
        createdAt:   serverTimestamp(),
      });

      setUserProfile(profile);
      setUserRole(profile === PROFILES.BOY ? ROLES.BOY : ROLES.GIRL);
      return cred.user;
    } catch (e) {
      setError(translateError(e.code));
      throw e;
    } finally {
      registeringRef.current = false;
    }
  };

  // ─── Inscription admin (conservée) ───────────────────────────────────────
  // Toujours 'pending' : les règles Firestore n'autorisent la lecture de la
  // collection `admins` qu'à son propriétaire ou à un admin déjà approuvé
  // (pas de règle `list` ouverte) — un compte tout juste créé ne peut donc
  // jamais lire la collection pour savoir "suis-je le premier ?" (la requête
  // getDocs(collection('admins')) était systématiquement rejetée en
  // permission-denied). Le tout premier admin doit être approuvé une fois,
  // manuellement, dans la console Firebase ; ensuite, chaque nouvel admin est
  // approuvé par un admin déjà actif via l'écran de gestion des admins.
  const registerAdmin = async (email, password, displayName) => {
    registeringRef.current = true;
    try {
      setError(null);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await setDoc(doc(db, 'admins', cred.user.uid), {
        uid: cred.user.uid, email, displayName, status: 'pending',
        role: 'admin_pending',  // ← requis par la règle `create` Firestore ; l'accès réel
                                 //   est décidé par `status` (isAdmin() ne regarde pas `role`)
        createdAt: serverTimestamp(),
      });
      // La règle `create` de users/{uid} exige les champs uid+email ; sans eux
      // (et comme ce doc n'existe pas encore à ce stade), l'écriture est rejetée.
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, email, role: 'admin', status: 'pending',
      }, { merge: true });
      setUserProfile(null);
      setUserRole(ROLES.ADMIN_PENDING);
      return cred.user;
    } catch (e) {
      setError(translateError(e.code || e.message));
      throw e;
    } finally {
      registeringRef.current = false;
    }
  };

  // ─── Inscription spécialiste / personnel de santé (conservée) ────────────
  const registerSpecialist = async (email, password, profileData) => {
    registeringRef.current = true;
    try {
      setError(null);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: profileData.displayName });
      await setDoc(doc(db, 'specialists', cred.user.uid), {
        uid: cred.user.uid, email, status: 'pending',
        role: 'specialist_pending',  // ← requis par la règle create Firestore
        createdAt: serverTimestamp(), ...profileData,
      });
      setUserProfile(PROFILES.HEALTH_WORKER);
      setUserRole(ROLES.SPECIALIST_PENDING);
      return cred.user;
    } catch (e) {
      setError(translateError(e.code || e.message));
      throw e;
    } finally {
      registeringRef.current = false;
    }
  };

  // ─── Candidature spécialiste depuis un compte fille/garçon existant ───────
  // Contrairement à registerSpecialist(), n'appelle jamais createUserWithEmail
  // AndPassword : réutilise la session déjà connectée, sur le même uid.
  const applyAsSpecialist = async (profileData) => {
    if (!user) throw new Error('Not authenticated');
    try {
      setError(null);
      const payload = {
        uid: user.uid,
        email: user.email,
        status: 'pending',
        role: 'specialist_pending', // valeur requise par la règle Firestore, doit rester identique en cas de re-candidature
        createdAt: serverTimestamp(),
        ...profileData,
      };
      await setDoc(doc(db, 'specialists', user.uid), payload, { merge: true });
      setSpecialistData({ ...payload, createdAt: new Date() }); // optimiste ; serverTimestamp() se résout côté serveur
      setSpecialistStatus('pending');
      return true;
    } catch (e) {
      setError(translateError(e.code || e.message));
      throw e;
    }
  };

  // ─── Connexion ─────────────────────────────────────────────────────────────
  const loginWithEmail = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await fetchRole(result.user.uid);
      return result;
    } catch (e) {
      setError(translateError(e.code));
      throw e;
    }
  };

  const loginWithGoogle = async (idToken) => {
    try {
      setError(null);
      const credential = GoogleAuthProvider.credential(idToken);
      const result     = await signInWithCredential(auth, credential);

      // Pour Google : créer le doc users s'il n'existe pas encore
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (!userSnap.exists()) {
        // Pas de profil → sera demandé à l'étape suivante (navigation)
        await setDoc(doc(db, 'users', result.user.uid), {
          uid:         result.user.uid,
          email:       result.user.email,
          displayName: result.user.displayName,
          profile:     null,
          createdAt:   serverTimestamp(),
        });
      }

      await fetchRole(result.user.uid);
      return result;
    } catch (e) {
      setError(translateError(e.code));
      throw e;
    }
  };

  // ─── Mise à jour du profil (utilisé après connexion Google sans profil) ───
  const updateUserProfile = async (profile) => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { profile, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setUserProfile(profile);
      setUserRole(profile === PROFILES.BOY ? ROLES.BOY : ROLES.GIRL);
    } catch (e) {
      setError(translateError(e.code));
      throw e;
    }
  };

  // ─── Divers ────────────────────────────────────────────────────────────────
  const resendVerification = async () => {
    try { await sendEmailVerification(auth.currentUser); }
    catch (e) { setError(translateError(e.code)); throw e; }
  };

  const refreshUser = async () => {
    await reload(auth.currentUser);
    setUser({ ...auth.currentUser });
    await fetchRole(auth.currentUser.uid);
  };

  const resetPassword = async (email) => {
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      setError(translateError(e.code));
      throw e;
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user, userRole, userProfile, roleData, loading, error, clearError,
      specialistStatus, specialistData, applyAsSpecialist,
      registerWithEmail, registerAdmin, registerSpecialist,
      loginWithEmail, loginWithGoogle,
      updateUserProfile, resetPassword,
      resendVerification, refreshUser, logout, fetchRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Traduction des erreurs Firebase ─────────────────────────────────────────
const translateError = (code) => {
  const errors = {
    'auth/email-already-in-use':   'Cet email est déjà utilisé.',
    'auth/invalid-email':          'Adresse email invalide.',
    'auth/missing-email':          'Merci de renseigner ton adresse email.',
    'auth/weak-password':          'Le mot de passe doit contenir au moins 6 caractères.',
    'auth/user-not-found':         'Aucun compte trouvé avec cet email.',
    'auth/wrong-password':         'Mot de passe incorrect.',
    'auth/invalid-credential':     'Email ou mot de passe incorrect.',
    'auth/too-many-requests':      'Trop de tentatives. Réessayez plus tard.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    'auth/operation-not-allowed':  'Connexion par email non activée. Activez-la dans Firebase Console → Authentication.',
    'auth/internal-error':         'Erreur interne Firebase. Vérifiez votre connexion.',
    'auth/api-key-not-valid':      'Clé API Firebase invalide.',
    'permission-denied':           'Accès refusé. Vérifiez les règles Firestore dans Firebase Console.',
    'unavailable':                 'Service Firebase indisponible. Vérifiez votre connexion.',
    'failed-precondition':         'Firestore non activé. Activez-le dans Firebase Console.',
  };
  return errors[code] || `Erreur : ${code || 'inconnue'}`;
};

export const useAuth = () => useContext(AuthContext);
