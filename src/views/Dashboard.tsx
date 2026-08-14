"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { Icon } from '@iconify/react';
import { firebaseAuth } from '@/integrations/firebase/client';
import { useTheme } from '@/hooks/use-theme';
import { formatDistanceToNow } from 'date-fns';
import QRCodeStyling, { type CornerDotType, type CornerSquareType, type DotType } from 'qr-code-styling';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { SavedQRCode, LinkFolder, qrTypeLabel } from '@/lib/savedQrCodes';
import { defaultScanLabelStyle } from '@/components/scanLabelStyle';
import { resolveLogoStyleOptions } from '@/components/logoStyle';
import { ensureGoogleFontLoaded } from '@/lib/fontRegistry';
import {
  ScanEvent,
  clearAllQrCodesForOwner,
  createFolderForOwner,
  deleteFolderForOwner,
  deleteQrCodeForOwner,
  deleteQrCodesForOwner,
  fetchQrScanEvents,
  renameQrCodeForOwner,
  reorderFoldersForOwner,
  setQrCodeActiveForOwner,
  setQrCodeFoldersForOwner,
  setQrCodesActiveForOwner,
  setQrCodesFoldersForOwner,
  subscribeToOwnerFolders,
  subscribeToOwnerQrCodes,
  updateQrCodeDestinationForOwner,
} from '@/lib/firestoreQrCodes';
import { getCurrentOwnerUid } from '@/lib/authOwner';

const PAGE_SIZE = 10;
const MAX_SELECTION = 50;
const UNCATEGORIZED_KEY = '__uncategorized__';

interface LinkGroup {
  key: string;
  folder?: LinkFolder;
  title: string;
  icon: string;
  items: SavedQRCode[];
}

type GroupItem =
  | { kind: 'group'; group: LinkGroup }
  | { kind: 'item'; group: LinkGroup; item: SavedQRCode };

type SortKey = 'createdAt' | 'name' | 'scanCount';
type StatusFilter = 'all' | 'active' | 'inactive';

const DEFAULT_SORT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  createdAt: 'desc',
  name: 'asc',
  scanCount: 'desc',
};

const compareItems = (
  a: SavedQRCode,
  b: SavedQRCode,
  sortBy: SortKey,
  sortDir: 'asc' | 'desc',
) => {
  const mult = sortDir === 'asc' ? 1 : -1;
  if (sortBy === 'name') {
    return a.name.localeCompare(b.name) * mult;
  }
  const av = sortBy === 'createdAt' ? Date.parse(a.createdAt) : a.stats.scanCount;
  const bv = sortBy === 'createdAt' ? Date.parse(b.createdAt) : b.stats.scanCount;
  if (av < bv) return -1 * mult;
  if (av > bv) return 1 * mult;
  return 0;
};

const timeAgo = (value: string | null | undefined) => {
  if (!value) return 'Never';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return 'Never';
  }
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function DestructiveConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  onConfirm,
}: {
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className="max-w-[44rem] rounded-[28px] border-border/70 bg-background px-6 py-7 text-center text-foreground shadow-2xl sm:px-8 sm:py-8">
        <AlertDialogHeader className="items-center space-y-5 sm:text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Icon icon="lucide:trash-2" className="h-10 w-10" />
          </div>
          <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 gap-3 border-t border-border pt-5 sm:justify-center sm:space-x-0">
          <AlertDialogCancel className="mt-0 h-12 rounded-full border-border/70 px-8 text-base font-medium text-foreground hover:bg-secondary hover:text-secondary-foreground">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" className="h-12 rounded-full px-8 text-base font-medium" onClick={onConfirm}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const canOpenInBrowser = (item: SavedQRCode) => {
  return item.type === 'url' || item.type === 'video' || item.type === 'app' || item.type === 'image' || item.type === 'pdf' || item.type === 'mp3';
};

const hasProtocol = (value: string) => /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);

const formatDestinationSummary = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'No destination';

  try {
    const normalized = hasProtocol(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : '';
    const shortPath = path.length > 18 ? `${path.slice(0, 18)}...` : path;

    if (!shortPath) return host;
    return `${host}${shortPath.startsWith('/') ? '' : '/'}${shortPath}`;
  } catch {
    return trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed;
  }
};

const bodyShapeToDotType: Record<SavedQRCode['style']['bodyShape'], DotType> = {
  square: 'square',
  dots: 'dots',
  rounded: 'rounded',
  classy: 'classy',
  sharp: 'classy-rounded',
};

const bodyShapeToCornerSquareType: Record<SavedQRCode['style']['bodyShape'], CornerSquareType> = {
  square: 'square',
  dots: 'dot',
  rounded: 'extra-rounded',
  classy: 'extra-rounded',
  sharp: 'square',
};

const bodyShapeToCornerDotType: Record<SavedQRCode['style']['bodyShape'], CornerDotType> = {
  square: 'square',
  dots: 'dot',
  rounded: 'dot',
  classy: 'dot',
  sharp: 'square',
};

const sanitizeFileName = (name: string) => {
  return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'qr-code';
};

const frameStyleClasses: Record<SavedQRCode['style']['frameStyle'], string> = {
  square: 'rounded-none',
  'rounded-sm': 'rounded-lg',
  'rounded-md': 'rounded-2xl',
  'rounded-lg': 'rounded-3xl',
  'rounded-left': 'rounded-l-3xl rounded-r-none',
  'rounded-right': 'rounded-r-3xl rounded-l-none',
  'pill-h': 'rounded-full',
  'pill-v': 'rounded-full',
  circle: 'rounded-full',
};

