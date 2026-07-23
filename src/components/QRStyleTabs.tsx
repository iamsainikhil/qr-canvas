import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { QRType } from './QRTypeSelector';
import { ThemePresets, ThemePreset } from './ThemePresets';
import { BodyShapeSelector, BodyShape } from './BodyShapeSelector';

import { ColorPicker, InlineColorPickerField, fgSwatches, bgSwatches } from './ColorPicker';
import { Slider } from '@/components/ui/slider';
import { LogoStyleOptions } from './logoStyle';
import { ScanLabelStyleOptions } from './scanLabelStyle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useGoogleFont } from '@/hooks/use-google-font';
import { defaultFontFamilies, getGoogleFontFamilies } from '@/lib/fontRegistry';
import type { LogoDevLookupMode, LogoSource } from '@/views/Index';
import { useToast } from '@/hooks/use-toast';

export type FrameStyle = 'square' | 'rounded-sm' | 'rounded-md' | 'rounded-lg' | 'rounded-left' | 'rounded-right' | 'pill-h' | 'pill-v' | 'circle';

interface QRStyleTabsProps {
  qrType: QRType;
  value: string;
  onValueChange: (value: string) => void;
  onUploadDestinationFile?: (type: Extract<QRType, 'image' | 'pdf' | 'mp3'>, file: File) => Promise<string>;
  isDestinationUploading?: boolean;
  wifiSSID: string;
  onWifiSSIDChange: (ssid: string) => void;
  wifiPassword: string;
  onWifiPasswordChange: (password: string) => void;
  wifiEncryption: 'WPA' | 'WEP' | 'nopass';
  onWifiEncryptionChange: (encryption: 'WPA' | 'WEP' | 'nopass') => void;
  emailAddress: string;
  onEmailAddressChange: (email: string) => void;
  emailSubject: string;
  onEmailSubjectChange: (subject: string) => void;
  emailBody: string;
  onEmailBodyChange: (body: string) => void;
  smsPhone: string;
  onSmsPhoneChange: (phone: string) => void;
  smsMessage: string;
  onSmsMessageChange: (message: string) => void;
  frameStyle: FrameStyle;
  onFrameStyleChange: (style: FrameStyle) => void;
  fgColor: string;
  onFgColorChange: (color: string) => void;
  bgColor: string;
  onBgColorChange: (color: string) => void;
  patternColor?: string | null;
  onPatternColorChange?: (color: string | null) => void;
  bgGradient?: string | null;
  onBgGradientChange?: (gradient: string | null) => void;
  logo: string | null;
  onLogoChange: (logo: string | null) => void;
  logoSource: LogoSource;
  onLogoSourceChange: (source: LogoSource) => void;
  logoDevMode: LogoDevLookupMode;
  onLogoDevModeChange: (mode: LogoDevLookupMode) => void;
  logoDevQuery: string;
  onLogoDevQueryChange: (value: string) => void;
  derivedLogoDevMode?: LogoDevLookupMode | null;
  derivedLogoDevQuery?: string;
  logoStyle: LogoStyleOptions;
  onLogoStyleChange: (style: LogoStyleOptions) => void;
  bodyShape?: BodyShape;
  onBodyShapeChange?: (shape: BodyShape) => void;
  scanText?: string;
  onScanTextChange?: (text: string) => void;
  scanLabelStyle: ScanLabelStyleOptions;
  onScanLabelStyleChange: (style: ScanLabelStyleOptions) => void;
  autoFaviconUrl?: string | null;
  logoDevUrl?: string | null;
  isLogoDevConfigured: boolean;
}

const logoSourceOptions: { id: LogoSource; label: string; enabled: boolean }[] = [
  { id: 'none', label: 'None', enabled: true },
  { id: 'upload', label: 'Upload', enabled: true },
  { id: 'favicon', label: 'Favicon', enabled: true },
  { id: 'logo-dev', label: 'Logo.dev', enabled: true },
];

const logoDevModeOptions: { id: LogoDevLookupMode; label: string; placeholder: string }[] = [
  { id: 'domain', label: 'Domain', placeholder: 'stripe.com or https://stripe.com' },
  { id: 'name', label: 'Brand name', placeholder: 'Stripe' },
  { id: 'ticker', label: 'Ticker', placeholder: 'AAPL' },
  { id: 'crypto', label: 'Crypto', placeholder: 'BTC' },
  { id: 'isin', label: 'ISIN', placeholder: 'US0378331005' },
];

