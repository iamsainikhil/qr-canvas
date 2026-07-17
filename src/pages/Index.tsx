import { useState, useMemo, useEffect } from 'react';
import { QRPreview } from '@/components/QRPreview';
import { QRTypeSelector, QRType } from '@/components/QRTypeSelector';
import { QRStyleTabs, FrameStyle } from '@/components/QRStyleTabs';
import { BodyShape } from '@/components/BodyShapeSelector';

import { useLocalStorage } from '@/hooks/use-local-storage';
import { defaultLogoStyleOptions, LogoStyleOptions } from '@/components/logoStyle';
import { defaultScanLabelStyle, ScanLabelStyleOptions } from '@/components/scanLabelStyle';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Import QR type icons
import urlIcon from '@/assets/qr-type-url.webp';
import textIcon from '@/assets/qr-type-text.webp';
import wifiIcon from '@/assets/qr-type-wifi.webp';
import emailIcon from '@/assets/qr-type-email.webp';
import smsIcon from '@/assets/qr-type-sms.webp';
import imageIcon from '@/assets/qr-type-image.webp';
import pdfIcon from '@/assets/qr-type-pdf.webp';
import mp3Icon from '@/assets/qr-type-mp3.webp';
import appIcon from '@/assets/qr-type-app.webp';
import videoIcon from '@/assets/qr-type-video.webp';

export type LogoSource = 'none' | 'upload' | 'favicon' | 'logo-dev';
export type LogoDevLookupMode = 'domain' | 'name' | 'ticker' | 'crypto' | 'isin';

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

const qrTypeOptions: { id: QRType; label: string; image: string }[] = [
  { id: 'url', label: 'URL', image: urlIcon },
  { id: 'text', label: 'Text', image: textIcon },
  { id: 'wifi', label: 'Wi-Fi', image: wifiIcon },
  { id: 'email', label: 'E-mail', image: emailIcon },
  { id: 'sms', label: 'SMS', image: smsIcon },
  { id: 'image', label: 'Image', image: imageIcon },
  { id: 'pdf', label: 'PDF', image: pdfIcon },
  { id: 'mp3', label: 'MP3', image: mp3Icon },
  { id: 'app', label: 'App', image: appIcon },
  { id: 'video', label: 'Video', image: videoIcon },
];

