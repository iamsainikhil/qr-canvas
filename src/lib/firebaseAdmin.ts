import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { getEnvValue, getMultilineEnv } from '@/lib/env';

const projectId = getEnvValue(process.env.FIREBASE_PROJECT_ID);
const clientEmail = getEnvValue(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = getMultilineEnv(process.env.FIREBASE_PRIVATE_KEY);

let app: App;

export const getAdminDb = () => {
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY',
    );
  }

  if (!getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    app = getApps()[0];
  }

  return getFirestore(app);
};

export const getAdminAuth = () => {
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY',
    );
  }

  if (!getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    app = getApps()[0];
  }

  return getAuth(app);
};
