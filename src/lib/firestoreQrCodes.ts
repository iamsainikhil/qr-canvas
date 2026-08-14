import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
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
  LinkFolder,
  normalizeFolderIds,
} from '@/lib/savedQrCodes';
import type { QRType } from '@/components/QRTypeSelector';
import type { ThemePreset } from '@/components/ThemePresets';

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
  folderIds?: string[];
}

const FOLDER_NAME_MAX = 40;
const QR_NAME_MAX = 60;

const requireFirestore = () => {
  if (!firestore) {
    throw new Error('Firebase is not configured. Please set NEXT_PUBLIC_FIREBASE_* env vars and restart.');
  }

  return firestore;
};

const nowIso = () => new Date().toISOString();

const userQrsCollectionSafe = (ownerUid: string) => collection(requireFirestore(), 'users', ownerUid, 'qrs');
const userQrDocSafe = (ownerUid: string, qrId: string) => doc(requireFirestore(), 'users', ownerUid, 'qrs', qrId);
const userQrScansCollectionSafe = (ownerUid: string, qrId: string) =>
  collection(requireFirestore(), 'users', ownerUid, 'qrs', qrId, 'scans');
const foldersCollectionSafe = () => collection(requireFirestore(), 'folders');
const folderDocSafe = (folderId: string) => doc(requireFirestore(), 'folders', folderId);
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

// Reject URLs that route through this app's own short-link system to prevent redirect loops.
const assertNotSelfReferential = (value: string) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const origin = window.location.origin.replace(/\/$/, '');
  const lower = value.trim().toLowerCase();
  const selfPatterns = [`${origin}${basePath}/api/r/`, `${origin}/api/r/`];
  if (selfPatterns.some((p) => lower.startsWith(p.toLowerCase()))) {
    throw new Error('QR destination cannot be a QR Canvas short link — it would create a redirect loop.');
  }
};

export const saveQrCodeForOwner = async ({ ownerUid, type, value, style, folderIds }: SaveQrToFirestoreInput) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error('QR value is required');
  }

  if (isTrackableQrType(type)) {
    assertNotSelfReferential(trimmedValue);
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
    folderIds,
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
  name,
  description,
  folderIds,
}: {
  ownerUid: string;
  qr: SavedQRCode;
  value: string;
  name?: string;
  description?: string;
  folderIds?: string[];
}) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error('QR destination is required');
  }

  if (qr.shortCode) {
    assertNotSelfReferential(trimmedValue);
  }

  const db = requireFirestore();
  const batch = writeBatch(db);
  const updatedQr = buildUpdatedSavedQrCodeDocument({
    item: qr,
    value: trimmedValue,
    name,
    description,
    folderIds,
  });

  batch.set(userQrDocSafe(ownerUid, qr.id), updatedQr);

  if (qr.shortCode) {
    batch.set(routeDocSafe(qr.shortCode), {
      shortCode: qr.shortCode,
      ownerUid,
      qrId: qr.id,
      targetValue: updatedQr.targetValue,
      active: qr.active ?? true,
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

// ─── Folders ────────────────────────────────────────────────────────────────

export const subscribeToOwnerFolders = (
  onData: (items: LinkFolder[]) => void,
  onError?: (error: Error) => void,
) => {
  const foldersQuery = query(foldersCollectionSafe(), orderBy('name', 'asc'));

  return onSnapshot(
    foldersQuery,
    (snapshot) => {
      const items = snapshot.docs.map((entry) => ({
        ...(entry.data() as LinkFolder),
        id: entry.id,
      }));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
    },
  );
};

export const createFolderForOwner = async (
  ownerUid: string,
  name: string,
): Promise<LinkFolder> => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Folder name is required.');
  }
  if (trimmed.length > FOLDER_NAME_MAX) {
    throw new Error(`Folder names can be at most ${FOLDER_NAME_MAX} characters.`);
  }

  const timestamp = nowIso();
  const ref = await addDoc(foldersCollectionSafe(), {
    ownerUid,
    name: trimmed,
    createdAt: timestamp,
    updatedAt: timestamp,
    sortOrder: Date.now(),
  });

  return {
    id: ref.id,
    ownerUid,
    name: trimmed,
    createdAt: timestamp,
    updatedAt: nowIso(),
    sortOrder: Date.now(),
  };
};

export const renameFolderForOwner = async (folderId: string, name: string): Promise<void> => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Folder name is required.');
  }
  if (trimmed.length > FOLDER_NAME_MAX) {
    throw new Error(`Folder names can be at most ${FOLDER_NAME_MAX} characters.`);
  }

  await setDoc(
    folderDocSafe(folderId),
    {
      name: trimmed,
      updatedAt: nowIso(),
    },
    { merge: true },
  );
};

export const reorderFoldersForOwner = async (updates: Record<string, number>): Promise<void> => {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;

  const db = requireFirestore();
  const batch = writeBatch(db);
  for (const [folderId, sortOrder] of entries) {
    batch.update(folderDocSafe(folderId), {
      sortOrder,
      updatedAt: nowIso(),
    });
  }
  await batch.commit();
};

export const deleteFolderForOwner = async (ownerUid: string, folderId: string): Promise<void> => {
  await deleteDoc(folderDocSafe(folderId));

  const snapshot = await getDocs(
    query(userQrsCollectionSafe(ownerUid), where('folderIds', 'array-contains', folderId)),
  );
  if (snapshot.empty) return;

  const docs = snapshot.docs.map((entry) => ({
    ref: entry.ref,
    folderIds: ((entry.data().folderIds as string[]) || []).filter((id) => id !== folderId),
  }));

  const db = requireFirestore();
  for (const group of chunk(docs, 400)) {
    const batch = writeBatch(db);
    group.forEach(({ ref, folderIds }) => {
      batch.update(ref, { folderIds, updatedAt: nowIso() });
    });
    await batch.commit();
  }
};

