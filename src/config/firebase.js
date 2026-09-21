import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCUe7Zjv7hEexd7WTdh-Qs_yeVGYGVczv0',
  authDomain: 'lunela-b80f3.firebaseapp.com',
  projectId: 'lunela-b80f3',
  storageBucket: 'lunela-b80f3.firebasestorage.app',
  messagingSenderId: '345823596055',
  appId: '1:345823596055:android:3169f97e42992a260b9652',
  databaseURL: 'https://lunela-b80f3-default-rtdb.firebaseio.com',
};

let app, auth;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // getReactNativePersistence n'existe que dans le build natif de firebase/auth ;
  // le web utilise la persistence navigateur standard.
  auth = initializeAuth(app, {
    persistence: Platform.OS === 'web'
      ? browserLocalPersistence
      : getReactNativePersistence(ReactNativeAsyncStorage),
  });
} else {
  app = getApps()[0];
  auth = getAuth(app);
}
export { auth };

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export default app;
