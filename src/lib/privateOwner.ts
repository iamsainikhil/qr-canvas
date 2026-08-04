import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { firestore } from '@/integrations/firebase/client';

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? '';

export const privateModeEnabled = process.env.NEXT_PUBLIC_PRIVATE_MODE === 'true';
export const configuredOwnerEmail = normalizeEmail(process.env.NEXT_PUBLIC_OWNER_EMAIL);

export type PrivateOwnerAccessResult = {
  allowed: boolean;
  ownerConfigured: boolean;
  reason: string | null;
  detail: string | null;
};

export async function verifyPrivateOwnerAccess(user: User): Promise<PrivateOwnerAccessResult> {
  if (!configuredOwnerEmail) {
    return {
      allowed: false,
      ownerConfigured: false,
      reason: 'owner-email-not-configured',
      detail: null,
    };
  }

  const signedInEmail = normalizeEmail(user.email);

  if (!signedInEmail) {
    return {
      allowed: false,
      ownerConfigured: true,
      reason: 'missing-user-email',
      detail: 'The signed-in Google account did not provide an email address.',
    };
  }

  if (signedInEmail !== configuredOwnerEmail) {
    return {
      allowed: false,
      ownerConfigured: true,
      reason: 'owner-email-mismatch',
      detail: `signedInEmail=${signedInEmail}`,
    };
  }

  if (!firestore) {
    return {
      allowed: false,
      ownerConfigured: true,
      reason: 'firebase-not-configured',
      detail: 'Firestore client is not configured for this deployment.',
    };
  }

  try {
    const ownerDocRef = doc(firestore, 'app_config', 'private');
    const ownerDoc = await getDoc(ownerDocRef);

    if (!ownerDoc.exists()) {
      await setDoc(ownerDocRef, {
        ownerUid: user.uid,
        ownerEmail: signedInEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        allowed: true,
        ownerConfigured: true,
        reason: null,
        detail: null,
      };
    }

    const ownerData = ownerDoc.data();
    const ownerUid = typeof ownerData?.ownerUid === 'string' ? ownerData.ownerUid : '';
    const ownerEmail = normalizeEmail(typeof ownerData?.ownerEmail === 'string' ? ownerData.ownerEmail : '');

    if (ownerUid && ownerUid !== user.uid) {
      return {
        allowed: false,
        ownerConfigured: true,
        reason: 'owner-uid-mismatch',
        detail: `ownerUid=${ownerUid}`,
      };
    }

    if (ownerEmail && ownerEmail !== signedInEmail) {
      return {
        allowed: false,
        ownerConfigured: true,
        reason: 'owner-doc-email-mismatch',
        detail: `ownerDocEmail=${ownerEmail}`,
      };
    }

    return {
      allowed: true,
      ownerConfigured: true,
      reason: null,
      detail: null,
    };
  } catch (error) {
    return {
      allowed: false,
      ownerConfigured: true,
      reason: 'owner-config-read-failed',
      detail: error instanceof Error ? error.message : 'Unknown Firestore error',
    };
  }
}