import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

import { getEnvValue } from '@/lib/env';

const firebaseConfig = {
  apiKey: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) || undefined,
};

const missingFirebaseClientEnv = [
  ['NEXT_PUBLIC_FIREBASE_API_KEY', getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)],
  ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)],
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)],
  ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)],
  ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)],
  ['NEXT_PUBLIC_FIREBASE_APP_ID', getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)],
] as const;

const unresolvedFirebaseClientEnv = missingFirebaseClientEnv
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const isFirebaseConfigured = unresolvedFirebaseClientEnv.length === 0;
export { unresolvedFirebaseClientEnv as missingFirebaseClientEnv };

const app = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseAuth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;

export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (app && firebaseConfig.measurementId) {
  isSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app);
  });
}