const Index = () => {
  const logoDevPublishableKey = import.meta.env.VITE_LOGO_DEV_PUBLISHABLE_KEY;

  // QR Type
  const [qrType, setQrType] = useState<QRType>('url');
  
  // Separate values for each type
  const [urlValue, setUrlValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [imageValue, setImageValue] = useState('');
  const [pdfValue, setPdfValue] = useState('');
  const [mp3Value, setMp3Value] = useState('');
  const [appValue, setAppValue] = useState('');
  const [videoValue, setVideoValue] = useState('');
  
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
  
  // Styling - persisted to localStorage
  const [frameStyle, setFrameStyle] = useLocalStorage<FrameStyle>('qr-frameStyle', 'rounded-lg');
  const [fgColor, setFgColor] = useLocalStorage('qr-fgColor', '#1A1A1A');
  const [bgColor, setBgColor] = useLocalStorage('qr-bgColor', '#FFFFFF');
  const [patternColor, setPatternColor] = useLocalStorage<string | null>('qr-patternColor', null);
  const [bgGradient, setBgGradient] = useLocalStorage<string | null>('qr-bgGradient', null);
  const [logo, setLogo] = useLocalStorage<string | null>('qr-logo', null);
  const [logoSource, setLogoSource] = useLocalStorage<LogoSource>('qr-logoSource', 'favicon');
  const [logoDevMode, setLogoDevMode] = useLocalStorage<LogoDevLookupMode>('qr-logoDevMode', 'domain');
  const [logoDevQuery, setLogoDevQuery] = useLocalStorage('qr-logoDevQuery', '');
  const [bodyShape, setBodyShape] = useLocalStorage<BodyShape>('qr-bodyShape', 'dots');
  const [qrSize, setQrSize] = useLocalStorage('qr-qrSize', 500);
  const [scanText, setScanText] = useLocalStorage('qr-scanText', '');
  const [scanLabelStyle, setScanLabelStyle] = useLocalStorage<ScanLabelStyleOptions>('qr-scanLabelStyle', defaultScanLabelStyle);
  const [logoStyle, setLogoStyle] = useLocalStorage<LogoStyleOptions>('qr-logoStyle', defaultLogoStyleOptions);

  // Get current value based on type
  const currentValue = useMemo(() => {
    switch (qrType) {
      case 'url': return urlValue;
      case 'text': return textValue;
      case 'image': return imageValue;
      case 'pdf': return pdfValue;
      case 'mp3': return mp3Value;
      case 'app': return appValue;
      case 'video': return videoValue;
      default: return '';
    }
  }, [qrType, urlValue, textValue, imageValue, pdfValue, mp3Value, appValue, videoValue]);

  // Set value based on current type
  const setCurrentValue = (newValue: string) => {
    switch (qrType) {
      case 'url': setUrlValue(newValue); break;
      case 'text': setTextValue(newValue); break;
      case 'image': setImageValue(newValue); break;
      case 'pdf': setPdfValue(newValue); break;
      case 'mp3': setMp3Value(newValue); break;
      case 'app': setAppValue(newValue); break;
      case 'video': setVideoValue(newValue); break;
    }
  };

  // Generate QR value based on type
  const qrValue = useMemo(() => {
    switch (qrType) {
      case 'url': return urlValue;
      case 'text': return textValue;
      case 'image': return imageValue;
      case 'pdf': return pdfValue;
      case 'mp3': return mp3Value;
      case 'app': return appValue;
      case 'wifi':
        if (!wifiSSID) return '';
        return `WIFI:T:${wifiEncryption};S:${wifiSSID};P:${wifiPassword};;`;
      case 'email':
        if (!emailAddress) return '';
        let emailStr = `mailto:${emailAddress}`;
        const params: string[] = [];
        if (emailSubject) params.push(`subject=${encodeURIComponent(emailSubject)}`);
        if (emailBody) params.push(`body=${encodeURIComponent(emailBody)}`);
        if (params.length > 0) emailStr += `?${params.join('&')}`;
        return emailStr;
      case 'sms':
        if (!smsPhone) return '';
        let smsStr = `sms:${smsPhone}`;
        if (smsMessage) smsStr += `?body=${encodeURIComponent(smsMessage)}`;
        return smsStr;
      case 'video':
        return videoValue;
      default:
        return '';
    }
  }, [qrType, urlValue, textValue, imageValue, pdfValue, mp3Value, appValue, videoValue, wifiSSID, wifiPassword, wifiEncryption, emailAddress, emailSubject, emailBody, smsPhone, smsMessage]);

  // Derive an auto-favicon URL for URL-type QR codes when the user hasn't
  // uploaded their own logo.
  const autoFaviconUrl = useMemo(() => {
    if (qrType !== 'url' || !urlValue) return null;
    try {
      const withProto = /^https?:\/\//i.test(urlValue) ? urlValue : `https://${urlValue}`;
      const host = new URL(withProto).hostname;
      if (!host) return null;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
    } catch {
      return null;
    }
  }, [qrType, urlValue]);

  const derivedLogoDevLookup = useMemo(
    () => deriveLogoDevLookup(qrType, { urlValue, appValue, emailAddress }),
    [appValue, emailAddress, qrType, urlValue],
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

  return (
    <div className="min-h-screen w-full bg-background xl:flex xl:h-screen xl:overflow-hidden">
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
      <div className="flex min-h-screen flex-col xl:h-screen xl:min-h-0 xl:flex-1">
        {/* Mobile QR Type Selector - Dropdown */}
        <div className="w-full max-w-full overflow-hidden border-b border-border bg-background p-4 xl:hidden">
          <h2 className="font-heading text-[20px] font-bold tracking-tight text-[#171717] leading-[120%] mb-3">Select QR type</h2>
          <Select value={qrType} onValueChange={(value) => setQrType(value as QRType)}>
            <SelectTrigger className="w-full h-14 rounded-xl bg-background border-border focus:ring-0 focus:ring-offset-0 focus:outline-none focus:border-[#D4D4D4]">
              <SelectValue>
                {(() => {
                  const selected = qrTypeOptions.find(opt => opt.id === qrType);
                  return selected ? (
                    <div className="flex items-center gap-3">
                      <img 
                        src={selected.image} 
                        alt={selected.label} 
                        className="w-10 h-7 rounded object-cover"
                      />
                      <span className="font-medium">{selected.label}</span>
                    </div>
                  ) : 'Select type';
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {qrTypeOptions.map((type) => (
                <SelectItem key={type.id} value={type.id} className="h-14 py-2">
                  <div className="flex items-center gap-3">
                    <img 
                      src={type.image} 
                      alt={type.label} 
                      className="w-10 h-7 rounded object-cover"
                    />
                    <span className="font-medium">{type.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-col md:flex-row md:items-start xl:min-h-0">
          {/* Center - QR Preview */}
          <main className="flex w-full min-w-0 flex-col items-center px-4 pb-4 pt-3 sm:px-6 md:w-[360px] md:flex-shrink-0 md:px-6 md:pb-6 md:pt-6 lg:w-[420px] xl:flex-1 xl:overflow-y-auto xl:overflow-x-hidden xl:px-8 xl:pt-4">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card p-4 sm:p-5 lg:max-w-[420px]" style={{ boxShadow: '0 14px 8px 0 rgba(64, 64, 64, 0.04), 0 6px 6px 0 rgba(64, 64, 64, 0.07), 0 2px 3px 0 rgba(64, 64, 64, 0.08)' }}>
              <h2 className="font-heading text-[20px] font-bold tracking-tight text-[#171717] leading-[120%] mb-3">Live preview</h2>
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
              />
            </div>
          </main>

          {/* Right - Style Panel */}
          <aside className="w-full max-w-full min-w-0 overflow-x-hidden px-4 pb-8 pt-6 sm:px-6 md:flex-1 md:border-l md:border-border/60 md:px-6 md:pt-6 xl:h-full xl:w-[440px] xl:flex-shrink-0 xl:overflow-y-auto xl:bg-background xl:px-8 xl:pt-8">
            <QRStyleTabs
              qrType={qrType}
              value={currentValue}
              onValueChange={setCurrentValue}
              wifiSSID={wifiSSID}
              onWifiSSIDChange={setWifiSSID}
              wifiPassword={wifiPassword}
              onWifiPasswordChange={setWifiPassword}
              wifiEncryption={wifiEncryption}
              onWifiEncryptionChange={setWifiEncryption}
              emailAddress={emailAddress}
              onEmailAddressChange={setEmailAddress}
              emailSubject={emailSubject}
              onEmailSubjectChange={setEmailSubject}
              emailBody={emailBody}
              onEmailBodyChange={setEmailBody}
              smsPhone={smsPhone}
              onSmsPhoneChange={setSmsPhone}
              smsMessage={smsMessage}
              onSmsMessageChange={setSmsMessage}
              videoValue={videoValue}
              onVideoValueChange={setVideoValue}
              frameStyle={frameStyle}
              onFrameStyleChange={setFrameStyle}
              fgColor={fgColor}
              onFgColorChange={setFgColor}
              bgColor={bgColor}
              onBgColorChange={setBgColor}
              patternColor={patternColor}
              onPatternColorChange={setPatternColor}
              bgGradient={bgGradient}
              onBgGradientChange={setBgGradient}
              logo={logo}
              onLogoChange={setLogo}
              logoSource={logoSource}
              onLogoSourceChange={setLogoSource}
              logoDevMode={logoDevMode}
              onLogoDevModeChange={setLogoDevMode}
              logoDevQuery={logoDevQuery}
              onLogoDevQueryChange={setLogoDevQuery}
              derivedLogoDevMode={derivedLogoDevLookup?.mode ?? null}
              derivedLogoDevQuery={derivedLogoDevLookup?.query ?? ''}
              logoStyle={logoStyle}
              onLogoStyleChange={setLogoStyle}
              bodyShape={bodyShape}
              onBodyShapeChange={setBodyShape}
              scanText={scanText}
              onScanTextChange={setScanText}
              scanLabelStyle={scanLabelStyle}
              onScanLabelStyleChange={setScanLabelStyle}
              autoFaviconUrl={autoFaviconUrl}
              logoDevUrl={logoDevUrl}
              isLogoDevConfigured={Boolean(logoDevPublishableKey)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Index;