const buildLogoPlaceholder = (
  badgeSize: number,
  cornerRadius: number,
  backgroundColor: string,
) => {
  const size = 1000;
  const boxSize = Math.round((badgeSize / 100) * size);
  const inset = Math.round((size - boxSize) / 2);
  const radius = Math.round((cornerRadius / 100) * boxSize);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="transparent" />
      <rect x="${inset}" y="${inset}" width="${boxSize}" height="${boxSize}" rx="${radius}" ry="${radius}" fill="${backgroundColor}" />
    </svg>
  `
    .replace(/\s+/g, ' ')
    .trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

function SavedQrStyledPreview({ item, size = 280 }: { item: SavedQRCode; size?: number }) {
  const [qrElement, setQrElement] = useState<HTMLDivElement | null>(null);
  const renderSize = Math.max(size, 280);

  useEffect(() => {
    if (!qrElement) return;

    const resolvedLogoStyle = resolveLogoStyleOptions(item.style.logoStyle || undefined);
    const logo = item.style.logo || null;
    const logoPlaceholder = logo && resolvedLogoStyle.badgeSize > 0
      ? buildLogoPlaceholder(
          resolvedLogoStyle.badgeSize,
          resolvedLogoStyle.cornerRadius,
          resolvedLogoStyle.backgroundColor,
        )
      : undefined;

    const qr = new QRCodeStyling({
      width: renderSize,
      height: renderSize,
      type: 'svg',
      data: item.value,
      ...(logoPlaceholder
        ? {
            image: logoPlaceholder,
            imageOptions: {
              hideBackgroundDots: true,
              imageSize: 0.25,
              margin: 8,
              crossOrigin: 'anonymous' as const,
            },
          }
        : {}),
      dotsOptions: {
        color: item.style.fgColor,
        type: bodyShapeToDotType[item.style.bodyShape],
      },
      cornersSquareOptions: {
        color: item.style.patternColor || item.style.fgColor,
        type: bodyShapeToCornerSquareType[item.style.bodyShape],
      },
      cornersDotOptions: {
        color: item.style.patternColor || item.style.fgColor,
        type: bodyShapeToCornerDotType[item.style.bodyShape],
      },
      backgroundOptions: {
        color: item.style.bgColor,
      },
      qrOptions: {
        errorCorrectionLevel: 'H',
      },
    });

    qrElement.innerHTML = '';
    qr.append(qrElement);

    const renderedNode = qrElement.firstElementChild as HTMLElement | null;
    if (renderedNode) {
      renderedNode.style.width = `${size}px`;
      renderedNode.style.height = `${size}px`;
      renderedNode.style.display = 'block';
    }

    return () => {
      qrElement.innerHTML = '';
    };
  }, [item, qrElement, renderSize, size]);

  const resolvedLogoStyle = resolveLogoStyleOptions(item.style.logoStyle || undefined);
  const scanLabelStyle = {
    ...defaultScanLabelStyle,
    ...(item.style.scanLabelStyle || {}),
  };
  const [resolvedScanFontFamily, setResolvedScanFontFamily] = useState(scanLabelStyle.fontFamily);
  const labelScale = Math.min(size / 280, 1);
  const labelFontSize = Math.max(9, Math.round(scanLabelStyle.fontSize * labelScale));

  useEffect(() => {
    let cancelled = false;

    const applyLoadedFont = async () => {
      await ensureGoogleFontLoaded(scanLabelStyle.fontFamily, [400, 500, 600, 700, 800]);
      if (!cancelled) {
        setResolvedScanFontFamily(scanLabelStyle.fontFamily);
      }
    };

    void applyLoadedFont();

    return () => {
      cancelled = true;
    };
  }, [scanLabelStyle.fontFamily]);

  return (
    <div
      className={`p-4 ${frameStyleClasses[item.style.frameStyle]}`}
      style={{
        backgroundColor: item.style.bgColor,
        background: item.style.bgGradient || item.style.bgColor,
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="relative inline-flex">
          <div
            ref={setQrElement}
            style={{ width: `${size}px`, height: `${size}px`, lineHeight: 0 }}
          />
          {item.style.logo && resolvedLogoStyle.badgeSize > 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: `${resolvedLogoStyle.badgeSize}%`,
                  aspectRatio: '1',
                  backgroundColor: resolvedLogoStyle.backgroundColor,
                  borderRadius: `${resolvedLogoStyle.cornerRadius}%`,
                }}
              >
                <div
                  className="absolute"
                  style={{
                    inset: `${resolvedLogoStyle.padding}%`,
                  }}
                >
                  <img src={item.style.logo} alt="Logo" className="h-full w-full object-contain" />
                </div>
              </div>
            </div>
          )}
        </div>
        {(item.style.scanText || '').trim() && (
          <p
            className="text-center leading-tight"
            style={{
              color: scanLabelStyle.color,
              fontSize: `${labelFontSize}px`,
              fontWeight: scanLabelStyle.fontWeight,
              fontFamily: `"${resolvedScanFontFamily}", Satoshi, system-ui, -apple-system, sans-serif`,
              textTransform: scanLabelStyle.uppercase ? 'uppercase' : 'none',
            }}
          >
            {(item.style.scanText || '').trim()}
          </p>
        )}
      </div>
    </div>
  );
}

function AnalyticsContent({ item, events }: { item: SavedQRCode; events: ScanEvent[] }) {
  const [chartRange, setChartRange] = useState<7 | 30>(7);

  const uniqueVisitors = useMemo(() => new Set(events.map((e) => e.visitorId)).size, [events]);

  const topCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const c = e.country && e.country !== 'unknown' ? e.country : '(unknown)';
      counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  const topReferrers = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      let host = '(direct)';
      if (e.referrer) {
        try {
          host = new URL(e.referrer).hostname || '(direct)';
        } catch {
          host = e.referrer.slice(0, 40);
        }
      }
      counts[host] = (counts[host] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  const chartDays = useMemo(() => {
    const days: { label: string; date: string; count: number }[] = [];
    for (let i = chartRange - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = chartRange === 7
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : i % 5 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      days.push({ label, date: dateStr, count: 0 });
    }
    for (const e of events) {
      const dateStr = e.timestamp.slice(0, 10);
      const day = days.find((d) => d.date === dateStr);
      if (day) day.count++;
    }
    return days;
  }, [events, chartRange]);

  const maxDayCount = Math.max(...chartDays.map((d) => d.count), 1);

  const downloadCsv = () => {
    const headers = ['Timestamp', 'Country', 'Region', 'City', 'Referrer', 'User Agent', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content'];
    const rows = events.map((e) => [
      e.timestamp, e.country, e.region, e.city, e.referrer, e.userAgent,
      e.utmSource ?? '', e.utmMedium ?? '', e.utmCampaign ?? '', e.utmTerm ?? '', e.utmContent ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-scans.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total scans</CardDescription>
            <CardTitle className="text-2xl">{item.stats.scanCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unique visitors</CardDescription>
            <CardTitle className="text-2xl">{uniqueVisitors}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last scanned</CardDescription>
            <CardTitle className="truncate text-2xl">
              {item.stats.lastScannedAt
                ? formatDistanceToNow(new Date(item.stats.lastScannedAt), { addSuffix: true })
                : 'Never'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Scans over time</p>
          <div className="flex rounded-full border border-border text-xs">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-3 py-1 first:rounded-l-full last:rounded-r-full transition-colors ${
                  chartRange === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-1 rounded-xl border border-border bg-muted/30 px-4 pb-3 pt-4" style={{ minHeight: 96 }}>
          {chartDays.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-primary/60 transition-all"
                style={{ height: `${Math.max(Math.round((day.count / maxDayCount) * 52), day.count > 0 ? 3 : 0)}px` }}
              />
              <span className="text-[9px] text-muted-foreground leading-none">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">No scan events recorded yet.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Top countries</p>
              <div className="space-y-2">
                {topCountries.map(([country, count]) => (
                  <div key={country} className="flex items-center gap-2 text-sm">
                    <span className="w-24 truncate text-muted-foreground">{country}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary/60"
                        style={{ width: `${Math.round((count / (topCountries[0]?.[1] ?? 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="w-5 text-right font-medium tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Top referrers</p>
              <div className="space-y-2">
                {topReferrers.map(([referrer, count]) => (
                  <div key={referrer} className="flex items-center gap-2 text-sm">
                    <span className="w-28 truncate text-muted-foreground">{referrer}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary/60"
                        style={{ width: `${Math.round((count / (topReferrers[0]?.[1] ?? 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="w-5 text-right font-medium tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full rounded-full" onClick={downloadCsv}>
            <Icon icon="lucide:download" className="h-4 w-4" />
            Download CSV
          </Button>
        </>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-full"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Icon icon="line-md:sunny-outline-to-moon-loop-transition" className="!size-6" />
      ) : (
        <Icon icon="line-md:moon-to-sunny-outline-loop-transition" className="!size-6" />
      )}
    </Button>
  );
}

function DisplayNameBadge({ item }: { item: SavedQRCode }) {
  return (
    <Badge
      variant={item.active ? 'default' : 'outline'}
      className="max-w-[12rem] truncate"
      title={`${item.name} · ${qrTypeLabel[item.type]}`}
    >
      {item.name}
    </Badge>
  );
}

function QuickPreviewButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      title="Preview QR"
      onClick={onClick}
    >
      <Icon icon="lucide:qr-code" className="h-4 w-4" />
    </Button>
  );
}

function QuickCopyButton({ item, onCopy }: { item: SavedQRCode; onCopy: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      title={item.trackingUrl ? 'Copy short link' : 'Copy destination'}
      onClick={onCopy}
    >
      <Icon icon="lucide:copy" className="h-4 w-4" />
    </Button>
  );
}

function QrActiveSwitch({
  item,
  onToggle,
}: {
  item: SavedQRCode;
  onToggle: (item: SavedQRCode, active: boolean) => void;
}) {
  return (
    <Switch
      checked={item.active}
      onCheckedChange={(value) => onToggle(item, value)}
      aria-label={`Toggle ${item.name}`}
    />
  );
}

interface QrRowActionHandlers {
  onToggleActive: (item: SavedQRCode, active: boolean) => void;
  onOpen: () => void;
  onAnalytics: () => void;
  onEdit: () => void;
  onAssignFolders: () => void;
  onDelete: () => void;
}

function RowActionMenu({ item, ...handlers }: { item: SavedQRCode } & QrRowActionHandlers) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          title="Actions"
          aria-label={`Actions for ${item.name}`}
        >
          <Icon icon="lucide:ellipsis-vertical" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => handlers.onToggleActive(item, !item.active)}>
          <Icon icon={item.active ? 'lucide:power-off' : 'lucide:power'} className="h-4 w-4" />
          {item.active ? 'Deactivate' : 'Activate'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {item.trackingEnabled && (
          <DropdownMenuItem onSelect={handlers.onAnalytics}>
            <Icon icon="lucide:bar-chart-2" className="h-4 w-4" />
            Analytics
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={handlers.onOpen} disabled={!canOpenInBrowser(item)}>
          <Icon icon="lucide:external-link" className="h-4 w-4" />
          Open destination
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handlers.onEdit}>
          <Icon icon="lucide:edit-3" className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handlers.onAssignFolders}>
          <Icon icon="lucide:folder-move" className="h-4 w-4" />
          Assign folders
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handlers.onDelete}>
          <Icon icon="lucide:trash-2" className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortHeaderButton({
  label,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sortBy: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sortBy === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground ${
        align === 'right' ? 'flex-row-reverse' : ''
      }`}
      title={`Sort by ${label}`}
    >
      {label}
      <Icon
        icon={
          !active
            ? 'lucide:arrow-up-down'
            : sortDir === 'asc'
              ? 'lucide:arrow-up'
              : 'lucide:arrow-down'
        }
        className="h-3.5 w-3.5"
      />
    </button>
  );
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <span>
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <Icon icon="lucide:chevron-left" className="h-3.5 w-3.5" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        >
          Next
          <Icon icon="lucide:chevron-right" className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function FolderPicker({
  folders,
  value,
  onChange,
  ownerUid,
}: {
  folders: LinkFolder[];
  value: string[];
  onChange: (ids: string[]) => void;
  ownerUid: string;
}) {
  const { toast } = useToast();
  const [folderQuery, setFolderQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const term = folderQuery.trim().toLowerCase();
  const matches = folders.filter((folder) => folder.name.toLowerCase().includes(term));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError('Folder name is required.');
      return;
    }

    setCreating(true);
    try {
      const created = await createFolderForOwner(ownerUid, trimmed);
      onChange([...value, created.id]);
      setCreateOpen(false);
      setCreateName('');
      setCreateError(null);
      setFolderQuery('');
      toast({
        title: 'Folder created',
        description: `${created.name} is ready for QR codes.`,
      });
    } catch (error) {
      toast({
        title: 'Could not create folder',
        description: errorMessage(error, 'Folder creation failed.'),
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      {folders.length > 0 ? (
        <>
          <div className="relative">
            <Icon
              icon="lucide:search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={folderQuery}
              onChange={(event) => setFolderQuery(event.target.value)}
              placeholder="Filter folders"
              autoFocus
              className="h-9 rounded-lg pl-8"
            />
          </div>
          <ul className="max-h-52 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
            {matches.map((folder) => (
              <li key={folder.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={value.includes(folder.id)}
                    onChange={() => toggle(folder.id)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <Icon icon="lucide:folder" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{folder.name}</span>
                </label>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                No folders match your filter.
              </li>
            )}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          No folders yet — create one below to organize your QR codes.
        </p>
      )}

      <div className="rounded-xl border border-dashed border-border p-1.5">
        {createOpen ? (
          <form onSubmit={submitCreate} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={createName}
                onChange={(event) => {
                  setCreateName(event.target.value);
                  setCreateError(null);
                }}
                placeholder="Folder name"
                autoFocus
                className="h-8 rounded-lg"
              />
              {createError && (
                <p className="mt-1 text-xs text-destructive">{createError}</p>
              )}
            </div>
            <Button type="submit" size="sm" className="rounded-full" disabled={creating}>
              {creating ? (
                <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
              ) : (
                <Icon icon="lucide:plus" className="h-4 w-4" />
              )}
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 rounded-full p-0"
              onClick={() => {
                setCreateOpen(false);
                setCreateName('');
                setCreateError(null);
              }}
              aria-label="Cancel creating folder"
            >
              <Icon icon="lucide:x" className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Icon icon="lucide:folder-plus" className="h-4 w-4 text-muted-foreground" />
            New folder
          </button>
        )}
      </div>

      {folders.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {value.length} selected · {folders.length - value.length} available
          </span>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
            >
              Clear (move to Uncategorized)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateFolderDialog({
  open,
  onOpenChange,
  ownerUid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerUid: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setFolderError(null);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFolderError('Folder name is required.');
      return;
    }

    setSaving(true);
    try {
      await createFolderForOwner(ownerUid, trimmed);
      toast({
        title: 'Folder created',
        description: `${trimmed} is ready for QR codes.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not create folder',
        description: errorMessage(error, 'Folder creation failed.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:folder-plus" className="h-4 w-4" />
            Create a folder
          </DialogTitle>
          <DialogDescription>
            Folders organize saved QR codes. A QR code can belong to one or more folders.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-folder-name">Folder name</Label>
            <Input
              id="create-folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing"
              autoFocus
            />
            {folderError && (
              <p className="text-xs text-destructive">{folderError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={saving}>
              {saving ? (
                <>
                  <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
                  Creating
                </>
              ) : (
                <>
                  <Icon icon="lucide:plus" className="h-4 w-4" />
                  Create folder
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkFolderDialog({
  open,
  onOpenChange,
  folders,
  count,
  onApply,
  ownerUid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: LinkFolder[];
  count: number;
  onApply: (folderIds: string[]) => Promise<void>;
  ownerUid: string;
}) {
  const { toast } = useToast();
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFolderIds([]);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await onApply(folderIds);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not update QR codes',
        description: errorMessage(error, 'Bulk update failed.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:folder-move" className="h-4 w-4" />
            Move {count} QR code{count === 1 ? '' : 's'} to folders
          </DialogTitle>
          <DialogDescription>
            Choosing folders replaces the current folder membership for all selected QR codes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Folders</Label>
            <FolderPicker
              folders={folders}
              value={folderIds}
              onChange={setFolderIds}
              ownerUid={ownerUid}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={saving}>
              {saving ? (
                <>
                  <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
                  Moving
                </>
              ) : (
                <>
                  <Icon icon="lucide:folder-move" className="h-4 w-4" />
                  Move QR codes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignFoldersDialog({
  item,
  onOpenChange,
  folders,
  ownerUid,
}: {
  item: SavedQRCode | null;
  onOpenChange: (open: boolean) => void;
  folders: LinkFolder[];
  ownerUid: string;
}) {
  const { toast } = useToast();
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFolderIds(item.folderIds ?? []);
    } else {
      setFolderIds([]);
    }
  }, [item]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item || saving) return;

    setSaving(true);
    try {
      await setQrCodeFoldersForOwner(ownerUid, item.id, folderIds);
      toast({
        title: 'QR folders updated',
        description: `${item.name} was ${folderIds.length === 0 ? 'moved to Uncategorized' : 'organized into the selected folders'}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not update folders',
        description: errorMessage(error, 'Folder update failed.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:folder-move" className="h-4 w-4" />
            Assign folders
          </DialogTitle>
          <DialogDescription>
            Choose the folders that {item?.name ?? 'this QR code'} belongs to.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Folders</Label>
            <FolderPicker
              folders={folders}
              value={folderIds}
              onChange={setFolderIds}
              ownerUid={ownerUid}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={saving}>
              {saving ? (
                <>
                  <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Icon icon="lucide:save" className="h-4 w-4" />
                  Save folders
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditQrDialog({
  item,
  onOpenChange,
  folders,
  ownerUid,
}: {
  item: SavedQRCode | null;
  onOpenChange: (open: boolean) => void;
  folders: LinkFolder[];
  ownerUid: string;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setValue(item.targetValue || item.value);
      setDescription(item.description ?? '');
      setFolderIds(item.folderIds ?? []);
      setName(item.name);
      setNameError(null);
    }
  }, [item]);

  const save = async () => {
    if (!item) return;

    setSaving(true);
    try {
      const updated = await updateQrCodeDestinationForOwner({
        ownerUid,
        qr: item,
        value,
        name,
        description,
        folderIds,
      });
      toast({
        title: 'QR updated',
        description: updated.trackingEnabled
          ? 'The tracking destination was updated without changing the QR code link.'
          : 'The saved QR content was updated.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not update QR',
        description: errorMessage(error, 'Update failed.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const rename = async () => {
    if (!item) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('QR name is required.');
      return;
    }
    setNameError(null);

    setRenaming(true);
    try {
      await renameQrCodeForOwner(ownerUid, item.id, trimmed);
      setName(trimmed);
      toast({
        title: 'QR renamed',
        description: `${trimmed} now shows in your dashboard.`,
      });
    } catch (error) {
      toast({
        title: 'Could not rename QR',
        description: errorMessage(error, 'Rename failed.'),
        variant: 'destructive',
      });
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:edit-3" className="h-4 w-4" />
            {item ? item.name : 'Edit QR code'}
          </DialogTitle>
          <DialogDescription>
            Destination changes apply to the next scan — the QR image and tracking link stay the same.
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                  placeholder="e.g. Landing page"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={rename}
                  disabled={renaming || name.trim() === item.name}
                >
                  {renaming ? (
                    <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon icon="lucide:arrow-right-left" className="h-4 w-4" />
                  )}
                  Rename
                </Button>
              </div>
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-value">
                {item.trackingEnabled ? 'Destination' : 'QR content'}
              </Label>
              <Input
                id="edit-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={item.trackingEnabled ? 'https://example.com/new-destination' : 'Enter the updated QR content'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What is this QR code for?"
              />
            </div>

            <div className="space-y-2">
              <Label>Folders</Label>
              <FolderPicker
                folders={folders}
                value={folderIds}
                onChange={setFolderIds}
                ownerUid={ownerUid}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" className="rounded-full" onClick={() => void save()} disabled={saving}>
                {saving ? (
                  <>
                    <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Icon icon="lucide:save" className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [items, setItems] = useState<SavedQRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [folders, setFolders] = useState<LinkFolder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [analyticsItem, setAnalyticsItem] = useState<SavedQRCode | null>(null);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [scanEventsLoading, setScanEventsLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<SavedQRCode | null>(null);
  const [assigningItem, setAssigningItem] = useState<SavedQRCode | null>(null);
  const [deletingItem, setDeletingItem] = useState<SavedQRCode | null>(null);
  const [previewItem, setPreviewItem] = useState<SavedQRCode | null>(null);
  const [folderCreateOpen, setFolderCreateOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<LinkFolder | null>(null);
  const [bulkFolderOpen, setBulkFolderOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const ownerUid = useMemo(() => getCurrentOwnerUid(), []);

  useEffect(() => {
    if (!ownerUid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOwnerQrCodes(
      ownerUid,
      (list) => {
        setItems(
          list.map((item) => ({
            ...item,
            active: item.active ?? true,
            folderIds: item.folderIds ?? [],
          })),
        );
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        toast({
          title: 'Could not load dashboard',
          description: error.message,
          variant: 'destructive',
        });
      },
    );

    return () => unsubscribe();
  }, [ownerUid, toast]);

  useEffect(() => {
    if (!ownerUid) return;

    const unsubscribe = subscribeToOwnerFolders(
      (list) => setFolders(list),
      (error) => {
        toast({
          title: 'Could not load folders',
          description: error.message,
          variant: 'destructive',
        });
      },
    );

    return () => unsubscribe();
  }, [ownerUid, toast]);

  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
  };

  const orderedFolders = useMemo(() => {
    return [...folders].sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        || a.name.localeCompare(b.name),
    );
  }, [folders]);

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const folderById = new Map(orderedFolders.map((folder) => [folder.id, folder]));
    const matches = (item: SavedQRCode) =>
      (!term ||
        item.name.toLowerCase().includes(term) ||
        item.value.toLowerCase().includes(term) ||
        item.targetValue.toLowerCase().includes(term) ||
        qrTypeLabel[item.type].toLowerCase().includes(term)) &&
      (statusFilter === 'all' ||
        (statusFilter === 'active' && item.active) ||
        (statusFilter === 'inactive' && !item.active));

    const folderGroups: LinkGroup[] = orderedFolders.map((folder) => ({
      key: folder.id,
      folder,
      title: folder.name,
      icon: 'lucide:folder',
      items: [],
    }));
    const groupByKey = new Map(folderGroups.map((group) => [group.key, group]));
    const uncategorized: LinkGroup = {
      key: UNCATEGORIZED_KEY,
      title: 'Uncategorized',
      icon: 'lucide:inbox',
      items: [],
    };

    for (const item of items) {
      if (!matches(item)) continue;
      const memberIds = (item.folderIds ?? []).filter((id) => folderById.has(id));
      if (memberIds.length === 0) {
        uncategorized.items.push(item);
      } else {
        for (const id of memberIds) {
          groupByKey.get(id)?.items.push(item);
        }
      }
    }

    const sortGroup = (group: LinkGroup) =>
      group.items.sort((a, b) => compareItems(a, b, sortBy, sortDir));
    folderGroups.forEach(sortGroup);
    sortGroup(uncategorized);

    const result = folderGroups;
    if (uncategorized.items.length > 0) result.push(uncategorized);
    return result;
  }, [items, orderedFolders, query, statusFilter, sortBy, sortDir]);

  const groupItems = useMemo(() => {
    const list: GroupItem[] = [];
    for (const group of groups) {
      list.push({ kind: 'group', group });
      if (collapsed.has(group.key)) continue;
      for (const item of group.items) {
        list.push({ kind: 'item', group, item });
      }
    }
    return list;
  }, [groups, collapsed]);

  const totalItems = useMemo(
    () => groupItems.reduce((count, entry) => count + (entry.kind === 'item' ? 1 : 0), 0),
    [groupItems],
  );

  const linkRanges = useMemo(() => {
    const ranges: ({ start: number; end: number } | null)[] = [];
    let running = 0;
    for (const entry of groupItems) {
      if (entry.kind === 'group') {
        ranges.push({ start: running, end: running });
      } else {
        running += 1;
        const last = ranges[ranges.length - 1];
        if (last) last.end = running;
        ranges.push(null);
      }
    }
    return ranges;
  }, [groupItems]);

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageItems = useMemo(() => {
    if (groupItems.length === 0) return groupItems;
    const startLink = safePage * PAGE_SIZE;
    const endLink = Math.min(totalItems, startLink + PAGE_SIZE);
    if (startLink >= endLink) return [];

    const result: GroupItem[] = [];
    let itemIndex = 0;
    for (let i = 0; i < groupItems.length; i += 1) {
      const entry = groupItems[i];
      if (entry.kind === 'group') {
        const range = linkRanges[i];
        if (range && range.start === range.end) {
          const groupPage =
            totalItems === 0
              ? 0
              : Math.min(Math.floor(range.start / PAGE_SIZE), totalPages - 1);
          if (safePage === groupPage) result.push(entry);
        } else if (range && range.start < endLink && range.end > startLink) {
          result.push(entry);
        }
      } else {
        if (itemIndex >= startLink && itemIndex < endLink) {
          result.push(entry);
        }
        itemIndex += 1;
      }
    }
    return result;
  }, [groupItems, linkRanges, safePage, totalItems, totalPages]);

  const pageIds = useMemo(
    () =>
      pageItems
        .filter((entry): entry is Extract<GroupItem, { kind: 'item' }> => entry.kind === 'item')
        .map((entry) => entry.item.id),
    [pageItems],
  );

  const visibleMatches = useMemo(
    () => groups.reduce((count, group) => count + group.items.length, 0),
    [groups],
  );

  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id)) && !allPageSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected;
    }
  }, [somePageSelected]);

  const allSelectedActive = useMemo(() => {
    const ids = new Set(selected);
    const matches = items.filter((item) => ids.has(item.id));
    return matches.length > 0 && matches.every((item) => item.active);
  }, [selected, items]);

  const capSelection = (ids: string[], select: boolean, prev: Set<string>) => {
    const next = new Set(prev);
    let over = false;
    for (const id of ids) {
      if (select && !next.has(id)) {
        if (next.size >= MAX_SELECTION) {
          over = true;
          break;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
    }
    return { next, over };
  };

  const noticeSelectionLimit = () => {
    toast({
      title: 'Selection limit reached',
      description: `You can select up to ${MAX_SELECTION} QR codes at a time.`,
    });
  };

  const toggleSelected = (id: string) => {
    if (!selected.has(id) && selected.size >= MAX_SELECTION) {
      noticeSelectionLimit();
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const { next, over } = capSelection(pageIds, !allPageSelected, selected);
    if (over) noticeSelectionLimit();
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const groupIds = (group: LinkGroup) => group.items.map((item) => item.id);

  const groupAllSelected = (group: LinkGroup) => {
    const ids = groupIds(group);
    return ids.length > 0 && ids.every((id) => selected.has(id));
  };

  const groupSomeSelected = (group: LinkGroup) => {
    const ids = groupIds(group);
    return ids.length > 0 && !groupAllSelected(group) && ids.some((id) => selected.has(id));
  };

  const toggleGroupSelection = (group: LinkGroup) => {
    const ids = groupIds(group);
    if (ids.length === 0) return;
    const selectAll = !groupAllSelected(group);

    const { next, over } = capSelection(ids, selectAll, selected);
    if (over) noticeSelectionLimit();
    setSelected(next);
  };

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openAnalytics = async (item: SavedQRCode) => {
    setAnalyticsItem(item);
    setScanEventsLoading(true);
    setScanEvents([]);
    try {
      if (!ownerUid) return;
      const events = await fetchQrScanEvents(ownerUid, item.id);
      setScanEvents(events);
    } catch (error) {
      toast({
        title: 'Could not load analytics',
        description: error instanceof Error ? error.message : 'Failed to fetch scan events',
        variant: 'destructive',
      });
    } finally {
      setScanEventsLoading(false);
    }
  };

  const copyValue = async (value: string, description = 'QR content copied to clipboard.') => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copied',
        description,
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy this QR value.',
        variant: 'destructive',
      });
    }
  };

  const copyShortLink = (item: SavedQRCode) => {
    if (item.trackingUrl) {
      void copyValue(item.trackingUrl, 'Short link copied to clipboard.');
    } else {
      void copyValue(item.targetValue);
    }
  };

  const toggleActive = async (item: SavedQRCode, active: boolean) => {
    if (!ownerUid) return;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, active } : it)));
    try {
      await setQrCodeActiveForOwner(ownerUid, item, active);
    } catch (error) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
      toast({
        title: 'Could not update QR code',
        description: errorMessage(error, 'Toggle failed.'),
        variant: 'destructive',
      });
    }
  };

  const removeItem = async (item: SavedQRCode) => {
    if (!ownerUid) return;
    try {
      await deleteQrCodeForOwner(ownerUid, item);
      toast({
        title: 'QR removed',
        description: 'The saved QR code was removed from your dashboard.',
      });
    } catch (error) {
      toast({
        title: 'Could not remove QR',
        description: errorMessage(error, 'Delete failed.'),
        variant: 'destructive',
      });
    }
  };

  const clearAll = async () => {
    if (!ownerUid) return;
    try {
      await clearAllQrCodesForOwner(ownerUid);
      toast({
        title: 'Dashboard cleared',
        description: 'All saved QR codes were removed.',
      });
    } catch (error) {
      toast({
        title: 'Could not clear dashboard',
        description: errorMessage(error, 'Clear failed.'),
        variant: 'destructive',
      });
    }
  };

  const removeFolder = async (folder: LinkFolder) => {
    if (!ownerUid) return;
    try {
      await deleteFolderForOwner(ownerUid, folder.id);
      toast({
        title: 'Folder removed',
        description: `${folder.name} was deleted. QR codes inside it are kept.`,
      });
    } catch (error) {
      toast({
        title: 'Could not remove folder',
        description: errorMessage(error, 'Delete failed.'),
        variant: 'destructive',
      });
    } finally {
      setFolderToDelete(null);
    }
  };

  const moveFolder = async (folder: LinkFolder, dir: -1 | 1) => {
    const ordered = orderedFolders;
    const idx = ordered.findIndex((f) => f.id === folder.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= ordered.length) return;

    const a = ordered[idx];
    const b = ordered[target];
    const aOrder = a.sortOrder ?? idx;
    const bOrder = b.sortOrder ?? target;

    setFolders((prev) =>
      prev.map((f) =>
        f.id === a.id
          ? { ...f, sortOrder: bOrder }
          : f.id === b.id
            ? { ...f, sortOrder: aOrder }
            : f,
      ),
    );

    try {
      await reorderFoldersForOwner({ [a.id]: bOrder, [b.id]: aOrder });
    } catch (error) {
      setFolders((prev) =>
        prev.map((f) => (f.id === a.id ? { ...a } : f.id === b.id ? { ...b } : f)),
      );
      toast({
        title: 'Could not reorder folders',
        description: errorMessage(error, 'Reorder failed.'),
        variant: 'destructive',
      });
    }
  };

  const bulkSetActive = async (active: boolean) => {
    if (!ownerUid) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    try {
      await setQrCodesActiveForOwner(ownerUid, ids, active);
      toast({
        title: active ? 'QR codes activated' : 'QR codes deactivated',
        description: `${ids.length} QR code${ids.length === 1 ? '' : 's'} updated.`,
      });
      clearSelection();
    } catch (error) {
      toast({
        title: 'Could not update QR codes',
        description: errorMessage(error, 'Bulk update failed.'),
        variant: 'destructive',
      });
    }
  };

  const applyBulkFolders = async (folderIds: string[]) => {
    if (!ownerUid) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    await setQrCodesFoldersForOwner(ownerUid, ids, folderIds);
    toast({
      title: 'QR codes organized',
      description: `${ids.length} QR code${ids.length === 1 ? '' : 's'} moved to the selected folders.`,
    });
    clearSelection();
  };

  const bulkDelete = async () => {
    if (!ownerUid) return;
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }

    try {
      await deleteQrCodesForOwner(ownerUid, ids);
      toast({
        title: 'QR codes removed',
        description: `${ids.length} QR code${ids.length === 1 ? '' : 's'} deleted.`,
      });
      clearSelection();
    } catch (error) {
      toast({
        title: 'Could not remove QR codes',
        description: errorMessage(error, 'Bulk delete failed.'),
        variant: 'destructive',
      });
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const handleSignOut = async () => {
    if (!firebaseAuth) return;
    setSigningOut(true);
    try {
      await signOut(firebaseAuth);
      toast({
        title: 'Signed out',
        description: 'You have been signed out of your account.',
      });
    } catch (error) {
      toast({
        title: 'Could not sign out',
        description: errorMessage(error, 'Sign out failed.'),
        variant: 'destructive',
      });
    } finally {
      setSigningOut(false);
    }
  };

  const getSavedQrPngBlob = async (item: SavedQRCode): Promise<Blob> => {
    const resolvedLogoStyle = resolveLogoStyleOptions(item.style.logoStyle || undefined);
    const logo = item.style.logo || null;
    const logoPlaceholder = logo && resolvedLogoStyle.badgeSize > 0
      ? buildLogoPlaceholder(
          resolvedLogoStyle.badgeSize,
          resolvedLogoStyle.cornerRadius,
          resolvedLogoStyle.backgroundColor,
        )
      : undefined;

    const downloadSize = item.style.downloadSize || 500;

    const qr = new QRCodeStyling({
      width: downloadSize,
      height: downloadSize,
      data: item.value,
      ...(logoPlaceholder
        ? {
            image: logoPlaceholder,
            imageOptions: {
              hideBackgroundDots: true,
              imageSize: 0.25,
              margin: 8,
              crossOrigin: 'anonymous' as const,
            },
          }
        : {}),
      dotsOptions: {
        color: item.style.fgColor,
        type: bodyShapeToDotType[item.style.bodyShape],
      },
      cornersSquareOptions: {
        color: item.style.patternColor || item.style.fgColor,
        type: bodyShapeToCornerSquareType[item.style.bodyShape],
      },
      cornersDotOptions: {
        color: item.style.patternColor || item.style.fgColor,
        type: bodyShapeToCornerDotType[item.style.bodyShape],
      },
      backgroundOptions: {
        color: item.style.bgColor,
      },
      qrOptions: {
        errorCorrectionLevel: 'H',
      },
    });

    const raw = await qr.getRawData('png');
    if (!(raw instanceof Blob)) throw new Error('Could not generate QR image');

    const qrUrl = URL.createObjectURL(raw);
    const qrImg = new Image();
    qrImg.src = qrUrl;
    await new Promise((resolve, reject) => {
      qrImg.onload = resolve;
      qrImg.onerror = reject;
    });

    const scanLabelStyle = { ...defaultScanLabelStyle, ...(item.style.scanLabelStyle || {}) };
    const labelText = (item.style.scanText || '').trim();
    const includeLabel = Boolean(labelText);
    const padding = Math.round(downloadSize * 0.08);
    const fontSize = Math.max(16, Math.round(scanLabelStyle.fontSize * (downloadSize / 400)));
    const textAreaHeight = Math.round(fontSize * 1.6);
    const extraHeight = includeLabel ? textAreaHeight + padding : 0;

    const canvas = document.createElement('canvas');
    canvas.width = downloadSize;
    canvas.height = downloadSize + extraHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.fillStyle = item.style.bgColor || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qrImg, 0, 0, downloadSize, downloadSize);

    if (logo && resolvedLogoStyle.badgeSize > 0) {
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = logo;
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject(new Error('Logo load failed'));
        });

        const badgeSize = Math.round(downloadSize * (resolvedLogoStyle.badgeSize / 100));
        const cx = Math.round(downloadSize / 2);
        const cy = Math.round(downloadSize / 2);
        const badgeX = Math.round(cx - badgeSize / 2);
        const badgeY = Math.round(cy - badgeSize / 2);
        const badgeRadius = Math.round(badgeSize * (resolvedLogoStyle.cornerRadius / 100));

        ctx.beginPath();
        ctx.moveTo(badgeX + badgeRadius, badgeY);
        ctx.lineTo(badgeX + badgeSize - badgeRadius, badgeY);
        ctx.quadraticCurveTo(badgeX + badgeSize, badgeY, badgeX + badgeSize, badgeY + badgeRadius);
        ctx.lineTo(badgeX + badgeSize, badgeY + badgeSize - badgeRadius);
        ctx.quadraticCurveTo(badgeX + badgeSize, badgeY + badgeSize, badgeX + badgeSize - badgeRadius, badgeY + badgeSize);
        ctx.lineTo(badgeX + badgeRadius, badgeY + badgeSize);
        ctx.quadraticCurveTo(badgeX, badgeY + badgeSize, badgeX, badgeY + badgeSize - badgeRadius);
        ctx.lineTo(badgeX, badgeY + badgeRadius);
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
        ctx.closePath();

        if (resolvedLogoStyle.backgroundColor !== 'transparent') {
          ctx.fillStyle = resolvedLogoStyle.backgroundColor;
          ctx.fill();
        }

        const logoPad = Math.round(badgeSize * (resolvedLogoStyle.padding / 100));
        const lSize = badgeSize - logoPad * 2;
        ctx.drawImage(logoImg, cx - lSize / 2, cy - lSize / 2, lSize, lSize);
      } catch {
        // Ignore logo draw failures (CORS) and still render base QR.
      }
    }

    if (includeLabel) {
      ctx.fillStyle = scanLabelStyle.color;
      ctx.font = `${scanLabelStyle.fontWeight} ${fontSize}px "${scanLabelStyle.fontFamily}", Satoshi, system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        scanLabelStyle.uppercase ? labelText.toUpperCase() : labelText,
        canvas.width / 2,
        downloadSize + padding / 2 + textAreaHeight / 2,
      );
    }

    URL.revokeObjectURL(qrUrl);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error('Could not generate PNG'));
        else resolve(blob);
      }, 'image/png');
    });
  };

  const copyQrImage = async (item: SavedQRCode) => {
    try {
      const blob = await getSavedQrPngBlob(item);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast({ title: 'Copied!', description: 'QR code image copied to clipboard.' });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Copy failed';
      toast({ title: 'Could not copy image', description, variant: 'destructive' });
    }
  };

  const downloadSavedQr = async (item: SavedQRCode) => {
    try {
      const resolvedLogoStyle = resolveLogoStyleOptions(item.style.logoStyle || undefined);
      const logo = item.style.logo || null;
      const logoPlaceholder = logo && resolvedLogoStyle.badgeSize > 0
        ? buildLogoPlaceholder(
            resolvedLogoStyle.badgeSize,
            resolvedLogoStyle.cornerRadius,
            resolvedLogoStyle.backgroundColor,
          )
        : undefined;

      const downloadSize = item.style.downloadSize || 500;

      const qr = new QRCodeStyling({
        width: downloadSize,
        height: downloadSize,
        data: item.value,
        ...(logoPlaceholder
          ? {
              image: logoPlaceholder,
              imageOptions: {
                hideBackgroundDots: true,
                imageSize: 0.25,
                margin: 8,
                crossOrigin: 'anonymous' as const,
              },
            }
          : {}),
        dotsOptions: {
          color: item.style.fgColor,
          type: bodyShapeToDotType[item.style.bodyShape],
        },
        cornersSquareOptions: {
          color: item.style.patternColor || item.style.fgColor,
          type: bodyShapeToCornerSquareType[item.style.bodyShape],
        },
        cornersDotOptions: {
          color: item.style.patternColor || item.style.fgColor,
          type: bodyShapeToCornerDotType[item.style.bodyShape],
        },
        backgroundOptions: {
          color: item.style.bgColor,
        },
        qrOptions: {
          errorCorrectionLevel: 'H',
        },
      });

      const raw = await qr.getRawData('png');
      if (!(raw instanceof Blob)) {
        throw new Error('Could not generate QR image');
      }

      const qrUrl = URL.createObjectURL(raw);
      const qrImg = new Image();
      qrImg.src = qrUrl;
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
      });

      const scanLabelStyle = {
        ...defaultScanLabelStyle,
        ...(item.style.scanLabelStyle || {}),
      };
      const labelText = (item.style.scanText || '').trim();
      const includeLabel = Boolean(labelText);
      const padding = Math.round(downloadSize * 0.08);
      const fontSize = Math.max(16, Math.round(scanLabelStyle.fontSize * (downloadSize / 400)));
      const textAreaHeight = Math.round(fontSize * 1.6);
      const extraHeight = includeLabel ? textAreaHeight + padding : 0;

      const canvas = document.createElement('canvas');
      canvas.width = downloadSize;
      canvas.height = downloadSize + extraHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas unavailable');
      }

      ctx.fillStyle = item.style.bgColor || '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(qrImg, 0, 0, downloadSize, downloadSize);

      if (logo && resolvedLogoStyle.badgeSize > 0) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          logoImg.src = logo;
          await new Promise<void>((resolve, reject) => {
            logoImg.onload = () => resolve();
            logoImg.onerror = () => reject(new Error('Logo load failed'));
          });

          const badgeSize = Math.round(downloadSize * (resolvedLogoStyle.badgeSize / 100));
          const cx = Math.round(downloadSize / 2);
          const cy = Math.round(downloadSize / 2);
          const badgeX = Math.round(cx - badgeSize / 2);
          const badgeY = Math.round(cy - badgeSize / 2);
          const badgeRadius = Math.round(badgeSize * (resolvedLogoStyle.cornerRadius / 100));

          ctx.beginPath();
          ctx.moveTo(badgeX + badgeRadius, badgeY);
          ctx.lineTo(badgeX + badgeSize - badgeRadius, badgeY);
          ctx.quadraticCurveTo(badgeX + badgeSize, badgeY, badgeX + badgeSize, badgeY + badgeRadius);
          ctx.lineTo(badgeX + badgeSize, badgeY + badgeSize - badgeRadius);
          ctx.quadraticCurveTo(badgeX + badgeSize, badgeY + badgeSize, badgeX + badgeSize - badgeRadius, badgeY + badgeSize);
          ctx.lineTo(badgeX + badgeRadius, badgeY + badgeSize);
          ctx.quadraticCurveTo(badgeX, badgeY + badgeSize, badgeX, badgeY + badgeSize - badgeRadius);
          ctx.lineTo(badgeX, badgeY + badgeRadius);
          ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
          ctx.closePath();

          if (resolvedLogoStyle.backgroundColor !== 'transparent') {
            ctx.fillStyle = resolvedLogoStyle.backgroundColor;
            ctx.fill();
          }

          const logoPad = Math.round(badgeSize * (resolvedLogoStyle.padding / 100));
          const lSize = badgeSize - logoPad * 2;
          ctx.drawImage(logoImg, cx - lSize / 2, cy - lSize / 2, lSize, lSize);
        } catch {
          // Ignore logo draw failures (CORS) and still download base QR.
        }
      }

      if (includeLabel) {
        ctx.fillStyle = scanLabelStyle.color;
        ctx.font = `${scanLabelStyle.fontWeight} ${fontSize}px "${scanLabelStyle.fontFamily}", Satoshi, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          scanLabelStyle.uppercase ? labelText.toUpperCase() : labelText,
          canvas.width / 2,
          downloadSize + padding / 2 + textAreaHeight / 2,
        );
      }

      URL.revokeObjectURL(qrUrl);

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not generate PNG'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      });

      const url = URL.createObjectURL(pngBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFileName(item.name)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast({
        title: 'Downloaded',
        description: 'Saved QR downloaded as PNG.',
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Download failed';
      toast({
        title: 'Could not download QR',
        description,
        variant: 'destructive',
      });
    }
  };

  const totalScans = useMemo(() => {
    return items.reduce((count, item) => count + item.stats.scanCount, 0);
  }, [items]);

  const topItem = useMemo(() => {
    return items.reduce<SavedQRCode | null>((best, item) => {
      if (!best || item.stats.scanCount > best.stats.scanCount) return item;
      return best;
    }, null);
  }, [items]);

  const getRowHandlers = (item: SavedQRCode): QrRowActionHandlers => ({
    onToggleActive: toggleActive,
    onOpen: () => window.open(item.targetValue, '_blank', 'noopener,noreferrer'),
    onAnalytics: () => void openAnalytics(item),
    onEdit: () => setEditingItem(item),
    onAssignFolders: () => setAssigningItem(item),
    onDelete: () => setDeletingItem(item),
  });

  const isFirstFolder = (folder: LinkFolder) =>
    orderedFolders.findIndex((f) => f.id === folder.id) <= 0;
  const isLastFolder = (folder: LinkFolder) =>
    orderedFolders.findIndex((f) => f.id === folder.id) >= orderedFolders.length - 1;

  if (!ownerUid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon icon="lucide:cloud-off" className="h-8 w-8 text-muted-foreground" />
            <h2 className="font-heading text-xl font-bold text-foreground">Sign in to continue</h2>
            <p className="text-sm text-muted-foreground">
              The dashboard is private. Sign in as the owner to manage your saved QR codes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Full-width header */}
      <header className="border-b border-border bg-card">
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dashboard</p>
              <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Saved QR Codes</h1>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <ThemeToggle />
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/" className="inline-flex items-center gap-2">
                <Icon icon="lucide:palette" className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="rounded-full" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? (
                <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
              ) : (
                <Icon icon="lucide:log-out" className="h-4 w-4" />
              )}
            </Button>
            <DestructiveConfirmDialog
              trigger={
                <Button variant="destructive" disabled={items.length === 0} className="rounded-full">
                  Clear all
                </Button>
              }
              title="Delete all saved QR codes?"
              description="This will permanently delete every saved QR code in your dashboard. Their short links will stop working immediately."
              actionLabel="Yes, delete all"
              onConfirm={clearAll}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 sm:px-6 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total saved</CardDescription>
              <CardTitle className="text-3xl">{items.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total scans</CardDescription>
              <CardTitle className="text-3xl">{totalScans}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Search results</CardDescription>
              <CardTitle className="text-3xl">{visibleMatches}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-2">
              <CardDescription>Top scanned</CardDescription>
              <div className="min-h-[36px]">
                {topItem && topItem.stats.scanCount > 0 ? (
                  <div>
                    <CardTitle className="truncate text-base font-semibold" title={topItem.name}>{topItem.name}</CardTitle>
                    <CardDescription>{topItem.stats.scanCount} scan{topItem.stats.scanCount !== 1 ? 's' : ''}</CardDescription>
                  </div>
                ) : (
                  <CardTitle className="text-base font-semibold text-muted-foreground">No scans yet</CardTitle>
                )}
              </div>
            </CardHeader>
          </Card>
        </section>

        <section className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon
              icon="lucide:search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, type, or QR value"
              className="h-11 w-full rounded-full pl-9"
            />
          </div>
          <Button
            variant="outline"
            className="shrink-0 rounded-full"
            onClick={() => setFolderCreateOpen(true)}
          >
            <Icon icon="lucide:folder-plus" className="h-4 w-4" />
            New folder
          </Button>
        </section>

        <section className="flex flex-wrap items-center gap-2">
          <div className="ml-auto flex items-center rounded-full border border-border">
            {(['all', 'active', 'inactive'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 text-sm first:rounded-l-full last:rounded-r-full transition-colors ${
                  statusFilter === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </section>

        {selected.size > 0 && (
          <section className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-md backdrop-blur">
            <span className="text-sm font-medium text-foreground">
              {selected.size} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={clearSelection}>
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setBulkFolderOpen(true)}
              >
                <Icon icon="lucide:folder-move" className="h-4 w-4" />
                Folders…
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void bulkSetActive(!allSelectedActive)}
              >
                <Icon icon={allSelectedActive ? 'lucide:power-off' : 'lucide:power'} className="h-4 w-4" />
                {allSelectedActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Icon icon="lucide:trash-2" className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </section>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
              Loading saved QR codes
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-secondary p-3">
                <Icon icon="lucide:folder-open" className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground">
                {items.length === 0 ? 'No saved QR codes yet' : 'No matching QR codes'}
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {items.length === 0
                  ? 'Go to the creator, generate a QR code, and click Save to start building your dashboard library.'
                  : 'Try a different search or status filter.'}
              </p>
              <Button asChild className="rounded-full">
                <Link href="/">Create first QR</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all QR codes on this page"
                        className="h-4 w-4 accent-primary"
                      />
                    </th>
                    <th className="px-4 py-3">
                      <SortHeaderButton
                        label="Name"
                        sortKey="name"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Destination</th>
                    <th className="px-4 py-3 text-right font-medium">
                      <SortHeaderButton
                        label="Scans"
                        sortKey="scanCount"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <SortHeaderButton
                        label="Created"
                        sortKey="createdAt"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Preview</th>
                    <th className="px-4 py-3 font-medium">Copy</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((entry) =>
                    entry.kind === 'group' ? (
                      <tr
                        key={`group-${entry.group.key}`}
                        className="border-y border-border bg-muted/20"
                      >
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => {
                                  if (el) el.indeterminate = groupSomeSelected(entry.group);
                                }}
                                type="checkbox"
                                checked={groupAllSelected(entry.group)}
                                onChange={() => toggleGroupSelection(entry.group)}
                                disabled={entry.group.items.length === 0}
                                aria-label={`Select all QR codes in ${entry.group.title}`}
                                className="h-4 w-4 accent-primary disabled:opacity-30"
                              />
                              <button
                                onClick={() => toggleCollapsed(entry.group.key)}
                                className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                                aria-expanded={!collapsed.has(entry.group.key)}
                              >
                                <Icon
                                  icon={
                                    collapsed.has(entry.group.key)
                                      ? 'lucide:chevron-right'
                                      : 'lucide:chevron-down'
                                  }
                                  className="h-4 w-4 text-muted-foreground transition-transform"
                                />
                                <Icon
                                  icon={entry.group.icon}
                                  className="h-4 w-4 text-muted-foreground"
                                />
                                {entry.group.title}
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                                  {entry.group.items.length}
                                </span>
                                {entry.group.folder && entry.group.items.length === 0 && (
                                  <span className="text-xs font-normal text-muted-foreground">
                                    No QR codes yet
                                  </span>
                                )}
                              </button>
                            </div>
                            {entry.group.folder ? (
                              <div className="flex items-center gap-1">
                                <button
                                  aria-label={`Move folder ${entry.group.folder.name} up`}
                                  title="Move folder up"
                                  disabled={isFirstFolder(entry.group.folder)}
                                  onClick={() => moveFolder(entry.group.folder, -1)}
                                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                                >
                                  <Icon icon="lucide:arrow-up" className="h-4 w-4" />
                                </button>
                                <button
                                  aria-label={`Move folder ${entry.group.folder.name} down`}
                                  title="Move folder down"
                                  disabled={isLastFolder(entry.group.folder)}
                                  onClick={() => moveFolder(entry.group.folder, 1)}
                                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                                >
                                  <Icon icon="lucide:arrow-down" className="h-4 w-4" />
                                </button>
                                <button
                                  aria-label={`Delete folder ${entry.group.folder.name}`}
                                  title="Delete folder"
                                  onClick={() => setFolderToDelete(entry.group.folder)}
                                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                                >
                                  <Icon icon="lucide:trash-2" className="h-4 w-4" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={`${entry.group.key}-${entry.item.id}`}
                        className={`transition-colors ${
                          selected.has(entry.item.id) ? 'bg-muted/40' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(entry.item.id)}
                            onChange={() => toggleSelected(entry.item.id)}
                            aria-label={`Select ${entry.item.name}`}
                            className="h-4 w-4 accent-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <DisplayNameBadge item={entry.item} />
                        </td>
                        <td
                          className="max-w-[200px] truncate px-4 py-3 text-muted-foreground"
                          title={entry.item.targetValue || entry.item.value}
                        >
                          {formatDestinationSummary(entry.item.targetValue || entry.item.value)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {entry.item.stats.scanCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {timeAgo(entry.item.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <QrActiveSwitch item={entry.item} onToggle={toggleActive} />
                        </td>
                        <td className="px-4 py-3">
                          <QuickPreviewButton onClick={() => setPreviewItem(entry.item)} />
                        </td>
                        <td className="px-4 py-3">
                          <QuickCopyButton item={entry.item} onCopy={() => copyShortLink(entry.item)} />
                        </td>
                        <td className="px-4 py-3">
                          <RowActionMenu item={entry.item} {...getRowHandlers(entry.item)} />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border lg:hidden">
              {pageItems.map((entry) =>
                entry.kind === 'group' ? (
                  <li
                    key={`group-${entry.group.key}`}
                    className="flex items-center justify-between gap-2 bg-muted/20 px-4 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <input
                        ref={(el) => {
                          if (el) el.indeterminate = groupSomeSelected(entry.group);
                        }}
                        type="checkbox"
                        checked={groupAllSelected(entry.group)}
                        onChange={() => toggleGroupSelection(entry.group)}
                        disabled={entry.group.items.length === 0}
                        aria-label={`Select all QR codes in ${entry.group.title}`}
                        className="h-4 w-4 shrink-0 accent-primary disabled:opacity-30"
                      />
                      <button
                        onClick={() => toggleCollapsed(entry.group.key)}
                        className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground"
                      >
                        <Icon
                          icon={
                            collapsed.has(entry.group.key)
                              ? 'lucide:chevron-right'
                              : 'lucide:chevron-down'
                          }
                          className="h-4 w-4 text-muted-foreground"
                        />
                        <Icon icon={entry.group.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 truncate">{entry.group.title}</span>
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                          {entry.group.items.length}
                        </span>
                        {entry.group.folder && entry.group.items.length === 0 && (
                          <span className="shrink-0 text-xs font-normal text-muted-foreground">
                            No QR codes yet
                          </span>
                        )}
                      </button>
                    </div>
                    {entry.group.folder ? (
                      <div className="flex items-center gap-1">
                        <button
                          aria-label={`Move folder ${entry.group.folder.name} up`}
                          title="Move folder up"
                          disabled={isFirstFolder(entry.group.folder)}
                          onClick={() => moveFolder(entry.group.folder, -1)}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        >
                          <Icon icon="lucide:arrow-up" className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Move folder ${entry.group.folder.name} down`}
                          title="Move folder down"
                          disabled={isLastFolder(entry.group.folder)}
                          onClick={() => moveFolder(entry.group.folder, 1)}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                        >
                          <Icon icon="lucide:arrow-down" className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Delete folder ${entry.group.folder.name}`}
                          title="Delete folder"
                          onClick={() => setFolderToDelete(entry.group.folder)}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Icon icon="lucide:trash-2" className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </li>
                ) : (
                  <li
                    key={`${entry.group.key}-${entry.item.id}`}
                    className={`flex items-center gap-2 px-4 py-3 ${
                      selected.has(entry.item.id) ? 'bg-muted/40' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entry.item.id)}
                      onChange={() => toggleSelected(entry.item.id)}
                      aria-label={`Select ${entry.item.name}`}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <DisplayNameBadge item={entry.item} />
                    <span
                      className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
                      title={entry.item.targetValue || entry.item.value}
                    >
                      {formatDestinationSummary(entry.item.targetValue || entry.item.value)}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {entry.item.stats.scanCount} scans · {timeAgo(entry.item.stats.lastScannedAt)}
                    </span>
                    <div className="shrink-0">
                      <QuickPreviewButton onClick={() => setPreviewItem(entry.item)} />
                      <QuickCopyButton item={entry.item} onCopy={() => copyShortLink(entry.item)} />
                    </div>
                    <RowActionMenu item={entry.item} {...getRowHandlers(entry.item)} />
                  </li>
                ),
              )}
            </ul>
            {totalPages > 1 && (
              <PaginationControls
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </Card>
        )}
      </div>

      <Dialog open={previewItem !== null} onOpenChange={(open) => { if (!open) setPreviewItem(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewItem?.name}</DialogTitle>
            <DialogDescription>Full preview and redownload for this saved QR code.</DialogDescription>
          </DialogHeader>
          {previewItem && (
            <>
              <div className="flex justify-center py-3" style={{ background: previewItem.style.bgGradient || previewItem.style.bgColor }}>
                <SavedQrStyledPreview item={previewItem} size={280} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-full" disabled={!previewItem.trackingUrl} onClick={() => copyShortLink(previewItem)}>
                    <Icon icon="lucide:link-2" className="h-4 w-4" />
                    {previewItem.trackingUrl ? 'Copy short link' : 'Copy destination'}
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => copyQrImage(previewItem)}>
                    <Icon icon="lucide:copy" className="h-4 w-4" />
                    Copy QR code
                  </Button>
                </div>
                <Button className="rounded-full" onClick={() => downloadSavedQr(previewItem)}>
                  <Icon icon="lucide:download" className="h-4 w-4" />
                  Download QR code
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={analyticsItem !== null} onOpenChange={(open) => { if (!open) setAnalyticsItem(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="lucide:bar-chart-2" className="h-4 w-4" />
              {analyticsItem?.name}
            </DialogTitle>
            <DialogDescription>Scan analytics from tracking events</DialogDescription>
          </DialogHeader>
          {scanEventsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Icon icon="bx:loader-circle" className="h-5 w-5 animate-spin" />
              Loading scan events…
            </div>
          ) : analyticsItem ? (
            <AnalyticsContent item={analyticsItem} events={scanEvents} />
          ) : null}
        </DialogContent>
      </Dialog>

      <EditQrDialog
        item={editingItem}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        folders={orderedFolders}
        ownerUid={ownerUid}
      />

      <AssignFoldersDialog
        item={assigningItem}
        onOpenChange={(open) => { if (!open) setAssigningItem(null); }}
        folders={orderedFolders}
        ownerUid={ownerUid}
      />

      <DestructiveConfirmDialog
        open={deletingItem !== null}
        onOpenChange={(open) => { if (!open) setDeletingItem(null); }}
        title={`Delete "${deletingItem?.name ?? ''}"?`}
        description="This will permanently delete the saved QR code and its scan analytics. Its short link will stop working immediately."
        actionLabel="Yes, delete"
        onConfirm={() => {
          if (deletingItem) {
            void removeItem(deletingItem);
          }
        }}
      />

      <CreateFolderDialog
        open={folderCreateOpen}
        onOpenChange={setFolderCreateOpen}
        ownerUid={ownerUid}
      />

      <DestructiveConfirmDialog
        open={folderToDelete !== null}
        onOpenChange={(open) => { if (!open) setFolderToDelete(null); }}
        title={`Delete "${folderToDelete?.name ?? ''}"?`}
        description="This deletes the folder. The QR codes inside it are kept and will move to Uncategorized."
        actionLabel="Yes, delete"
        onConfirm={() => {
          if (folderToDelete) {
            void removeFolder(folderToDelete);
          }
        }}
      />

      <BulkFolderDialog
        open={bulkFolderOpen}
        onOpenChange={setBulkFolderOpen}
        folders={orderedFolders}
        count={selected.size}
        onApply={applyBulkFolders}
        ownerUid={ownerUid}
      />

      <DestructiveConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} QR code${selected.size === 1 ? '' : 's'}?`}
        description="This will permanently delete the selected QR codes and all of their scan analytics. Their short links will stop working immediately."
        actionLabel="Yes, delete all"
        onConfirm={() => {
          void bulkDelete();
        }}
      />
    </div>
  );
}
