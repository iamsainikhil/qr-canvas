import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { QRType } from './QRTypeSelector';
import { FileUploadInput } from './FileUploadInput';

interface QRInputFieldsProps {
  qrType: QRType;
  value: string;
  onValueChange: (value: string) => void;
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
}

const inputClassName = "h-12 rounded-xl bg-background border-border input-field";
const textareaClassName = "w-full p-3 rounded-xl bg-background border border-border resize-none focus:outline-none focus:ring-2 focus:ring-ring input-field";
const labelClassName = "input-label";
const helperText = "Your QR code will generate automatically";

// URL validation helper - checks for valid URL with proper domain
const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    // Must be http or https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    // Hostname must have at least one dot (e.g., example.com) or be localhost
    const hostname = url.hostname;
    if (hostname === 'localhost') return true;
    if (!hostname.includes('.')) return false;
    // Check for valid TLD (at least 2 chars after the last dot)
    const parts = hostname.split('.');
    const tld = parts[parts.length - 1];
    if (tld.length < 2) return false;
    return true;
  } catch {
    return false;
  }
};

// Auto-fix URL by adding https:// if missing
const normalizeUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return '';
  
  // Already has protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  
  // Add https:// prefix
  return `https://${trimmed}`;
};

// URL Input component with real-time validation
function UrlInput({ 
  value, 
  onChange, 
  placeholder,
  label 
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  // Sync with external value changes
  useEffect(() => {
    // Only sync if the normalized versions differ
    const normalizedInput = normalizeUrl(inputValue);
    if (value !== normalizedInput && value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Clear error while typing
    setError(null);
    
    // If empty, clear the QR value
    if (!newValue.trim()) {
      onChange('');
      return;
    }

    // Try to normalize and validate in real-time
    const normalized = normalizeUrl(newValue);
    
    if (isValidUrl(normalized)) {
      // Valid URL - update parent with normalized value
      onChange(normalized);
      setError(null);
    } else {
      // Not valid yet - clear QR value but don't show error while typing
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!inputValue.trim()) {
      setError(null);
      return;
    }

    const normalized = normalizeUrl(inputValue);
    
    if (isValidUrl(normalized)) {
      // Update input to show normalized URL
      setInputValue(normalized);
      setError(null);
    } else {
      setError('Please enter a valid URL (e.g., google.com)');
    }
  };

  // Check if current input would be valid when normalized
  const isCurrentlyValid = inputValue.trim() && isValidUrl(normalizeUrl(inputValue));

  return (
    <div className="space-y-2">
      <label className={labelClassName}>{label}</label>
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          inputClassName,
          error && "border-destructive focus:ring-destructive"
        )}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

export function QRInputFields({
  qrType,
  value,
  onValueChange,
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
}: QRInputFieldsProps) {
  switch (qrType) {
    case 'url':
      return (
        <UrlInput
          value={value}
          onChange={onValueChange}
          placeholder="https://example.com"
          label="Website URL"
        />
      );
    case 'text':
      return (
        <div className="space-y-2">
          <label className={labelClassName}>Text Content</label>
          <textarea
            placeholder="Enter any text content..."
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className={cn(textareaClassName, "h-24")}
          />
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
      );
    case 'wifi':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className={labelClassName}>Network Name</label>
            <Input
              type="text"
              placeholder="My WiFi Network"
              value={wifiSSID}
              onChange={(e) => onWifiSSIDChange(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClassName}>Encryption</label>
            <div className="flex gap-2">
              {(['WPA', 'WEP', 'nopass'] as const).map((enc) => (
                <button
                  key={enc}
                  onClick={() => {
                    onWifiEncryptionChange(enc);
                    // Clear password when switching to no encryption
                    if (enc === 'nopass') {
                      onWifiPasswordChange('');
                    }
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    wifiEncryption === enc
                      ? "gradient-border-selected bg-[#EEF2FF] text-foreground"
                      : "border border-transparent hover:bg-[#F5F5F5]/50 text-foreground"
                  )}
                >
                  {enc === 'nopass' ? 'None' : enc}
                </button>
              ))}
            </div>
          </div>
          {wifiEncryption !== 'nopass' && (
            <div className="space-y-2">
              <label className={labelClassName}>Password</label>
              <Input
                type="password"
                placeholder="Enter password"
                value={wifiPassword}
                onChange={(e) => onWifiPasswordChange(e.target.value)}
                className={inputClassName}
              />
            </div>
          )}
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
      );
    case 'email':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className={labelClassName}>Email Address</label>
            <Input
              type="email"
              placeholder="email@example.com"
              value={emailAddress}
              onChange={(e) => onEmailAddressChange(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClassName}>Subject <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              type="text"
              placeholder="Email subject"
              value={emailSubject}
              onChange={(e) => onEmailSubjectChange(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClassName}>Message <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              placeholder="Email body..."
              value={emailBody}
              onChange={(e) => onEmailBodyChange(e.target.value)}
              className={cn(textareaClassName, "h-20")}
            />
          </div>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
      );
    case 'sms':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className={labelClassName}>Phone Number</label>
            <Input
              type="tel"
              placeholder="+1234567890"
              value={smsPhone}
              onChange={(e) => onSmsPhoneChange(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClassName}>Message <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              placeholder="Your message..."
              value={smsMessage}
              onChange={(e) => onSmsMessageChange(e.target.value)}
              className={cn(textareaClassName, "h-20")}
            />
          </div>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
      );
    case 'image':
      return (
        <div className="space-y-2">
          <FileUploadInput
            type="image"
            value={value}
            onValueChange={onValueChange}
          />
        </div>
      );
    case 'pdf':
      return (
        <div className="space-y-2">
          <FileUploadInput
            type="pdf"
            value={value}
            onValueChange={onValueChange}
          />
        </div>
      );
    case 'mp3':
      return (
        <div className="space-y-2">
          <FileUploadInput
            type="mp3"
            value={value}
            onValueChange={onValueChange}
          />
        </div>
      );
    case 'app':
      return (
        <UrlInput
          value={value}
          onChange={onValueChange}
          placeholder="https://apps.apple.com/... or https://play.google.com/..."
          label="App Store Link"
        />
      );
    default:
      return (
        <div className="space-y-2">
          <label className={labelClassName}>Content</label>
          <Input
            type="text"
            placeholder="Enter content..."
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className={inputClassName}
          />
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
      );
  }
}
