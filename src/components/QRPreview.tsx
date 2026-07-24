import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@iconify/react';
import { useToast } from '@/hooks/use-toast';
import { cn, getContrastingTextColor } from '@/lib/utils';
import { useGoogleFont } from '@/hooks/use-google-font';
import { FrameStyle } from './QRStyleTabs';
import { BodyShape } from './BodyShapeSelector';
import { LogoStyleOptions, resolveLogoStyleOptions } from './logoStyle';
import { ScanLabelStyleOptions, defaultScanLabelStyle } from './scanLabelStyle';
import { SizeSelector } from './SizeSelector';
import { ensureGoogleFontLoaded } from '@/lib/fontRegistry';
import QRCodeStyling from 'qr-code-styling';

interface QRPreviewProps {
  qrValue: string;
  fgColor: string;
  bgColor: string;
  patternColor?: string;
  bgGradient?: string | null;
  frameStyle: FrameStyle;
  logo: string | null;
  logoStyle?: Partial<LogoStyleOptions>;
  bodyShape?: BodyShape;
  downloadSize?: number;
  onDownloadSizeChange?: (size: number) => void;
  scanText?: string;
  scanLabelStyle?: ScanLabelStyleOptions;
  onSave?: () => void;
  saveDisabled?: boolean;
  saveDisabledTitle?: string;
}

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

const frameStyleClasses: Record<FrameStyle, string> = {
  'square': 'rounded-none',
  'rounded-sm': 'rounded-lg',
  'rounded-md': 'rounded-2xl',
  'rounded-lg': 'rounded-3xl',
  'rounded-left': 'rounded-l-3xl rounded-r-none',
  'rounded-right': 'rounded-r-3xl rounded-l-none',
  'pill-h': 'rounded-full',
  'pill-v': 'rounded-full',
  'circle': 'rounded-full',
};

const bodyShapeMapping = {
  'square': { dotType: 'square' as const, cornerSquareType: 'square' as const, cornerDotType: 'square' as const },
  'dots': { dotType: 'dots' as const, cornerSquareType: 'dot' as const, cornerDotType: 'dot' as const },
  'rounded': { dotType: 'rounded' as const, cornerSquareType: 'extra-rounded' as const, cornerDotType: 'dot' as const },
  'classy': { dotType: 'classy' as const, cornerSquareType: 'extra-rounded' as const, cornerDotType: 'dot' as const },
  'sharp': { dotType: 'classy-rounded' as const, cornerSquareType: 'square' as const, cornerDotType: 'square' as const },
};

const createQrOptions = ({
  size,
  data,
  fgColor,
  patternColor,
  bodyShape,
  backgroundColor,
  logoPlaceholder,
}: {
  size: number;
  data: string;
  fgColor: string;
  patternColor?: string;
  bodyShape: BodyShape;
  backgroundColor: string;
  logoPlaceholder?: string;
}) => {
  const shape = bodyShapeMapping[bodyShape];
  return {
    width: size,
    height: size,
    data,
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
      color: fgColor,
      type: shape.dotType,
    },
    cornersSquareOptions: {
      color: patternColor || fgColor,
      type: shape.cornerSquareType,
    },
    cornersDotOptions: {
      color: patternColor || fgColor,
      type: shape.cornerDotType,
    },
    backgroundOptions: {
      color: backgroundColor,
    },
    qrOptions: {
      errorCorrectionLevel: 'H' as const,
    },
  };
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