export function QRStyleTabs({
  qrType,
  value,
  onValueChange,
  onUploadDestinationFile,
  isDestinationUploading,
  wifiSSID,
  onWifiSSIDChange,
  wifiPassword,
  onWifiPasswordChange,
  wifiEncryption,
  onWifiEncryptionChange,
  emailAddress,
  onEmailAddressChange,
  emailSubject,
  onEmailSubjectChange,
  emailBody,
  onEmailBodyChange,
  smsPhone,
  onSmsPhoneChange,
  smsMessage,
  onSmsMessageChange,
  fgColor,
  onFgColorChange,
  bgColor,
  onBgColorChange,
  patternColor,
  onPatternColorChange,
  bgGradient,
  onBgGradientChange,
  logo,
  onLogoChange,
  logoSource,
  onLogoSourceChange,
  logoDevMode,
  onLogoDevModeChange,
  logoDevQuery,
  onLogoDevQueryChange,
  derivedLogoDevMode,
  derivedLogoDevQuery,
  logoStyle,
  onLogoStyleChange,
  bodyShape,
  onBodyShapeChange,
  scanText,
  onScanTextChange,
  scanLabelStyle,
  onScanLabelStyleChange,
  autoFaviconUrl,
  logoDevUrl,
  isLogoDevConfigured,
}: QRStyleTabsProps) {
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = useState('');
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [availableFonts, setAvailableFonts] = useState<string[]>(defaultFontFamilies);
  const [isFontsLoading, setIsFontsLoading] = useState(false);
  const [isDestinationDragActive, setIsDestinationDragActive] = useState(false);
  const isSelectedFontLoading = useGoogleFont(scanLabelStyle.fontFamily);

  const updateLogoStyle = <K extends keyof LogoStyleOptions>(key: K, value: LogoStyleOptions[K]) => {
    onLogoStyleChange({
      ...logoStyle,
      [key]: value,
    });
  };

  const updateScanLabelStyle = <K extends keyof ScanLabelStyleOptions>(
    key: K,
    value: ScanLabelStyleOptions[K],
  ) => {
    onScanLabelStyleChange({
      ...scanLabelStyle,
      [key]: value,
    });
  };

  const handleFontPickerOpen = async (open: boolean) => {
    setFontPickerOpen(open);

    if (!open || availableFonts.length > defaultFontFamilies.length) {
      return;
    }

    setIsFontsLoading(true);
    const families = await getGoogleFontFamilies(700);
    setAvailableFonts(families);
    setIsFontsLoading(false);
  };

  const handleFontSelect = (family: string) => {
    updateScanLabelStyle('fontFamily', family);
  };

  const logoPresets: { id: string; label: string; style: Pick<LogoStyleOptions, 'badgeSize' | 'padding' | 'cornerRadius'> }[] = [
    {
      id: 'subtle',
      label: 'Subtle',
      style: { badgeSize: 24, padding: 18, cornerRadius: 22 },
    },
    {
      id: 'balanced',
      label: 'Balanced',
      style: { badgeSize: 28, padding: 14, cornerRadius: 18 },
    },
    {
      id: 'bold',
      label: 'Bold',
      style: { badgeSize: 34, padding: 10, cornerRadius: 10 },
    },
  ];

  const handleThemeChange = (theme: ThemePreset) => {
    setSelectedTheme(theme.id);
    onFgColorChange(theme.fgColor);
    onBgColorChange(theme.bgColor);
    onBgGradientChange?.(theme.bgGradient || null);
    onPatternColorChange?.(theme.patternColor || null);
    updateLogoStyle('backgroundColor', theme.bgColor);
  };

  const clearThemeSelection = () => {
    setSelectedTheme('');
    onFgColorChange('#1A1A1A');
    onBgColorChange('#FFFFFF');
    onBgGradientChange?.(null);
    onPatternColorChange?.(null);
    updateLogoStyle('backgroundColor', '#FFFFFF');
  };

  const detachThemeSelection = () => {
    setSelectedTheme('');
    onBgGradientChange?.(null);
  };

  const handleManualFgColorChange = (color: string) => {
    detachThemeSelection();
    onFgColorChange(color);
  };

  const handleManualBgColorChange = (color: string) => {
    detachThemeSelection();
    onBgColorChange(color);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onLogoSourceChange('upload');
        onLogoChange(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const destinationUploadConfig: Partial<Record<QRType, { accept: string; cta: string; maxSizeLabel: string }>> = {
    image: { accept: 'image/*', cta: 'Upload image', maxSizeLabel: 'Max 10 MB' },
    pdf: { accept: 'application/pdf', cta: 'Upload PDF', maxSizeLabel: 'Max 20 MB' },
    mp3: { accept: 'audio/mpeg,audio/mp3', cta: 'Upload MP3', maxSizeLabel: 'Max 25 MB' },
  };

  const uploadDestinationFileCandidate = async (file: File) => {
    if (!onUploadDestinationFile) return;
    if (qrType !== 'image' && qrType !== 'pdf' && qrType !== 'mp3') return;

    try {
      const uploadedUrl = await onUploadDestinationFile(qrType, file);
      onValueChange(uploadedUrl);
      toast({
        title: 'File uploaded',
        description: 'Firebase URL was added to the QR destination field.',
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Could not upload this file.';
      toast({
        title: 'Upload failed',
        description,
        variant: 'destructive',
      });
    }
  };

  const handleDestinationFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadDestinationFileCandidate(file);
    e.target.value = '';
  };

  const handleDestinationDragOver = (e: React.DragEvent<HTMLElement>) => {
    if (!onUploadDestinationFile || isDestinationUploading) return;
    e.preventDefault();
    setIsDestinationDragActive(true);
  };

  const handleDestinationDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDestinationDragActive(false);
  };

  const handleDestinationDrop = async (e: React.DragEvent<HTMLElement>) => {
    if (!onUploadDestinationFile || isDestinationUploading) return;
    e.preventDefault();
    setIsDestinationDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadDestinationFileCandidate(file);
  };

  const previewLogo =
    logoSource === 'upload'
      ? logo
      : logoSource === 'favicon'
        ? autoFaviconUrl
        : logoSource === 'logo-dev'
          ? logoDevUrl
          : null;

  const inputClassName = "h-12 rounded-xl bg-background border-border input-field";
  const textareaClassName = "w-full p-3 rounded-xl bg-background border border-border resize-none focus:outline-none focus:ring-2 focus:ring-ring input-field";

  // Config for URL-like input types (label, placeholder, hint)
  const urlInputConfigs: Partial<Record<QRType, { label: string; placeholder: string; hint: string }>> = {
    url:   { label: 'Enter your link here', placeholder: 'https://example.com', hint: 'Your QR code will generate automatically' },
    image: { label: 'Image URL', placeholder: 'https://example.com/image.png', hint: 'Paste a public image URL, or upload a file above to fill this field automatically.' },
    pdf:   { label: 'PDF URL', placeholder: 'https://example.com/file.pdf', hint: 'Paste a public PDF URL, or upload a file above to fill this field automatically.' },
    mp3:   { label: 'MP3 URL', placeholder: 'https://example.com/audio.mp3', hint: 'Paste a public MP3 URL, or upload a file above to fill this field automatically.' },
    app:   { label: 'App Store or Play Store URL', placeholder: 'https://apps.apple.com/... or https://play.google.com/...', hint: 'Link to your app on App Store or Google Play' },
    video: { label: 'YouTube Video URL', placeholder: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', hint: 'Paste your YouTube video link here' },
  };

  const renderInputFields = () => {
    const urlConfig = urlInputConfigs[qrType];
    if (urlConfig) {
      const uploadConfig = destinationUploadConfig[qrType];

      return (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">{urlConfig.label}</Label>
          <Input
            type="url"
            placeholder={urlConfig.placeholder}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className={inputClassName}
          />
          {uploadConfig && onUploadDestinationFile ? (
            <label
              onDragOver={handleDestinationDragOver}
              onDragLeave={handleDestinationDragLeave}
              onDrop={handleDestinationDrop}
              className={cn(
                'group block w-full rounded-2xl border border-dashed p-4 text-center transition-colors',
                isDestinationDragActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-secondary/35',
                isDestinationUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              )}
            >
              <input
                type="file"
                accept={uploadConfig.accept}
                onChange={handleDestinationFileUpload}
                disabled={Boolean(isDestinationUploading)}
                className="hidden"
              />
              <div className="flex min-h-28 flex-col items-center justify-center gap-3">
                <span className="inline-flex h-11 w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors group-hover:bg-secondary/50">
                  {isDestinationUploading ? (
                    <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon icon="lucide:upload" className="h-4 w-4" />
                  )}
                  {isDestinationUploading ? 'Uploading to Firebase...' : uploadConfig.cta}
                </span>
                <div className="text-xs text-muted-foreground">
                  Drag and drop a file here or click to upload
                </div>
                <div className="text-[11px] text-muted-foreground/80">{uploadConfig.maxSizeLabel}</div>
              </div>
            </label>
          ) : null}
          <p className="text-sm text-muted-foreground">{urlConfig.hint}</p>
        </div>
      );
    }

    switch (qrType) {
      case 'text':
        return (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Enter your text</Label>
            <textarea
              placeholder="Enter any text content..."
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              className={cn(textareaClassName, "h-24")}
            />
          </div>
        );
      case 'wifi':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Network Name (SSID)</Label>
              <Input
                type="text"
                placeholder="My WiFi Network"
                value={wifiSSID}
                onChange={(e) => onWifiSSIDChange(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Password</Label>
              <Input
                type="password"
                placeholder="WiFi password"
                value={wifiPassword}
                onChange={(e) => onWifiPasswordChange(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Encryption</Label>
              <div className="flex gap-2">
                {(['WPA', 'WEP', 'nopass'] as const).map((enc) => (
                  <button
                    key={enc}
                    onClick={() => onWifiEncryptionChange(enc)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      wifiEncryption === enc
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    )}
                  >
                    {enc === 'nopass' ? 'None' : enc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 'email':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={emailAddress}
                onChange={(e) => onEmailAddressChange(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Subject (optional)</Label>
              <Input
                type="text"
                placeholder="Email subject"
                value={emailSubject}
                onChange={(e) => onEmailSubjectChange(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Body (optional)</Label>
              <textarea
                placeholder="Email body..."
                value={emailBody}
                onChange={(e) => onEmailBodyChange(e.target.value)}
                className={cn(textareaClassName, "h-20")}
              />
            </div>
          </div>
        );
      case 'sms':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1234567890"
                value={smsPhone}
                onChange={(e) => onSmsPhoneChange(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Message (optional)</Label>
              <textarea
                placeholder="Your message..."
                value={smsMessage}
                onChange={(e) => onSmsMessageChange(e.target.value)}
                className={cn(textareaClassName, "h-20")}
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Enter content</Label>
            <Input
              type="text"
              placeholder="Enter content..."
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              className={inputClassName}
            />
            <p className="text-sm text-muted-foreground">Your QR code will generate automatically</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="font-heading text-[20px] font-bold tracking-tight text-foreground leading-[120%]">Content</h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          {renderInputFields()}
        </div>
      </div>

      {/* Style Section */}
      <div className="space-y-6">
        <h2 className="font-heading text-[20px] font-bold tracking-tight text-foreground leading-[120%]">Style your QR</h2>
        
        {/* Theme Presets */}
        <div className="space-y-3">
          <p className="font-heading text-sm font-bold tracking-tight text-foreground">Theme</p>
          <ThemePresets
            selectedTheme={selectedTheme}
            onThemeChange={handleThemeChange}
            onThemeUnselect={clearThemeSelection}
            currentFgColor={fgColor}
            currentBgColor={bgColor}
            currentPatternColor={patternColor || null}
            currentBgGradient={bgGradient || null}
          />
        </div>

        {/* Body Shape */}
        <div className="space-y-3">
          <p className="font-heading text-sm font-bold tracking-tight text-foreground">Pattern</p>
          <BodyShapeSelector
            selectedShape={bodyShape || 'square'}
            onShapeChange={(shape) => onBodyShapeChange?.(shape)}
          />
        </div>

        {/* Color Picker */}
        <div className="space-y-3">
          <p className="font-heading text-sm font-bold tracking-tight text-foreground">Colors</p>
          <ColorPicker
            fgColor={fgColor}
            bgColor={bgColor}
            onFgColorChange={handleManualFgColorChange}
            onBgColorChange={handleManualBgColorChange}
            onBgGradientClear={() => {
              detachThemeSelection();
            }}
          />
        </div>

        {/* Logo / Favicon */}
        <div className="space-y-4">
          <p className="font-heading text-sm font-bold tracking-tight text-foreground">Center logo</p>
          <div className="grid grid-cols-2 gap-2">
            {logoSourceOptions.map((option) => {
              const isDisabled =
                (option.id === 'favicon' && qrType !== 'url') ||
                (option.id === 'logo-dev' && !isLogoDevConfigured) ||
                !option.enabled;

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onLogoSourceChange(option.id)}
                  className={cn(
                    'h-10 rounded-xl border text-sm font-medium transition-colors',
                    logoSource === option.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-secondary/60',
                    isDisabled && 'cursor-not-allowed opacity-50 hover:bg-background',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden">
              {previewLogo ? (
                <img src={previewLogo} alt="Logo preview" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">None</span>
              )}
            </div>
            <div className="flex-1 flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <span className="flex items-center justify-center gap-2 h-10 rounded-xl border border-border bg-background hover:bg-secondary/50 cursor-pointer text-sm font-medium">
                  <Icon icon="lucide:upload" className="w-4 h-4" />
                  {logo ? 'Replace upload' : 'Upload logo'}
                </span>
              </label>
              {logo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onLogoChange(null);
                    if (logoSource === 'upload') {
                      onLogoSourceChange('none');
                    }
                  }}
                  className="h-10 w-10 rounded-xl"
                >
                  <Icon icon="lucide:x" className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {logoSource === 'logo-dev' && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Lookup type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {logoDevModeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onLogoDevModeChange(option.id)}
                      className={cn(
                        'h-10 rounded-xl border px-3 text-xs font-medium transition-colors',
                        logoDevMode === option.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:bg-secondary/60',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm text-muted-foreground">Brand lookup</Label>
                  {derivedLogoDevQuery && !logoDevQuery.trim() ? (
                    <span className="text-xs text-muted-foreground">Using QR content</span>
                  ) : null}
                </div>
                <Input
                  value={logoDevQuery}
                  onChange={(e) => onLogoDevQueryChange(e.target.value)}
                  placeholder={
                    derivedLogoDevQuery && derivedLogoDevMode === logoDevMode
                      ? `Auto: ${derivedLogoDevQuery}`
                      : logoDevModeOptions.find((option) => option.id === logoDevMode)?.placeholder
                  }
                  className={inputClassName}
                />
              </div>
              {derivedLogoDevQuery && !logoDevQuery.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Logo.dev is using the current QR content automatically. Enter a value here only if you want to override it.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Search by domain, company name, ticker, crypto symbol, or ISIN. The resulting logo can be used for any QR type.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {logoSource === 'favicon'
              ? qrType === 'url'
                ? "We'll use the destination site's favicon. Switch to Logo.dev if you want a cleaner brand mark."
                : 'Favicon is only available for URL QR codes.'
              : logoSource === 'logo-dev'
                ? 'Logo.dev returns a cleaner brand logo when we can resolve the company from your QR content or lookup override.'
                : 'Upload an image or choose another source to place a logo in the center of your QR code.'}
          </p>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="font-heading text-sm font-bold tracking-tight text-foreground">Logo rendering</p>
            <div className="grid grid-cols-3 gap-2">
              {logoPresets.map((preset) => {
                const isActive =
                  logoStyle.badgeSize === preset.style.badgeSize &&
                  logoStyle.padding === preset.style.padding &&
                  logoStyle.cornerRadius === preset.style.cornerRadius;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      updateLogoStyle('badgeSize', preset.style.badgeSize);
                      updateLogoStyle('padding', preset.style.padding);
                      updateLogoStyle('cornerRadius', preset.style.cornerRadius);
                    }}
                    className={cn(
                      'h-10 rounded-xl border text-xs font-medium transition-colors',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-secondary/60'
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label className="text-muted-foreground">Badge size</Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {logoStyle.badgeSize === 0 ? 'Hidden' : `${logoStyle.badgeSize}%`}
                </span>
              </div>
              <Slider
                value={[logoStyle.badgeSize]}
                onValueChange={([value]) => updateLogoStyle('badgeSize', value)}
                min={0}
                max={40}
                step={1}
              />
              {logoStyle.badgeSize === 0 && (
                <p className="text-xs text-muted-foreground italic">Badge is hidden from your QR code</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label className="text-muted-foreground">Inner padding</Label>
                <span className="font-mono text-xs text-muted-foreground">{logoStyle.padding}%</span>
              </div>
              <Slider
                value={[logoStyle.padding]}
                onValueChange={([value]) => updateLogoStyle('padding', value)}
                min={6}
                max={24}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label className="text-muted-foreground">Corner radius</Label>
                <span className="font-mono text-xs text-muted-foreground">{logoStyle.cornerRadius}%</span>
              </div>
              <Slider
                value={[logoStyle.cornerRadius]}
                onValueChange={([value]) => updateLogoStyle('cornerRadius', value)}
                min={0}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Badge background</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateLogoStyle('backgroundColor', logoStyle.backgroundColor === 'transparent' ? '#FFFFFF' : 'transparent')}
                  title="Toggle transparent background"
                  className={cn(
                    'h-10 w-10 flex-shrink-0 cursor-pointer rounded-xl border border-border p-1 transition-colors',
                    logoStyle.backgroundColor === 'transparent' ? 'ring-2 ring-primary' : ''
                  )}
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                    backgroundSize: '8px 8px',
                    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                    backgroundColor: '#fff',
                  }}
                />
                <InlineColorPickerField
                  color={logoStyle.backgroundColor === 'transparent' ? '#FFFFFF' : logoStyle.backgroundColor}
                  inputValue={logoStyle.backgroundColor === 'transparent' ? '' : logoStyle.backgroundColor}
                  inputPlaceholder={logoStyle.backgroundColor === 'transparent' ? 'transparent' : '#000000'}
                  onColorChange={(color) => updateLogoStyle('backgroundColor', color)}
                  onInputChange={(value) => updateLogoStyle('backgroundColor', value)}
                  swatches={bgSwatches}
                  showLabel={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scan Text */}
        <div className="space-y-3">
          <p className="font-heading text-sm font-bold tracking-tight text-foreground">Scan label</p>
          <Input
            type="text"
            placeholder="Scan me"
            value={scanText ?? ''}
            onChange={(e) => onScanTextChange?.(e.target.value)}
            className={inputClassName}
            maxLength={40}
          />

          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Font family</Label>
              <Popover open={fontPickerOpen} onOpenChange={handleFontPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-between rounded-xl border-border bg-background"
                  >
                    <span
                      className="truncate"
                      style={{
                        fontFamily: `"${scanLabelStyle.fontFamily}", Satoshi, system-ui, -apple-system, sans-serif`,
                      }}
                    >
                      {scanLabelStyle.fontFamily}
                    </span>
                    <Icon icon="lucide:chevrons-up-down" className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search 700+ fonts..." />
                    <CommandList className="max-h-64">
                      <CommandEmpty>No fonts found.</CommandEmpty>
                      <CommandGroup>
                        {availableFonts.map((family) => (
                          <CommandItem
                            key={family}
                            value={family}
                            onSelect={() => {
                              void handleFontSelect(family);
                            }}
                          >
                            <Icon icon="mdi-light:check"
                              className={cn(
                                'mr-2 h-4 w-4',
                                scanLabelStyle.fontFamily === family ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <span className="truncate">{family}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                {isFontsLoading ? (
                  <>
                    <Icon icon="bx:loader-circle" className="h-3 w-3 animate-spin" />
                    Loading full font catalog...
                  </>
                ) : (
                  'Popular fonts are instant. Full Google catalog is loaded only when needed.'
                )}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                {isSelectedFontLoading ? (
                  <>
                    <Icon icon="bx:loader-circle" className="h-3 w-3 animate-spin" />
                    Loading selected font...
                  </>
                ) : (
                  'Selected font ready'
                )}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label className="text-muted-foreground">Text size</Label>
                <span className="font-mono text-xs text-muted-foreground">{scanLabelStyle.fontSize}px</span>
              </div>
              <Slider
                value={[scanLabelStyle.fontSize]}
                onValueChange={([value]) => updateScanLabelStyle('fontSize', value)}
                min={12}
                max={36}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Text color</Label>
              <div className="flex items-center gap-3">
                <InlineColorPickerField
                  color={scanLabelStyle.color}
                  inputValue={scanLabelStyle.color}
                  onColorChange={(color) => updateScanLabelStyle('color', color)}
                  onInputChange={(value) => updateScanLabelStyle('color', value)}
                  swatches={[
                    '#171717',
                    '#FFFFFF',
                    '#3D3225',
                    '#1E293B',
                    '#2563EB',
                    '#10B981',
                    '#8B5CF6',
                    '#EC4899',
                    '#F97316',
                    '#EAB308',
                  ]}
                  showLabel={false}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Text weight</Label>
              <div className="grid grid-cols-4 gap-2">
                {([500, 600, 700, 800] as const).map((weight) => (
                  <button
                    key={weight}
                    type="button"
                    onClick={() => updateScanLabelStyle('fontWeight', weight)}
                    className={cn(
                      'h-10 rounded-xl border text-xs font-medium transition-colors',
                      scanLabelStyle.fontWeight === weight
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-secondary/60'
                    )}
                  >
                    {weight}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scanLabelStyle.uppercase}
                onChange={(e) => updateScanLabelStyle('uppercase', e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Uppercase label
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Shown live in preview and included in downloaded PNG.
          </p>
        </div>
      </div>
    </div>
  );
}
