import { cn } from '@/lib/utils';
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
import type { StaticImageData } from 'next/image';

export type QRType = 'url' | 'video' | 'wifi' | 'app' | 'text' | 'image' | 'email' | 'sms' | 'pdf' | 'mp3';

interface QRTypeOption {
  id: QRType;
  label: string;
  image: string | StaticImageData;
}

export const qrTypes: QRTypeOption[] = [
  { id: 'url', label: 'URL', image: urlIcon },
  { id: 'video', label: 'Video', image: videoIcon },
  { id: 'wifi', label: 'Wi-Fi', image: wifiIcon },
  { id: 'app', label: 'App', image: appIcon },
  { id: 'text', label: 'Text', image: textIcon },
  { id: 'image', label: 'Image', image: imageIcon },
  { id: 'email', label: 'E-mail', image: emailIcon },
  { id: 'sms', label: 'SMS', image: smsIcon },
  { id: 'pdf', label: 'PDF', image: pdfIcon },
  { id: 'mp3', label: 'MP3', image: mp3Icon },
];

interface QRTypeSelectorProps {
  selectedType: QRType;
  onTypeChange: (type: QRType) => void;
}

export function QRTypeSelector({ selectedType, onTypeChange }: QRTypeSelectorProps) {
  const getImageSrc = (image: string | StaticImageData) => (typeof image === 'string' ? image : image.src);

  return (
    <div>
      <h2 className="font-heading text-[20px] font-bold tracking-tight text-foreground leading-[120%] mb-4">Select QR type</h2>
      <div className="flex flex-col gap-1">
        {qrTypes.map((type, index) => (
          <button
            key={type.id}
            onClick={() => onTypeChange(type.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 rounded-xl transition-all duration-200 border",
              selectedType === type.id
                ? "gradient-border-selected"
                : "border-transparent hover:bg-muted"
            )}
            style={{ height: 80 }}
          >
            <img 
              src={getImageSrc(type.image)} 
              alt={type.label} 
              className="rounded-xl object-cover"
              width={90}
              height={64}
              loading={index < 3 ? "eager" : "lazy"}
              fetchPriority={index < 2 ? "high" : undefined}
              decoding={index < 3 ? "sync" : "async"}
            />
            <span className="font-heading font-bold tracking-tight text-foreground">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