export function QRPreview({
  qrValue,
  fgColor,
  bgColor,
  patternColor,
  bgGradient,
  frameStyle,
  logo,
  logoStyle,
  bodyShape = 'square',
  downloadSize = 300,
  onDownloadSizeChange,
  scanText = '',
  scanLabelStyle = defaultScanLabelStyle,
  onSave,
  saveDisabled = false,
  saveDisabledTitle,
}: QRPreviewProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<QRCodeStyling | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(220);
  const [resolvedScanFontFamily, setResolvedScanFontFamily] = useState(
    scanLabelStyle.fontFamily,
  );
  const isFontLoading = useGoogleFont(scanLabelStyle.fontFamily);
  const { toast } = useToast();
  const resolvedLogoStyle = resolveLogoStyleOptions(logoStyle);
  const hasLogo = Boolean(logo);
  const logoPlaceholder = hasLogo && resolvedLogoStyle.badgeSize > 0
    ? buildLogoPlaceholder(
        resolvedLogoStyle.badgeSize,
        resolvedLogoStyle.cornerRadius,
        resolvedLogoStyle.backgroundColor,
      )
    : undefined;

  const displayValue = qrValue || 'https://github.com/iamsainikhil/qr-canvas'; // Fallback value for QR code generation
  const hasContent = Boolean(qrValue && qrValue.trim().length > 0);

  useEffect(() => {
    if (!isFontLoading) {
      setResolvedScanFontFamily(scanLabelStyle.fontFamily);
    }
  }, [isFontLoading, scanLabelStyle.fontFamily]);

  // Update QR code when props change
  useEffect(() => {
    qrCodeRef.current = new QRCodeStyling(
      createQrOptions({
        size: qrSize,
        data: displayValue,
        fgColor,
        patternColor,
        bodyShape,
        backgroundColor: bgColor || '#FFFFFF',
        logoPlaceholder,
      }),
    );
    if (qrRef.current) {
      qrRef.current.innerHTML = '';
      qrCodeRef.current.append(qrRef.current);
    }
  }, [displayValue, fgColor, patternColor, bgColor, bodyShape, qrSize, logoPlaceholder, resolvedLogoStyle.badgeSize]);

  // Update size on container resize
  useEffect(() => {
    let rafId: number;
    
    const updateSize = () => {
      // Use requestAnimationFrame to batch layout reads and avoid forced reflow
      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          const containerWidth = containerRef.current.offsetWidth;
          const availableWidth = containerWidth - 64;
          const isDesktop = window.innerWidth >= 1024;
          const maxQrSize = isDesktop ? 280 : 520;
          setQrSize(Math.max(150, Math.min(availableWidth, maxQrSize)));
        }
      });
    };

    updateSize();
    
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      updateSize();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const renderStyledQrCanvas = useCallback(async (includeLabel: boolean) => {
    const exportQRCode = new QRCodeStyling(
      createQrOptions({
        size: downloadSize,
        data: displayValue,
        fgColor,
        patternColor,
        bodyShape,
        backgroundColor: bgColor || '#FFFFFF',
        logoPlaceholder,
      }),
    );

    try {
      const raw = await exportQRCode.getRawData('png');
      if (!(raw instanceof Blob)) throw new Error('Failed to render QR');
      const qrUrl = URL.createObjectURL(raw);
      const qrImg = new Image();
      qrImg.src = qrUrl;
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
      });

      const trimmedText = (scanText || '').trim();
      const padding = Math.round(downloadSize * 0.08);
      const previewFontScale = scanLabelStyle.fontSize / Math.max(qrSize, 1);
      const fontSize = Math.max(16, Math.round(downloadSize * previewFontScale));
      const textAreaHeight = Math.round(fontSize * 1.6);
      const extraHeight = includeLabel && trimmedText ? textAreaHeight + padding : 0;
      const canvas = document.createElement('canvas');
      canvas.width = downloadSize;
      canvas.height = downloadSize + extraHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = bgColor || '#FFFFFF';
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
          drawRoundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeRadius);
          if (resolvedLogoStyle.backgroundColor !== 'transparent') {
            ctx.fillStyle = resolvedLogoStyle.backgroundColor;
            ctx.fill();
          }
          const logoPad = Math.round(badgeSize * (resolvedLogoStyle.padding / 100));
          const lSize = badgeSize - logoPad * 2;
          ctx.drawImage(logoImg, cx - lSize / 2, cy - lSize / 2, lSize, lSize);
        } catch {
          // Cross-origin logo without CORS — skip it; download continues
          // without the center image.
        }
      }

      if (includeLabel && trimmedText) {
        await ensureGoogleFontLoaded(scanLabelStyle.fontFamily, [scanLabelStyle.fontWeight]);
        const labelText = scanLabelStyle.uppercase ? trimmedText.toUpperCase() : trimmedText;
        ctx.fillStyle = getContrastingTextColor(bgColor || '#FFFFFF');
        ctx.font = `${scanLabelStyle.fontWeight} ${fontSize}px "${scanLabelStyle.fontFamily}", Satoshi, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          labelText,
          canvas.width / 2,
          downloadSize + padding / 2 + textAreaHeight / 2,
        );
      }
      URL.revokeObjectURL(qrUrl);

      return canvas;
    } catch (err) {
      console.error('QR render failed:', err);
      throw err;
    }
  }, [downloadSize, displayValue, fgColor, patternColor, bodyShape, bgColor, logo, logoPlaceholder, resolvedLogoStyle, scanText, scanLabelStyle, qrSize]);

  const downloadQR = useCallback(async () => {
    try {
      const canvas = await renderStyledQrCanvas(true);
      const trimmedText = (scanText || '').trim();

      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'qrcode.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, 'image/png');

      toast({
        title: 'Downloaded!',
        description: `Your QR code has been saved as ${downloadSize}x${downloadSize}px PNG.${trimmedText ? ` with "${trimmedText}" label` : ''}`,
      });
    } catch (err) {
      console.error('Download failed:', err);
      toast({
        title: 'Download failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast, downloadSize, renderStyledQrCanvas, scanText]);

  const copyToClipboard = useCallback(async () => {
    if (hasContent) {
      try {
        const canvas = await renderStyledQrCanvas(false);
        const makeImagePromise = async (): Promise<Blob> =>
          await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
                return;
              }
              reject(new Error('Failed to generate image'));
            }, 'image/png');
          });

        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': makeImagePromise() })
        ]);
        
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: "Copied!",
          description: "QR code copied to clipboard.",
        });
      } catch {
        // Fallback: Try to copy the URL/text value instead
        try {
          await navigator.clipboard.writeText(displayValue);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast({
            title: "Copied!",
            description: "QR code link copied to clipboard.",
          });
        } catch {
          toast({
            title: "Copy not supported",
            description: "Your browser doesn't support copying images. Try downloading instead.",
            variant: "destructive",
          });
        }
      }
    }
  }, [toast, displayValue, hasContent, renderStyledQrCanvas]);

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 lg:gap-3 w-full">
      {/* QR Code Display */}
      <div 
        className={cn(
          "w-full p-6 lg:p-5 bg-card shadow-lg",
          frameStyleClasses[frameStyle]
        )}
        style={{ 
          backgroundColor: bgColor,
          background: bgGradient || bgColor,
        }}
      >
        <div className="flex flex-col items-center gap-3 lg:gap-2">
          <div className="relative inline-flex">
            <div ref={qrRef} className="animate-scale-in flex justify-center" />
          {logo && resolvedLogoStyle.badgeSize > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
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
                  <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              </div>
            </div>
          )}
          </div>
          {(scanText || '').trim() && (
            <p
              className="text-center leading-tight"
              style={{
                color: getContrastingTextColor(bgColor || '#FFFFFF'),
                fontSize: `${scanLabelStyle.fontSize}px`,
                fontWeight: scanLabelStyle.fontWeight,
                fontFamily: `"${resolvedScanFontFamily}", Satoshi, system-ui, -apple-system, sans-serif`,
                textTransform: scanLabelStyle.uppercase ? 'uppercase' : 'none',
              }}
            >
              {(scanText || '').trim()}
            </p>
          )}
        </div>
      </div>

      <div className="w-full rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Icon icon="lucide:download" className="h-4 w-4 text-muted-foreground" />
          <p className="font-heading text-sm font-bold tracking-tight text-foreground">Export</p>
        </div>
        <p className="text-xs text-muted-foreground">Choose output format</p>
        <SizeSelector
          value={downloadSize}
          onChange={(size) => onDownloadSizeChange?.(size)}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex w-full items-center gap-2 pt-1">
        <div className="relative flex-1">
          {/* Glow effect */}
          <div className={cn(
            "absolute inset-0 rounded-full blur-lg translate-y-1 transition-opacity",
            hasContent ? "opacity-40" : "opacity-0"
          )} style={{ background: 'linear-gradient(91deg, #8FA2F5 0%, #587FED 36.54%, #587FED 67.26%, #8FA2F5 100%)' }} />
          <Button
            onClick={downloadQR}
            disabled={!hasContent}
            className={cn(
              "relative h-12 w-full rounded-full border-0 text-base font-medium shadow-none transition-all inline-flex items-center justify-center gap-2",
              "lg:h-11",
              hasContent 
                ? "text-white hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            style={hasContent ? { background: 'linear-gradient(91deg, #8FA2F5 0%, #587FED 36.54%, #587FED 67.26%, #8FA2F5 100%)' } : undefined}
            title="Download"
          >
            <Icon icon="lucide:download" className="h-4 w-4" />
            <span className="hidden xl:inline">Download</span>
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={copyToClipboard}
          disabled={!hasContent}
          className={cn(
            "h-11 w-11 rounded-full px-0 inline-flex items-center justify-center gap-0 xl:w-auto xl:px-4 xl:gap-2",
            hasContent ? "" : "cursor-not-allowed opacity-50"
          )}
          title={copied ? 'Copied' : 'Copy'}
        >
          {copied ? <Icon icon="mdi-light:check" className="w-4 h-4" /> : <Icon icon="lucide:copy" className="w-4 h-4" />}
          <span className="hidden xl:inline">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
        <Button
          variant="outline"
          onClick={onSave}
          disabled={!hasContent || saveDisabled}
          className={cn(
            "h-11 w-11 rounded-full px-0 inline-flex items-center justify-center gap-0 xl:w-auto xl:px-4 xl:gap-2",
            hasContent && !saveDisabled ? "" : "cursor-not-allowed"
          )}
          title={saveDisabledTitle || 'Save'}
        >
          <Icon icon="lucide:bookmark-plus" className="h-4 w-4" />
          <span className="hidden xl:inline">Save</span>
        </Button>
      </div>
    </div>
  );
}
