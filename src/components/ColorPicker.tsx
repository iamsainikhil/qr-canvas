import { useState, forwardRef, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  fgColor: string;
  bgColor: string;
  onFgColorChange: (color: string) => void;
  onBgColorChange: (color: string) => void;
  onBgGradientClear?: () => void;
}

// 10 curated swatches for QR Code
const fgSwatches = [
  '#1a1a1a', // Near black
  '#3d3225', // Brown
  '#1e293b', // Slate dark
  '#2563eb', // Blue
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#eab308', // Yellow
  '#ffffff', // White
];

// 10 curated swatches for Background - vibrant pastels
const bgSwatches = [
  '#ffffff', // White
  '#fef3c7', // Warm yellow
  '#d1fae5', // Mint green
  '#a5f3fc', // Cyan
  '#bfdbfe', // Sky blue
  '#ddd6fe', // Lavender
  '#fbcfe8', // Pink
  '#fed7aa', // Peach
  '#1e293b', // Slate dark
  '#000000', // Black
];

const isLightColor = (color: string) => {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

// Swatch size (36px) + gap (4px) - reduced for better fit
const SWATCH_SIZE = 36;
const GAP_SIZE = 4;
const PICKER_BUTTON_SIZE = 36;

// Color Swatch Button
const ColorSwatch = ({ 
  color, 
  isSelected, 
  onClick,
}: { 
  color: string; 
  isSelected: boolean; 
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 p-0.5 border",
      "w-9 h-9",
      isSelected
        ? "gradient-border-selected"
        : "border-transparent hover:bg-muted/50"
    )}
  >
    <div 
      className={cn(
        "w-full h-full rounded-full flex items-center justify-center",
        color === '#ffffff' && "border border-border"
      )}
      style={{ backgroundColor: color }}
    >
      {isSelected && (
        <Check className={cn(
          "w-3 h-3",
          isLightColor(color) ? "text-foreground" : "text-white"
        )} />
      )}
    </div>
  </button>
);

// Trigger button with forwardRef for Radix compatibility
const ColorPickerTriggerButton = forwardRef<
  HTMLButtonElement,
  { currentColor: string; onClick?: () => void }
>(({ currentColor, ...props }, ref) => (
  <button
    ref={ref}
    {...props}
    className="w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 border border-border overflow-hidden"
    style={{
      background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
    }}
  />
));

ColorPickerTriggerButton.displayName = 'ColorPickerTriggerButton';

// Standalone ColorPickerPopover component with tabs
interface ColorPickerPopoverProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  hexInput: string;
  onHexInputChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swatches: string[];
  isCustomSelected?: boolean;
}

