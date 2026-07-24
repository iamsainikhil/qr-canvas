"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { SavedQRCode, qrTypeLabel } from '@/lib/savedQrCodes';
import { getContrastingTextColor } from '@/lib/utils';
import { defaultScanLabelStyle } from '@/components/scanLabelStyle';
import { resolveLogoStyleOptions } from '@/components/logoStyle';
import { ensureGoogleFontLoaded } from '@/lib/fontRegistry';
import {
  ScanEvent,
  clearAllQrCodesForOwner,
  deleteQrCodeForOwner,
  fetchQrScanEvents,
  updateQrCodeDestinationForOwner,
  subscribeToOwnerQrCodes,
} from '@/lib/firestoreQrCodes';
import { getCurrentOwnerUid } from '@/lib/authOwner';

type DestructiveConfirmDialogProps = {
  trigger: React.ReactElement;
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  onConfirm: () => void | Promise<void>;
};

function DestructiveConfirmDialog({ trigger, title, description, actionLabel, onConfirm }: DestructiveConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
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
              color: getContrastingTextColor(item.style.bgColor || '#FFFFFF'),
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

export default function Dashboard() {
  const [savedQRCodes, setSavedQRCodes] = useState<SavedQRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const ownerUid = getCurrentOwnerUid();
  const [query, setQuery] = useState('');
  const { toast } = useToast();
  const [analyticsQr, setAnalyticsQr] = useState<SavedQRCode | null>(null);
  const [editingQr, setEditingQr] = useState<SavedQRCode | null>(null);
  const [destinationDraft, setDestinationDraft] = useState('');
  const [savingDestination, setSavingDestination] = useState(false);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [scanEventsLoading, setScanEventsLoading] = useState(false);

  const openAnalytics = async (item: SavedQRCode) => {
    setAnalyticsQr(item);
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

  useEffect(() => {
    if (!ownerUid) {
      setSavedQRCodes([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOwnerQrCodes(
      ownerUid,
      (items) => {
        setSavedQRCodes(items);
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

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return savedQRCodes;

    return savedQRCodes.filter((item) => {
      return item.name.toLowerCase().includes(term)
        || item.value.toLowerCase().includes(term)
        || item.targetValue.toLowerCase().includes(term)
        || qrTypeLabel[item.type].toLowerCase().includes(term);
    });
  }, [query, savedQRCodes]);

  const totalScans = useMemo(() => {
    return savedQRCodes.reduce((count, item) => count + item.stats.scanCount, 0);
  }, [savedQRCodes]);

  const topQr = useMemo(() => {
    return savedQRCodes.reduce<SavedQRCode | null>((best, item) => {
      if (!best || item.stats.scanCount > best.stats.scanCount) return item;
      return best;
    }, null);
  }, [savedQRCodes]);

  const deleteItem = async (qr: SavedQRCode) => {
    if (!ownerUid) return;

    try {
      await deleteQrCodeForOwner(ownerUid, qr);
      toast({
        title: 'QR removed',
        description: 'The saved QR code was removed from your dashboard.',
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Delete failed';
      toast({
        title: 'Could not remove QR',
        description,
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
      const description = error instanceof Error ? error.message : 'Clear failed';
      toast({
        title: 'Could not clear dashboard',
        description,
        variant: 'destructive',
      });
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

  const openDestinationEditor = (item: SavedQRCode) => {
    setEditingQr(item);
    setDestinationDraft(item.targetValue);
  };

  const saveDestination = async () => {
    if (!ownerUid || !editingQr) return;

    setSavingDestination(true);
    try {
      const updated = await updateQrCodeDestinationForOwner({
        ownerUid,
        qr: editingQr,
        value: destinationDraft,
      });

      setEditingQr(null);
      setDestinationDraft('');
      if (analyticsQr?.id === updated.id) {
        setAnalyticsQr(updated);
      }

      toast({
        title: 'QR updated',
        description: updated.trackingEnabled
          ? 'The tracking destination was updated without changing the QR code link.'
          : 'The saved QR content was updated.',
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Update failed';
      toast({
        title: 'Could not update QR',
        description,
        variant: 'destructive',
      });
    } finally {
      setSavingDestination(false);
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
      ctx.fillStyle = getContrastingTextColor(item.style.bgColor || '#FFFFFF');
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
        ctx.fillStyle = getContrastingTextColor(item.style.bgColor || '#FFFFFF');
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

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dashboard</p>
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Saved QR Codes</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" className="rounded-full">
                  <Link href="/" className="inline-flex items-center gap-2">
                <Icon icon="lucide:arrow-left" className="h-4 w-4" />
                Back to canvas
              </Link>
            </Button>
            <DestructiveConfirmDialog
              trigger={
                <Button variant="destructive" disabled={savedQRCodes.length === 0} className="rounded-full">
                  Clear all
                </Button>
              }
              title="Delete all saved QR codes?"
              description="This will permanently delete every saved QR code in your dashboard. Their short links will stop working immediately."
              actionLabel="Yes, delete all"
              onConfirm={clearAll}
            />
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total saved</CardDescription>
              <CardTitle className="text-3xl">{savedQRCodes.length}</CardTitle>
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
              <CardTitle className="text-3xl">{filteredItems.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-2">
              <CardDescription>Top scanned</CardDescription>
              <div className="min-h-[36px]">
                {topQr && topQr.stats.scanCount > 0 ? (
                  <div>
                    <CardTitle className="truncate text-base font-semibold" title={topQr.name}>{topQr.name}</CardTitle>
                    <CardDescription>{topQr.stats.scanCount} scan{topQr.stats.scanCount !== 1 ? 's' : ''}</CardDescription>
                  </div>
                ) : (
                  <CardTitle className="text-base font-semibold text-muted-foreground">No scans yet</CardTitle>
                )}
              </div>
            </CardHeader>
          </Card>
        </section>

        <section className="relative">
          <Icon icon="lucide:search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, type, or QR value"
            className="h-11 rounded-full pl-9"
          />
        </section>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
              Loading saved QR codes
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-secondary p-3">
                <Icon icon="lucide:qr-code" className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="font-heading text-xl font-bold text-foreground">No saved QR codes yet</h2>
              <p className="max-w-md text-sm text-muted-foreground">Go to the creator, generate a QR code, and click Save to start building your dashboard library.</p>
              <Button asChild className="rounded-full">
                <Link href="/">Create first QR</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const createdAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
              const cardDestination = item.targetValue || item.value;
              const cardDestinationSummary = formatDestinationSummary(cardDestination);
              const cardTrackingSummary = item.trackingUrl ? formatDestinationSummary(item.trackingUrl) : null;

              return (
                <Card key={item.id} className="flex h-full flex-col overflow-hidden">
                  <CardContent className="flex flex-1 flex-col p-0">
                    <div className="relative border-b border-border p-4" style={{ background: item.style.bgGradient || item.style.bgColor }}>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/20 dark:from-black/25 dark:to-black/55" />
                      <div className="relative flex items-start gap-4 rounded-2xl border border-border/80 bg-card/95 p-3 text-card-foreground shadow-md backdrop-blur-md dark:bg-card/90">
                        <SavedQrStyledPreview item={item} size={88} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{qrTypeLabel[item.type]}</Badge>
                            <span className="rounded-full bg-muted/90 px-2 py-0.5 text-xs text-foreground/80">{createdAgo}</span>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            <p className="flex items-center gap-1.5 text-sm text-foreground/80" title={cardDestination}>
                              <Icon icon="lucide:target" className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{cardDestinationSummary}</span>
                            </p>
                            {cardTrackingSummary && (
                              <p className="flex items-center gap-1.5 text-sm text-foreground/80" title={item.trackingUrl || undefined}>
                                <Icon icon="lucide:link-2" className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{cardTrackingSummary}</span>
                              </p>
                            )}
                          </div>

                          {item.trackingEnabled && (
                            <div className="mt-3 flex items-center gap-3 border-t border-border/80 pt-2 text-xs text-foreground/75">
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                <Icon icon="lucide:bar-chart-2" className="h-3 w-3" />
                                {item.stats.scanCount} scan{item.stats.scanCount !== 1 ? 's' : ''}
                              </span>
                              {item.stats.lastScannedAt && (
                                <span>Last {formatDistanceToNow(new Date(item.stats.lastScannedAt), { addSuffix: true })}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 p-4">
                      {/* Copy actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="rounded-full" onClick={() => copyValue(item.targetValue)}>
                          <Icon icon="lucide:copy" className="h-4 w-4" />
                          Copy destination
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          disabled={!item.trackingUrl}
                          onClick={() => item.trackingUrl && copyValue(item.trackingUrl, 'Short link copied to clipboard.')}
                        >
                          <Icon icon="lucide:link-2" className="h-4 w-4" />
                          Copy short link
                        </Button>
                      </div>

                      {/* Manage actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => openDestinationEditor(item)}
                        >
                          <Icon icon="lucide:pencil" className="h-4 w-4" />
                          {item.trackingEnabled ? 'Edit destination' : 'Edit content'}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          disabled={!canOpenInBrowser(item)}
                          onClick={() => window.open(item.targetValue, '_blank', 'noopener,noreferrer')}
                        >
                          <Icon icon="lucide:external-link" className="h-4 w-4" />
                          Open destination
                        </Button>
                      </div>

                      {/* View actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-full">
                              <Icon icon="lucide:qr-code" className="h-4 w-4" />
                              Preview QR
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                              <DialogTitle>{item.name}</DialogTitle>
                              <DialogDescription>
                                Full preview and redownload for this saved QR code.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-center py-3" style={{ background: item.style.bgGradient || item.style.bgColor }}>
                              <SavedQrStyledPreview item={item} size={280} />
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="rounded-full" disabled={!item.trackingUrl} onClick={() => item.trackingUrl && copyValue(item.trackingUrl, 'Short link copied to clipboard.')}>
                                  <Icon icon="lucide:link-2" className="h-4 w-4" />
                                  {item.trackingUrl ? 'Copy short link' : 'Copy destination'}
                                </Button>
                                <Button variant="outline" className="rounded-full" onClick={() => copyQrImage(item)}>
                                  <Icon icon="lucide:copy" className="h-4 w-4" />
                                  Copy QR code
                                </Button>
                              </div>
                              <Button className="rounded-full" onClick={() => downloadSavedQr(item)}>
                                <Icon icon="lucide:download" className="h-4 w-4" />
                                Download QR code
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        {item.trackingEnabled ? (
                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => openAnalytics(item)}
                          >
                            <Icon icon="lucide:bar-chart-2" className="h-4 w-4" />
                            View analytics
                          </Button>
                        ) : (
                          <Button variant="outline" className="rounded-full" onClick={() => downloadSavedQr(item)}>
                            <Icon icon="lucide:download" className="h-4 w-4" />
                            Download QR code
                          </Button>
                        )}
                      </div>

                      {/* Destructive */}
                      <DestructiveConfirmDialog
                        trigger={
                          <Button variant="destructive" className="rounded-full">
                            <Icon icon="lucide:trash-2" className="h-4 w-4" />
                            Remove
                          </Button>
                        }
                        title={`Remove ${item.name}?`}
                        description="This will permanently remove the saved QR code from your dashboard. Its short link will stop working immediately."
                        actionLabel="Yes, remove"
                        onConfirm={() => deleteItem(item)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </div>

      <Dialog open={analyticsQr !== null} onOpenChange={(open) => { if (!open) setAnalyticsQr(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="lucide:bar-chart-2" className="h-4 w-4" />
              {analyticsQr?.name}
            </DialogTitle>
            <DialogDescription>Scan analytics from tracking events</DialogDescription>
          </DialogHeader>
          {scanEventsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Icon icon="bx:loader-circle" className="h-5 w-5 animate-spin" />
              Loading scan events…
            </div>
          ) : analyticsQr ? (
            <AnalyticsContent item={analyticsQr} events={scanEvents} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingQr !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingQr(null);
            setDestinationDraft('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="lucide:external-link" className="h-4 w-4" />
              {editingQr?.trackingEnabled ? 'Edit destination' : 'Edit content'}
            </DialogTitle>
            <DialogDescription>
              {editingQr?.trackingEnabled
                ? 'Update where this saved QR redirects. The QR image and tracking link stay the same.'
                : 'Update the QR content and save the revised code back to your library.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {editingQr?.trackingEnabled ? 'Destination URL' : 'QR content'}
            </label>
            <Input
              value={destinationDraft}
              onChange={(event) => setDestinationDraft(event.target.value)}
              placeholder={editingQr?.trackingEnabled ? 'https://example.com/new-destination' : 'Enter the updated QR content'}
              className="h-11 rounded-full"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setEditingQr(null);
                setDestinationDraft('');
              }}
              disabled={savingDestination}
            >
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void saveDestination()} disabled={savingDestination}>
              {savingDestination ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
