"use client";

import { useEffect, useMemo, useState } from 'react';
import { QRPreview } from '@/components/QRPreview';
import { QRTypeSelector, QRType, qrTypes } from '@/components/QRTypeSelector';
import { QRStyleTabs, FrameStyle } from '@/components/QRStyleTabs';
import { BodyShape } from '@/components/BodyShapeSelector';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { getImageSrc } from '@/lib/utils';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { defaultLogoStyleOptions, LogoStyleOptions } from '@/components/logoStyle';
import { defaultScanLabelStyle, ScanLabelStyleOptions } from '@/components/scanLabelStyle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/use-theme';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { getCurrentOwnerUid } from '@/lib/authOwner';
import { saveQrCodeForOwner, subscribeToOwnerQrCodes } from '@/lib/firestoreQrCodes';
import { firebaseAuth, storage } from '@/integrations/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { getBooleanEnv } from '@/lib/env';

export type LogoSource = 'none' | 'upload' | 'favicon' | 'logo-dev';
export type LogoDevLookupMode = 'domain' | 'name' | 'ticker' | 'crypto' | 'isin';
type UploadableQRType = Extract<QRType, 'image' | 'pdf' | 'mp3'>;
const uploadableMimePrefixes: Record<UploadableQRType, string[]> = {
  image: ['image/'],
  pdf: ['application/pdf'],
  mp3: ['audio/mpeg', 'audio/mp3'],
};
const uploadableMaxBytes: Record<UploadableQRType, number> = {
  image: 10 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  mp3: 25 * 1024 * 1024,
};

const normalizeLogoDevQuery = (mode: LogoDevLookupMode, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (mode === 'domain') {
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
    const withoutWww = withoutProtocol.replace(/^www\./i, '');
    const host = withoutWww.split('/')[0]?.split('?')[0] ?? '';
    return host.toLowerCase();
  }

  if (mode === 'name') {
    return encodeURIComponent(trimmed);
  }

  return trimmed.toUpperCase();
};

const buildLogoDevUrl = (
  mode: LogoDevLookupMode,
  rawValue: string,
  publishableKey?: string,
) => {
  if (!publishableKey) return null;

  const normalized = normalizeLogoDevQuery(mode, rawValue);
  if (!normalized) return null;

  const params = new URLSearchParams({
    token: publishableKey,
    size: '256',
    format: 'png',
    retina: 'true',
  });

  const path = mode === 'domain' ? normalized : `${mode}/${normalized}`;
  return `https://img.logo.dev/${path}?${params.toString()}`;
};

const deriveLogoDevLookup = (
  qrType: QRType,
  values: {
    urlValue: string;
    appValue: string;
    emailAddress: string;
  },
): { mode: LogoDevLookupMode; query: string } | null => {
  if (qrType === 'url' && values.urlValue.trim()) {
    return { mode: 'domain', query: values.urlValue };
  }

  if (qrType === 'app' && values.appValue.trim()) {
    return { mode: 'domain', query: values.appValue };
  }

  if (qrType === 'email' && values.emailAddress.includes('@')) {
    const domain = values.emailAddress.split('@')[1]?.trim();
    if (domain) {
      return { mode: 'domain', query: domain };
    }
  }

  return null;
};

