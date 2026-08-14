import type { FrameStyle } from '@/components/QRStyleTabs';
import type { BodyShape } from '@/components/BodyShapeSelector';
import type { QRType } from '@/components/QRTypeSelector';
import type { LogoStyleOptions } from '@/components/logoStyle';
import type { ScanLabelStyleOptions } from '@/components/scanLabelStyle';

export interface SavedQRCodeStyleSnapshot {
  fgColor: string;
  bgColor: string;
  patternColor?: string | null;
  bgGradient?: string | null;
  frameStyle: FrameStyle;
  bodyShape: BodyShape;
  logo?: string | null;
  logoStyle?: Partial<LogoStyleOptions> | null;
  scanText?: string;
  scanLabelStyle?: Partial<ScanLabelStyleOptions> | null;
  downloadSize?: number | null;
}

export interface SavedQRCodeStats {
  scanCount: number;
  uniqueVisitors?: number;
  lastScannedAt: string | null;
}

export interface LinkFolder {
  id: string;
  ownerUid: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sortOrder?: number;
}

export interface SavedQRCode {
  id: string;
  name: string;
  type: QRType;
  value: string;
  targetValue: string;
  trackingEnabled: boolean;
  shortCode: string | null;
  trackingUrl: string | null;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  style: SavedQRCodeStyleSnapshot;
  stats: SavedQRCodeStats;
  folderIds?: string[];
  active: boolean;
  description?: string;
}

export interface CreateSavedQRCodeInput {
  id: string;
  ownerUid: string;
  type: QRType;
  value: string;
  trackingEnabled: boolean;
  shortCode: string | null;
  trackingUrl: string | null;
  style: SavedQRCodeStyleSnapshot;
  folderIds?: string[];
}

export const normalizeFolderIds = (ids: string[] | undefined) => {
  return Array.from(
    new Set(
      (ids || []).filter((id): id is string => typeof id === 'string' && Boolean(id.trim())),
    ),
  ).sort();
};

export const qrTypeLabel: Record<QRType, string> = {
  url: 'URL',
  video: 'Video',
  wifi: 'Wi-Fi',
  app: 'App',
  text: 'Text',
  image: 'Image',
  email: 'E-mail',
  sms: 'SMS',
  pdf: 'PDF',
  mp3: 'MP3',
};

const trimTo = (value: string, max: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
};

export const buildSavedQrName = (type: QRType, value: string) => {
  const cleanValue = value.trim();
  if (!cleanValue) {
    return `${qrTypeLabel[type]} QR`;
  }

  return trimTo(cleanValue, 42);
};

export const trackableQrTypes: QRType[] = ['url', 'video', 'app', 'image', 'pdf', 'mp3'];

export const isTrackableQrType = (type: QRType) => trackableQrTypes.includes(type);

export const generateShortCode = () => {
  return Math.random().toString(36).slice(2, 10);
};

export const buildTrackingUrl = (origin: string, shortCode: string) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${origin.replace(/\/$/, '')}${basePath}/api/r/${shortCode}`;
};

export const createSavedQrCodeDocument = ({
  id,
  ownerUid,
  type,
  value,
  trackingEnabled,
  shortCode,
  trackingUrl,
  style,
  folderIds,
}: CreateSavedQRCodeInput): SavedQRCode => {
  const now = new Date().toISOString();
  const trimmedValue = value.trim();
  const finalValue = trackingEnabled && trackingUrl ? trackingUrl : trimmedValue;

  return {
    id,
    name: buildSavedQrName(type, value),
    type,
    value: finalValue,
    targetValue: trimmedValue,
    trackingEnabled,
    shortCode,
    trackingUrl,
    ownerUid,
    createdAt: now,
    updatedAt: now,
    style,
    stats: {
      scanCount: 0,
      uniqueVisitors: 0,
      lastScannedAt: null,
    },
    folderIds: normalizeFolderIds(folderIds),
    active: true,
    description: '',
  };
};

export const buildUpdatedSavedQrCodeDocument = ({
  item,
  value,
  name,
  description,
  folderIds,
}: {
  item: SavedQRCode;
  value: string;
  name?: string;
  description?: string;
  folderIds?: string[];
}): SavedQRCode => {
  const trimmedValue = value.trim();
  const now = new Date().toISOString();
  const finalValue = item.trackingEnabled && item.trackingUrl ? item.trackingUrl : trimmedValue;
  const autoName = buildSavedQrName(item.type, trimmedValue);

  return {
    ...item,
    name: name === undefined ? autoName : name.trim() || autoName,
    value: finalValue,
    targetValue: trimmedValue,
    description: description === undefined ? item.description ?? '' : description.trim(),
    folderIds: folderIds === undefined ? item.folderIds || [] : normalizeFolderIds(folderIds),
    updatedAt: now,
  };
};

export const isValidSavedQrList = (value: unknown): value is SavedQRCode[] => {
  return Array.isArray(value);
};
