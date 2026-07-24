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
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { deleteObject, ref as storageRef } from 'firebase/storage';

import { firestore, storage } from '@/integrations/firebase/client';
import {
  SavedQRCode,
  SavedQRCodeStyleSnapshot,
  buildTrackingUrl,
  buildUpdatedSavedQrCodeDocument,
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
    throw new Error('Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars and restart.');
  }

  return firestore;
};

const userQrsCollectionSafe = (ownerUid: string) => collection(requireFirestore(), 'users', ownerUid, 'qrs');
const userQrDocSafe = (ownerUid: string, qrId: string) => doc(requireFirestore(), 'users', ownerUid, 'qrs', qrId);
const userQrScansCollectionSafe = (ownerUid: string, qrId: string) =>
  collection(requireFirestore(), 'users', ownerUid, 'qrs', qrId, 'scans');
const routeDocSafe = (shortCode: string) => doc(requireFirestore(), 'qr_routes', shortCode);

const uploadBackedTypes = new Set(['image', 'pdf', 'mp3']);

const parseStoragePathFromDownloadUrl = (value: string) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!host.includes('firebasestorage.googleapis.com')) {
      return null;
    }

    const marker = '/o/';
    const objectIndex = url.pathname.indexOf(marker);
    if (objectIndex < 0) {
      return null;
    }

    const encodedPath = url.pathname.slice(objectIndex + marker.length);
    if (!encodedPath) {
      return null;
    }

    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
};

const tryDeleteUploadedTargetAsset = async (qr: SavedQRCode) => {
  if (!storage) return;
  if (!uploadBackedTypes.has(qr.type)) return;

  const objectPath = parseStoragePathFromDownloadUrl(qr.targetValue);
  if (!objectPath) return;

  try {
    await deleteObject(storageRef(storage, objectPath));
  } catch {
    // Ignore storage cleanup failures so Firestore cleanup still succeeds.
  }
};

const deleteScansForQr = async (ownerUid: string, qrId: string) => {
  const scansSnapshot = await getDocs(userQrScansCollectionSafe(ownerUid, qrId));
  if (scansSnapshot.empty) return;

  const db = requireFirestore();
  const docs = scansSnapshot.docs;
  const batchSize = 400;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + batchSize);
    chunk.forEach((scanDoc) => batch.delete(scanDoc.ref));
    await batch.commit();
  }
};

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

export const updateQrCodeDestinationForOwner = async ({
  ownerUid,
  qr,
  value,
}: {
  ownerUid: string;
  qr: SavedQRCode;
  value: string;
}) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error('QR destination is required');
  }

  const db = requireFirestore();
  const batch = writeBatch(db);
  const updatedQr = buildUpdatedSavedQrCodeDocument({ item: qr, value: trimmedValue });

  batch.set(userQrDocSafe(ownerUid, qr.id), updatedQr);

  if (qr.shortCode) {
    batch.set(routeDocSafe(qr.shortCode), {
      shortCode: qr.shortCode,
      ownerUid,
      qrId: qr.id,
      targetValue: updatedQr.targetValue,
      active: true,
      createdAt: qr.createdAt,
      updatedAt: updatedQr.updatedAt,
    });
  }

  await batch.commit();

  return updatedQr;
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
  await Promise.all([
    deleteScansForQr(ownerUid, qr.id),
    tryDeleteUploadedTargetAsset(qr),
  ]);

  await deleteDoc(userQrDocSafe(ownerUid, qr.id));
  if (qr.shortCode) {
    await deleteDoc(routeDocSafe(qr.shortCode));
  }
};

export const clearAllQrCodesForOwner = async (ownerUid: string) => {
  const snapshot = await getDocs(userQrsCollectionSafe(ownerUid));
  const deletePromises = snapshot.docs.map(async (entry) => {
    const data = entry.data() as SavedQRCode;
    await Promise.all([
      deleteScansForQr(ownerUid, data.id),
      tryDeleteUploadedTargetAsset(data),
    ]);

    const ops: Promise<void>[] = [deleteDoc(entry.ref)];
    if (data.shortCode) {
      ops.push(deleteDoc(routeDocSafe(data.shortCode)));
    }
    await Promise.all(ops);
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
