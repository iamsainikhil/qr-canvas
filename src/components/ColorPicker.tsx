import { useState, forwardRef } from 'react';
import { cn, isValidHex, isLightColor, normalizeHex } from '@/lib/utils';
import { Icon } from '@iconify/react';
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

export const fgSwatches = [
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

export const bgSwatches = [
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
        <Icon icon="mdi-light:check" className={cn(
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
    className="w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 border border-border p-0.5"
  >
    <div
      className={cn(
        'w-full h-full rounded-full',
        currentColor === '#ffffff' && 'border border-border',
      )}
      style={{ backgroundColor: currentColor }}
    />
  </button>
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
  const defaultTab = isCustomSelected ? 'custom' : 'swatches';

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
              <Icon icon="mdi-light:check" className={cn(
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
        <Tabs defaultValue={defaultTab} className="w-[220px] min-h-[240px]">
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

interface InlineColorPickerFieldProps {
  label?: string;
  color: string;
  inputValue: string;
  onColorChange: (color: string) => void;
  onInputChange: (value: string) => void;
  swatches: string[];
  showLabel?: boolean;
  inputPlaceholder?: string;
}

export function InlineColorPickerField({
  label,
  color,
  inputValue,
  onColorChange,
  onInputChange,
  swatches,
  showLabel = true,
  inputPlaceholder,
}: InlineColorPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const visibleSwatches = swatches.slice(0, 10);
  const isCustomSelected = !visibleSwatches.includes(color);

  return (
    <div className="flex items-center gap-3">
      {showLabel && (
        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
      )}
      <ColorPickerPopover
        currentColor={color}
        onColorChange={onColorChange}
        hexInput={inputValue}
        onHexInputChange={onInputChange}
        open={open}
        onOpenChange={setOpen}
        swatches={swatches}
        isCustomSelected={isCustomSelected}
      />
      <Input
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value.toUpperCase())}
        placeholder={inputPlaceholder || '#000000'}
        className="text-xs h-10 font-mono uppercase flex-1 rounded-xl"
        maxLength={7}
      />
    </div>
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

  const handleFgHexChange = (value: string) => {
    const formatted = normalizeHex(value);
    setFgHexInput(formatted);
    if (isValidHex(formatted)) {
      onFgColorChange(formatted);
    }
  };

  const handleBgHexChange = (value: string) => {
    const formatted = normalizeHex(value);
    setBgHexInput(formatted);
    if (isValidHex(formatted)) {
      onBgGradientClear?.();
      onBgColorChange(formatted);
    }
  };

  const handleBgSwatchClick = (color: string) => {
    onBgGradientClear?.();
    onBgColorChange(color);
    setBgHexInput(color);
  };

  const isFgCustom = !fgSwatches.includes(fgColor);
  const isBgCustom = !bgSwatches.includes(bgColor);

  return (
    <div className="space-y-4 overflow-hidden w-full max-w-full">
      {/* Foreground Color */}
      <div className="space-y-2 w-full">
        <p className="text-xs text-muted-foreground">QR Code</p>
        <div className="flex items-center gap-1 flex-wrap w-full">
          {fgSwatches.map((color) => (
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
        <div className="flex items-center gap-1 flex-wrap w-full">
          {bgSwatches.map((color) => (
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
              onBgGradientClear?.();
              onBgColorChange(color);
              setBgHexInput(color);
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