const Index = () => {
  const privateMode = getBooleanEnv(process.env.NEXT_PUBLIC_PRIVATE_MODE);
  const logoDevPublishableKey = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  // QR Type
  const [qrType, setQrType] = useState<QRType>('url');

  // Per-type content values (keyed by QR type)
  const [typeValues, setTypeValues] = useState<Partial<Record<QRType, string>>>({});

  const currentValue = typeValues[qrType] ?? '';
  const setCurrentValue = (v: string) => setTypeValues(prev => ({ ...prev, [qrType]: v }));

  // WiFi specific
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  
  // Email specific
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  
  // SMS specific
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  
  // Styling - in-memory state (no localStorage persistence)
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('rounded-lg');
  const [fgColor, setFgColor] = useState('#1A1A1A');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [patternColor, setPatternColor] = useState<string | null>(null);
  const [bgGradient, setBgGradient] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoSource, setLogoSource] = useState<LogoSource>('favicon');
  const [logoDevMode, setLogoDevMode] = useState<LogoDevLookupMode>('domain');
  const [logoDevQuery, setLogoDevQuery] = useState('');
  const [bodyShape, setBodyShape] = useState<BodyShape>('dots');
  const [qrSize, setQrSize] = useState(500);
  const [scanText, setScanText] = useState('');
  const [scanLabelStyle, setScanLabelStyle] = useState<ScanLabelStyleOptions>(defaultScanLabelStyle);
  const [logoStyle, setLogoStyle] = useState<LogoStyleOptions>(defaultLogoStyleOptions);
  const [savedCount, setSavedCount] = useState(0);
  const [isDestinationUploadInProgress, setIsDestinationUploadInProgress] = useState(false);
  const [canSavePrivately, setCanSavePrivately] = useState(!privateMode);

  useEffect(() => {
    if (!privateMode || !firebaseAuth) {
      setCanSavePrivately(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setCanSavePrivately(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/private/owner', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await response.json()) as { allowed?: boolean };
        setCanSavePrivately(Boolean(data.allowed));
      } catch {
        setCanSavePrivately(false);
      }
    });

    return () => unsubscribe();
  }, [privateMode]);

  useEffect(() => {
    const ownerUid = getCurrentOwnerUid();
    if (!ownerUid) return;

    const unsubscribe = subscribeToOwnerQrCodes(ownerUid, (items) => {
      setSavedCount(items.length);
    });

    return () => unsubscribe();
  }, []);

  // Generate QR value based on type
  const qrValue = useMemo(() => {
    switch (qrType) {
      case 'wifi':
        if (!wifiSSID) return '';
        return `WIFI:T:${wifiEncryption};S:${wifiSSID};P:${wifiPassword};;`;
      case 'email': {
        if (!emailAddress) return '';
        let emailStr = `mailto:${emailAddress}`;
        const params: string[] = [];
        if (emailSubject) params.push(`subject=${encodeURIComponent(emailSubject)}`);
        if (emailBody) params.push(`body=${encodeURIComponent(emailBody)}`);
        if (params.length > 0) emailStr += `?${params.join('&')}`;
        return emailStr;
      }
      case 'sms': {
        if (!smsPhone) return '';
        let smsStr = `sms:${smsPhone}`;
        if (smsMessage) smsStr += `?body=${encodeURIComponent(smsMessage)}`;
        return smsStr;
      }
      default:
        return currentValue;
    }
  }, [qrType, currentValue, wifiSSID, wifiPassword, wifiEncryption, emailAddress, emailSubject, emailBody, smsPhone, smsMessage]);

  // Derive an auto-favicon URL for URL-type QR codes when the user hasn't
  // uploaded their own logo.
  const autoFaviconUrl = useMemo(() => {
    if (qrType !== 'url' || !currentValue) return null;
    try {
      const withProto = /^https?:\/\//i.test(currentValue) ? currentValue : `https://${currentValue}`;
      const host = new URL(withProto).hostname;
      if (!host) return null;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
    } catch {
      return null;
    }
  }, [qrType, currentValue]);

  const derivedLogoDevLookup = useMemo(
    () => deriveLogoDevLookup(qrType, {
      urlValue: typeValues['url'] ?? '',
      appValue: typeValues['app'] ?? '',
      emailAddress,
    }),
    [typeValues, emailAddress, qrType],
  );

  const effectiveLogoDevMode = logoDevQuery.trim() ? logoDevMode : (derivedLogoDevLookup?.mode ?? logoDevMode);
  const effectiveLogoDevQuery = logoDevQuery.trim() || derivedLogoDevLookup?.query || '';

  const logoDevUrl = useMemo(
    () => buildLogoDevUrl(effectiveLogoDevMode, effectiveLogoDevQuery, logoDevPublishableKey),
    [effectiveLogoDevMode, effectiveLogoDevQuery, logoDevPublishableKey],
  );

  const effectiveLogo = useMemo(() => {
    switch (logoSource) {
      case 'upload':
        return logo;
      case 'favicon':
        return autoFaviconUrl;
      case 'logo-dev':
        return logoDevUrl;
      default:
        return null;
    }
  }, [autoFaviconUrl, logo, logoDevUrl, logoSource]);

  const uploadQrDestinationFile = async (type: UploadableQRType, file: File) => {
    if (privateMode && !canSavePrivately) {
      throw new Error('File uploads are owner-only on this deployment. Fork and self-host to enable uploads.');
    }

    const ownerUid = getCurrentOwnerUid();
    if (!ownerUid) {
      throw new Error('Sign in required before uploading files.');
    }

    if (!storage) {
      throw new Error('Firebase Storage is not configured. Check NEXT_PUBLIC_FIREBASE_* env vars.');
    }

    const allowedMimePatterns = uploadableMimePrefixes[type];
    const normalizedFileType = file.type.trim().toLowerCase();
    const hasAllowedMime = allowedMimePatterns.some((pattern) =>
      pattern.endsWith('/') ? normalizedFileType.startsWith(pattern) : normalizedFileType === pattern,
    );

    if (!hasAllowedMime) {
      throw new Error(`Invalid file type for ${type.toUpperCase()} QR.`);
    }

    const maxBytes = uploadableMaxBytes[type];
    if (file.size > maxBytes) {
      const limitMb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(`File is too large for ${type.toUpperCase()} QR. Maximum size is ${limitMb} MB.`);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectRef = ref(
      storage,
      `users/${ownerUid}/qr-targets/${type}/${Date.now()}-${crypto.randomUUID()}-${safeName}`,
    );

    setIsDestinationUploadInProgress(true);
    try {
      await uploadBytes(objectRef, file, {
        contentType: normalizedFileType || undefined,
        cacheControl: 'public,max-age=31536000,immutable',
      });
      const publicUrl = await getDownloadURL(objectRef);
      setTypeValues((prev) => ({ ...prev, [type]: publicUrl }));
      return publicUrl;
    } finally {
      setIsDestinationUploadInProgress(false);
    }
  };

  const saveCurrentQrCode = async () => {
    const value = qrValue.trim();
    if (!value) return;

    if (privateMode && !canSavePrivately) {
      toast({
        title: 'Saving is private in this demo',
        description: 'Open Dashboard to sign in as the owner, or fork and self-host to enable your own private saves.',
        variant: 'destructive',
      });
      return;
    }

    const ownerUid = getCurrentOwnerUid();
    if (!ownerUid) {
      toast({
        title: 'Sign in required',
        description: 'Owner session is missing. Please sign in again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const saved = await saveQrCodeForOwner({
        ownerUid,
        type: qrType,
        value,
        style: {
          fgColor,
          bgColor,
          patternColor,
          bgGradient,
          frameStyle,
          bodyShape,
          logo: effectiveLogo,
          logoStyle,
          scanText,
          scanLabelStyle,
          downloadSize: qrSize,
        },
      });

      toast({
        title: 'Saved to dashboard',
        description: saved.trackingUrl
          ? 'Saved with scan tracking. Use dashboard tracking links for analytics.'
          : 'Your QR code is now in the dashboard library.',
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Could not save QR code';
      toast({
        title: 'Save failed',
        description,
        variant: 'destructive',
      });
    }
  };

  const sharedStyleTabsProps = {
    qrType,
    value: currentValue,
    onValueChange: setCurrentValue,
    onUploadDestinationFile: privateMode && !canSavePrivately ? undefined : uploadQrDestinationFile,
    isDestinationUploading: isDestinationUploadInProgress,
    wifiSSID,
    onWifiSSIDChange: setWifiSSID,
    wifiPassword,
    onWifiPasswordChange: setWifiPassword,
    wifiEncryption,
    onWifiEncryptionChange: setWifiEncryption,
    emailAddress,
    onEmailAddressChange: setEmailAddress,
    emailSubject,
    onEmailSubjectChange: setEmailSubject,
    emailBody,
    onEmailBodyChange: setEmailBody,
    smsPhone,
    onSmsPhoneChange: setSmsPhone,
    smsMessage,
    onSmsMessageChange: setSmsMessage,
    frameStyle,
    onFrameStyleChange: setFrameStyle,
    fgColor,
    onFgColorChange: setFgColor,
    bgColor,
    onBgColorChange: setBgColor,
    patternColor,
    onPatternColorChange: setPatternColor,
    bgGradient,
    onBgGradientChange: setBgGradient,
    logo,
    onLogoChange: setLogo,
    logoSource,
    onLogoSourceChange: setLogoSource,
    logoDevMode,
    onLogoDevModeChange: setLogoDevMode,
    logoDevQuery,
    onLogoDevQueryChange: setLogoDevQuery,
    derivedLogoDevMode: derivedLogoDevLookup?.mode ?? null,
    derivedLogoDevQuery: derivedLogoDevLookup?.query ?? '',
    logoStyle,
    onLogoStyleChange: setLogoStyle,
    bodyShape,
    onBodyShapeChange: setBodyShape,
    scanText,
    onScanTextChange: setScanText,
    scanLabelStyle,
    onScanLabelStyleChange: setScanLabelStyle,
    autoFaviconUrl,
    logoDevUrl,
    isLogoDevConfigured: Boolean(logoDevPublishableKey),
  };

  return (
    <div className="min-h-screen w-full bg-background xl:flex">
        {/* Left Sidebar - QR Type Selector */}
        <aside className="hidden w-72 flex-shrink-0 bg-background pt-8 pl-4 pr-2 xl:block">
          <ScrollArea className="h-[calc(100vh-2rem)] pr-2">
            <QRTypeSelector
              selectedType={qrType}
              onTypeChange={setQrType}
            />
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <div className="flex min-h-screen flex-col xl:flex-1">
        <div className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-6 lg:px-8 xl:pt-6">
          <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/logo.png" alt="QR Canvas" className="h-11 w-11 flex-shrink-0 rounded-xl sm:h-12 sm:w-12" />
              <div className="min-w-0">
                <h1 className="truncate font-heading text-xl font-bold text-foreground">QR Canvas</h1>
                {privateMode && canSavePrivately ? (
                  <>
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      Generate dynamic QR codes with scan tracking.
                    </p>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      Generate dynamic QR codes with scan tracking.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      Create Static QR codes instantly. Dynamic QR codes, dashboard of saved QR codes, and tracking analytics are owner-only.
                    </p>
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      <a
                        href="https://github.com/iamsainikhil/qr-canvas"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 transition-colors hover:text-foreground"
                      >
                        Fork on GitHub
                      </a>{' '}
                      to self-host and unlock the full private QR canvas studio.
                    </p>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      Public demo: QR creation only.
                    </p>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      <a
                        href="https://github.com/iamsainikhil/qr-canvas"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 transition-colors hover:text-foreground"
                      >
                        Fork on GitHub
                      </a>{' '}
                      to self-host for destination updates + analytics.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <Icon icon="line-md:sunny-outline-to-moon-loop-transition" className="!size-5" />
                ) : (
                  <Icon icon="line-md:moon-to-sunny-outline-loop-transition" className="!size-5" />
                )}
              </Button>
              <Button asChild variant="paper" className="rounded-full">
              <Link href="/dashboard" className="inline-flex items-center gap-2 whitespace-nowrap">
                <Icon icon="lucide:layout-dashboard" className="h-4 w-4" />
                Dashboard ({savedCount})
              </Link>
            </Button>
            </div>
          </header>
        </div>

        {/* Mobile QR Type Selector - Dropdown */}
        <div className="mx-auto mt-4 w-full max-w-7xl px-3 sm:px-6 lg:px-8 xl:hidden">
          <div className="mb-4 rounded-2xl border border-border bg-card p-3 sm:p-4">
            <h2 className="mb-2 font-heading text-[18px] font-bold leading-[120%] tracking-tight text-foreground sm:mb-3 sm:text-[20px]">Select QR type</h2>
            <Select value={qrType} onValueChange={(value) => setQrType(value as QRType)}>
              <SelectTrigger className="h-12 w-full rounded-xl border-border bg-background focus:border-border focus:outline-none focus:ring-0 focus:ring-offset-0 sm:h-14">
                <SelectValue>
                  {(() => {
                    const selected = qrTypes.find(opt => opt.id === qrType);
                    return selected ? (
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <img 
                          src={getImageSrc(selected.image)} 
                          alt={selected.label} 
                          className="h-6 w-9 rounded object-cover sm:h-7 sm:w-10"
                        />
                        <span className="font-medium">{selected.label}</span>
                      </div>
                    ) : 'Select type';
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {qrTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id} className="h-12 py-1.5 sm:h-14 sm:py-2">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <img 
                        src={getImageSrc(type.image)} 
                        alt={type.label} 
                        className="h-6 w-9 rounded object-cover sm:h-7 sm:w-10"
                      />
                      <span className="font-medium">{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2 flex flex-col md:mt-5 md:flex-row md:items-start xl:mt-6">
          {/* Center - QR Preview */}
          <main className="flex w-full min-w-0 flex-col items-center justify-center px-3 pb-4 pt-0 sm:px-6 md:flex-1 md:justify-start md:px-8 md:pb-6 xl:px-12 xl:pt-6">
            <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-4 sm:max-w-md sm:p-5 xl:sticky xl:top-6" style={{ boxShadow: '0 14px 8px 0 rgba(64, 64, 64, 0.04), 0 6px 6px 0 rgba(64, 64, 64, 0.07), 0 2px 3px 0 rgba(64, 64, 64, 0.08)' }}>
              <h2 className="font-heading text-[20px] font-bold tracking-tight text-foreground leading-[120%] mb-3">Live preview</h2>
              <div className="mb-5">
                <QRStyleTabs
                  {...sharedStyleTabsProps}
                  showContentSection
                  showStyleSection={false}
                />
              </div>
              <QRPreview
                qrValue={qrValue}
                fgColor={fgColor}
                bgColor={bgColor}
                patternColor={patternColor || undefined}
                bgGradient={bgGradient}
                frameStyle={frameStyle}
                logo={effectiveLogo}
                logoStyle={logoStyle}
                bodyShape={bodyShape}
                downloadSize={qrSize}
                onDownloadSizeChange={setQrSize}
                scanText={scanText}
                scanLabelStyle={scanLabelStyle}
                onSave={saveCurrentQrCode}
                saveDisabled={privateMode && !canSavePrivately}
                saveDisabledTitle={
                  privateMode && !canSavePrivately
                    ? 'Saving is private on this deployment. Open Dashboard for owner access or self-host your own copy.'
                    : 'Save'
                }
              />
              {privateMode && !canSavePrivately && (
                <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-secondary/25 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
                      <Icon icon="solar:lock-linear" className="h-3.5 w-3.5" />
                    </span>
                    <p className="leading-5 text-left">
                      Public demo mode: Download and copy are open. Saving, dashboard analytics, and destination file uploads are owner-only.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
                      <Icon icon="line-md:github" className="h-3.5 w-3.5" />
                    </span>
                    <p className="leading-5 text-left">
                      <a
                        href="https://github.com/iamsainikhil/qr-canvas"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline underline-offset-2 transition-colors hover:text-foreground"
                      >
                        Fork on GitHub
                      </a>{' '}
                      to self-host your own private instance.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Right - Style Panel */}
          <aside className="w-full max-w-full min-w-0 overflow-x-hidden px-3 pb-8 pt-6 sm:px-6 md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:w-[400px] md:flex-shrink-0 md:overflow-y-auto md:overscroll-contain md:px-6 md:pt-2 xl:w-[440px] xl:px-8 xl:pt-6">
            <div className="md:rounded-3xl md:border md:border-border/70 md:bg-card md:p-5 md:shadow-[0_12px_36px_-24px_rgba(15,23,42,0.45)] xl:p-6">
              <QRStyleTabs
                {...sharedStyleTabsProps}
                showContentSection={false}
                showStyleSection
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Index;