export const setQrCodeFoldersForOwner = async (
  ownerUid: string,
  qrId: string,
  folderIds: string[],
): Promise<void> => {
  await setDoc(
    userQrDocSafe(ownerUid, qrId),
    {
      folderIds: normalizeFolderIds(folderIds),
      updatedAt: nowIso(),
    },
    { merge: true },
  );
};

export const setQrCodeActiveForOwner = async (
  ownerUid: string,
  qr: SavedQRCode,
  active: boolean,
): Promise<void> => {
  const db = requireFirestore();
  const batch = writeBatch(db);
  batch.set(
    userQrDocSafe(ownerUid, qr.id),
    { active, updatedAt: nowIso() },
    { merge: true },
  );

  if (qr.shortCode) {
    batch.set(
      routeDocSafe(qr.shortCode),
      { active, updatedAt: nowIso() },
      { merge: true },
    );
  }

  await batch.commit();
};

export const renameQrCodeForOwner = async (
  ownerUid: string,
  qrId: string,
  name: string,
): Promise<void> => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('QR name is required.');
  }
  if (trimmed.length > QR_NAME_MAX) {
    throw new Error(`QR names can be at most ${QR_NAME_MAX} characters.`);
  }

  await setDoc(
    userQrDocSafe(ownerUid, qrId),
    {
      name: trimmed,
      updatedAt: nowIso(),
    },
    { merge: true },
  );
};

// ─── Bulk item operations ──────────────────────────────────────────────────

export const setQrCodesFoldersForOwner = async (
  ownerUid: string,
  qrIds: string[],
  folderIds: string[],
): Promise<void> => {
  const db = requireFirestore();
  const normalized = normalizeFolderIds(folderIds);

  for (const group of chunk(qrIds, 400)) {
    const batch = writeBatch(db);
    group.forEach((qrId) => {
      batch.set(
        userQrDocSafe(ownerUid, qrId),
        { folderIds: normalized, updatedAt: nowIso() },
        { merge: true },
      );
    });
    await batch.commit();
  }
};

export const setQrCodesActiveForOwner = async (
  ownerUid: string,
  qrIds: string[],
  active: boolean,
): Promise<void> => {
  const db = requireFirestore();

  for (const group of chunk(qrIds, 400)) {
    const batch = writeBatch(db);
    for (const qrId of group) {
      const entry = await getDoc(userQrDocSafe(ownerUid, qrId));
      if (entry.exists()) {
        const data = entry.data() as SavedQRCode;
        if (data.shortCode) {
          batch.set(
            routeDocSafe(data.shortCode),
            { active, updatedAt: nowIso() },
            { merge: true },
          );
        }
      }
      batch.set(
        userQrDocSafe(ownerUid, qrId),
        { active, updatedAt: nowIso() },
        { merge: true },
      );
    }
    await batch.commit();
  }
};

export const deleteQrCodesForOwner = async (
  ownerUid: string,
  qrIds: string[],
): Promise<void> => {
  const routeCodes: string[] = [];

  for (const qrId of qrIds) {
    const entry = await getDoc(userQrDocSafe(ownerUid, qrId));
    if (entry.exists()) {
      const data = entry.data() as SavedQRCode;
      await Promise.all([
        deleteScansForQr(ownerUid, qrId),
        tryDeleteUploadedTargetAsset(data),
      ]);
      if (data.shortCode) {
        routeCodes.push(data.shortCode);
      }
    }
  }

  const db = requireFirestore();
  for (const group of chunk(qrIds, 400)) {
    const batch = writeBatch(db);
    group.forEach((qrId) => batch.delete(userQrDocSafe(ownerUid, qrId)));
    await batch.commit();
  }

  if (routeCodes.length > 0) {
    for (const group of chunk(routeCodes, 400)) {
      const batch = writeBatch(db);
      group.forEach((shortCode) => batch.delete(routeDocSafe(shortCode)));
      await batch.commit();
    }
  }
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

// ─── Custom Themes ────────────────────────────────────────────────────────────

const userCustomThemesCollectionSafe = (ownerUid: string) =>
  collection(requireFirestore(), 'users', ownerUid, 'customThemes');

const userCustomThemeDocSafe = (ownerUid: string, themeId: string) =>
  doc(requireFirestore(), 'users', ownerUid, 'customThemes', themeId);

export const loadCustomThemesForOwner = async (ownerUid: string): Promise<ThemePreset[]> => {
  const snapshot = await getDocs(
    query(userCustomThemesCollectionSafe(ownerUid), orderBy('createdAt', 'asc')),
  );
  return snapshot.docs.map((d) => d.data() as ThemePreset);
};

export const saveCustomThemeForOwner = async (ownerUid: string, theme: ThemePreset): Promise<void> => {
  const docRef = userCustomThemeDocSafe(ownerUid, theme.id);
  const sanitized = {
    ...theme,
    patternColor: theme.patternColor ?? null,
    bgGradient: theme.bgGradient ?? null,
    createdAt: theme.createdAt ?? new Date().toISOString(),
  };
  await setDoc(docRef, sanitized);
};

export const deleteCustomThemeForOwner = async (ownerUid: string, themeId: string): Promise<void> => {
  await deleteDoc(userCustomThemeDocSafe(ownerUid, themeId));
};