function ColorPickerPopover({
  currentColor,
  onColorChange,
  hexInput,
  onHexInputChange,
  open,
  onOpenChange,
  swatches,
  isCustomSelected = false,
}: ColorPickerPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={true}>
      <PopoverTrigger asChild>
        {isCustomSelected ? (
          <button
            className="w-9 h-9 rounded-full gradient-border-selected flex items-center justify-center p-0.5 border flex-shrink-0"
          >
            <div 
              className={cn(
                "w-full h-full rounded-full flex items-center justify-center",
                currentColor === '#ffffff' && "border border-border"
              )}
              style={{ backgroundColor: currentColor }}
            >
              <Check className={cn(
                "w-3 h-3",
                isLightColor(currentColor) ? "text-foreground" : "text-white"
              )} />
            </div>
          </button>
        ) : (
          <ColorPickerTriggerButton currentColor={currentColor} />
        )}
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-4 bg-card rounded-2xl" 
        align="end"
      >
        <Tabs defaultValue="swatches" className="w-[220px] min-h-[240px]">
          <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted rounded-full">
            <TabsTrigger 
              value="swatches" 
              className="text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-accent data-[state=active]:shadow-sm text-muted-foreground"
            >
              Swatches
            </TabsTrigger>
            <TabsTrigger 
              value="custom" 
              className="text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-accent data-[state=active]:shadow-sm text-muted-foreground"
            >
              Custom
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="swatches" className="mt-4">
            <div className="grid grid-cols-5 gap-1">
              {swatches.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  isSelected={currentColor === color}
                  onClick={() => {
                    onColorChange(color);
                    onHexInputChange(color);
                  }}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="custom" className="mt-4">
            <div className="space-y-4">
              {/* Color Picker */}
              <div className="color-picker-wrapper" onPointerDown={(e) => e.stopPropagation()}>
                <HexColorPicker 
                  color={currentColor} 
                  onChange={(color) => {
                    onColorChange(color.toUpperCase());
                    onHexInputChange(color.toUpperCase());
                  }}
                />
              </div>
              
              {/* Hex Input */}
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl border border-border flex-shrink-0"
                  style={{ backgroundColor: currentColor }}
                />
                <Input
                  value={hexInput}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    onHexInputChange(value);
                    if (isValidHex(value)) {
                      onColorChange(value);
                    }
                  }}
                  placeholder="#000000"
                  className="font-mono uppercase h-10 rounded-xl"
                  maxLength={7}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export function ColorPicker({
  fgColor,
  bgColor,
  onFgColorChange,
  onBgColorChange,
  onBgGradientClear,
}: ColorPickerProps) {
  const [fgHexInput, setFgHexInput] = useState(fgColor);
  const [bgHexInput, setBgHexInput] = useState(bgColor);
  const [fgOpen, setFgOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [visibleSwatches, setVisibleSwatches] = useState(10);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate how many swatches can fit based on container width
  useEffect(() => {
    let rafId: number;
    
    const calculateVisibleSwatches = () => {
      // Use requestAnimationFrame to batch layout reads and avoid forced reflow
      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        // Reserve space for the picker button
        const availableWidth = containerWidth - PICKER_BUTTON_SIZE - GAP_SIZE;
        const maxSwatches = Math.floor(availableWidth / (SWATCH_SIZE + GAP_SIZE));
        // Clamp between 3 and 10 swatches
        setVisibleSwatches(Math.max(3, Math.min(10, maxSwatches)));
      });
    };

    calculateVisibleSwatches();

    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize calculations
      cancelAnimationFrame(rafId);
      calculateVisibleSwatches();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  const handleFgHexChange = (value: string) => {
    const formatted = value.startsWith('#') ? value : `#${value}`;
    setFgHexInput(formatted.toUpperCase());
    if (isValidHex(formatted)) {
      onFgColorChange(formatted.toUpperCase());
    }
  };

  const handleBgHexChange = (value: string) => {
    const formatted = value.startsWith('#') ? value : `#${value}`;
    setBgHexInput(formatted.toUpperCase());
    if (isValidHex(formatted)) {
      onBgColorChange(formatted.toUpperCase());
      onBgGradientClear?.();
    }
  };

  const handleBgSwatchClick = (color: string) => {
    onBgColorChange(color);
    setBgHexInput(color);
    onBgGradientClear?.();
  };

  // Get visible swatches based on calculated amount
  const visibleFgSwatches = fgSwatches.slice(0, visibleSwatches);
  const visibleBgSwatches = bgSwatches.slice(0, visibleSwatches);

  // Check if current color is a custom color (not in visible swatches)
  const isFgCustom = !visibleFgSwatches.includes(fgColor);
  const isBgCustom = !visibleBgSwatches.includes(bgColor);

  return (
    <div className="space-y-4 overflow-hidden w-full max-w-full" ref={containerRef}>
      {/* Foreground Color */}
      <div className="space-y-2 w-full">
        <p className="text-xs text-muted-foreground">QR Code</p>
        <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap sm:justify-between w-full">
          {visibleFgSwatches.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              isSelected={fgColor === color}
              onClick={() => {
                onFgColorChange(color);
                setFgHexInput(color);
              }}
            />
          ))}
          {/* Custom color indicator or picker button */}
          <ColorPickerPopover
            currentColor={fgColor}
            onColorChange={(color) => {
              onFgColorChange(color);
              setFgHexInput(color);
            }}
            hexInput={fgHexInput}
            onHexInputChange={handleFgHexChange}
            open={fgOpen}
            onOpenChange={setFgOpen}
            swatches={fgSwatches}
            isCustomSelected={isFgCustom}
          />
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-2 w-full">
        <p className="text-xs text-muted-foreground">Background</p>
        <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap sm:justify-between w-full">
          {visibleBgSwatches.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              isSelected={bgColor === color}
              onClick={() => handleBgSwatchClick(color)}
            />
          ))}
          {/* Custom color indicator or picker button */}
          <ColorPickerPopover
            currentColor={bgColor}
            onColorChange={(color) => {
              onBgColorChange(color);
              setBgHexInput(color);
              onBgGradientClear?.();
            }}
            hexInput={bgHexInput}
            onHexInputChange={handleBgHexChange}
            open={bgOpen}
            onOpenChange={setBgOpen}
            swatches={bgSwatches}
            isCustomSelected={isBgCustom}
          />
        </div>
      </div>

      <style>{`
        .color-picker-wrapper .react-colorful {
          width: 100%;
          height: 150px;
        }
        .color-picker-wrapper .react-colorful__saturation {
          border-radius: 12px;
          margin-bottom: 12px;
        }
        .color-picker-wrapper .react-colorful__hue {
          height: 14px;
          border-radius: 7px;
        }
        .color-picker-wrapper .react-colorful__saturation-pointer,
        .color-picker-wrapper .react-colorful__hue-pointer {
          width: 20px;
          height: 20px;
          border-width: 3px;
        }
      `}</style>
    </div>
  );
}
