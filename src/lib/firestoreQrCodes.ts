import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';

import { firestore } from '@/integrations/firebase/client';
import {
  SavedQRCode,
  SavedQRCodeStyleSnapshot,
  buildTrackingUrl,
  createSavedQrCodeDocument,
  generateShortCode,
  isTrackableQrType,
} from '@/lib/savedQrCodes';
import type { QRType } from '@/components/QRTypeSelector';

export interface ScanEvent {
  id: string;
  qrId: string;
  shortCode: string;
  timestamp: string;
  visitorId: string;
  ipHash: string;
  userAgent: string;
  referrer: string;
  country: string;
  region: string;
  city: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface SaveQrToFirestoreInput {
  ownerUid: string;
  type: QRType;
  value: string;
  style: SavedQRCodeStyleSnapshot;
}

const requireFirestore = () => {
  if (!firestore) {
    throw new Error('Firebase is not configured. Please set VITE_FIREBASE_* env vars and restart.');
  }

  return firestore;
};

const userQrsCollectionSafe = (ownerUid: string) => collection(requireFirestore(), 'users', ownerUid, 'qrs');
const userQrDocSafe = (ownerUid: string, qrId: string) => doc(requireFirestore(), 'users', ownerUid, 'qrs', qrId);
const routeDocSafe = (shortCode: string) => doc(requireFirestore(), 'qr_routes', shortCode);

const getUniqueShortCode = async () => {
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const candidate = generateShortCode();
    const existing = await getDoc(routeDocSafe(candidate));
    if (!existing.exists()) {
      return candidate;
    }
  }

  throw new Error('Could not allocate unique tracking code');
};

export const saveQrCodeForOwner = async ({ ownerUid, type, value, style }: SaveQrToFirestoreInput) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error('QR value is required');
  }

  const qrDocRef = doc(userQrsCollectionSafe(ownerUid));
  const trackingEnabled = isTrackableQrType(type);
  const shortCode = trackingEnabled ? await getUniqueShortCode() : null;
  const trackingUrl = shortCode ? buildTrackingUrl(window.location.origin, shortCode) : null;

  const qrDocument = createSavedQrCodeDocument({
    id: qrDocRef.id,
    ownerUid,
    type,
    value: trimmedValue,
    trackingEnabled,
    shortCode,
    trackingUrl,
    style,
  });

  await setDoc(qrDocRef, qrDocument);

  if (shortCode) {
    await setDoc(routeDocSafe(shortCode), {
      shortCode,
      ownerUid,
      qrId: qrDocument.id,
      targetValue: qrDocument.targetValue,
      active: true,
      createdAt: qrDocument.createdAt,
      updatedAt: qrDocument.updatedAt,
    });
  }

  return qrDocument;
};

export const subscribeToOwnerQrCodes = (
  ownerUid: string,
  onData: (items: SavedQRCode[]) => void,
  onError?: (error: Error) => void,
) => {
  const safeQuery = query(userQrsCollectionSafe(ownerUid), orderBy('createdAt', 'desc'), limit(300));

  return onSnapshot(
    safeQuery,
    (snapshot) => {
      const items = snapshot.docs.map((entry) => entry.data() as SavedQRCode);
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
    },
  );
};

export const deleteQrCodeForOwner = async (ownerUid: string, qr: SavedQRCode) => {
  await deleteDoc(userQrDocSafe(ownerUid, qr.id));
  if (qr.shortCode) {
    await deleteDoc(routeDocSafe(qr.shortCode));
  }
};

export const clearAllQrCodesForOwner = async (ownerUid: string) => {
  const snapshot = await getDocs(userQrsCollectionSafe(ownerUid));
  const deletePromises = snapshot.docs.flatMap((entry) => {
    const data = entry.data() as SavedQRCode;
    const ops: Promise<void>[] = [deleteDoc(entry.ref)];
    if (data.shortCode) {
      ops.push(deleteDoc(routeDocSafe(data.shortCode)));
    }
    return ops;
  });

  await Promise.all(deletePromises);
};

export const fetchQrScanEvents = async (
  ownerUid: string,
  qrId: string,
  maxCount = 500,
): Promise<ScanEvent[]> => {
  const scansRef = collection(requireFirestore(), 'users', ownerUid, 'qrs', qrId, 'scans');
  const scansQuery = query(scansRef, orderBy('timestamp', 'desc'), limit(maxCount));
  const snapshot = await getDocs(scansQuery);
  return snapshot.docs.map((d) => d.data() as ScanEvent);
};
