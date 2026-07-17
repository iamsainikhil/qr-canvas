import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Link, Type, Palette, Maximize2 } from 'lucide-react';

interface QRControlsProps {
  value: string;
  onValueChange: (value: string) => void;
  fgColor: string;
  onFgColorChange: (color: string) => void;
  bgColor: string;
  onBgColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
}

const presetColors = [
  { fg: '#1a1a1a', bg: '#ffffff', name: 'Classic' },
  { fg: '#2563eb', bg: '#eff6ff', name: 'Ocean' },
  { fg: '#059669', bg: '#ecfdf5', name: 'Forest' },
  { fg: '#dc2626', bg: '#fef2f2', name: 'Ruby' },
  { fg: '#7c3aed', bg: '#f5f3ff', name: 'Violet' },
  { fg: '#ea580c', bg: '#fff7ed', name: 'Sunset' },
];

export function QRControls({
  value,
  onValueChange,
  fgColor,
  onFgColorChange,
  bgColor,
  onBgColorChange,
  size,
  onSizeChange,
}: QRControlsProps) {
  return (
    <div className="space-y-8">
      {/* Content Input */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-base font-medium text-foreground">
          <div className="p-1.5 rounded-lg bg-secondary">
            <Link className="w-4 h-4 text-muted-foreground" />
          </div>
          Content
        </Label>
        <div className="relative">
          <Input
            type="text"
            placeholder="Enter URL, text, or any content..."
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="h-14 text-lg pl-4 pr-4 rounded-xl input-craft bg-secondary/50 border-border/50 placeholder:text-muted-foreground/60"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Type className="w-5 h-5 text-muted-foreground/40" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          URLs, text, email, phone numbers, and more
        </p>
      </div>

      {/* Color Presets */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-base font-medium text-foreground">
          <div className="p-1.5 rounded-lg bg-secondary">
            <Palette className="w-4 h-4 text-muted-foreground" />
          </div>
          Color Theme
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {presetColors.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                onFgColorChange(preset.fg);
                onBgColorChange(preset.bg);
              }}
              className={`group relative p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-paper ${
                fgColor === preset.fg && bgColor === preset.bg
                  ? 'border-accent shadow-paper'
                  : 'border-border/50 hover:border-border'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg shadow-sm"
                  style={{ backgroundColor: preset.bg, border: `2px solid ${preset.fg}` }}
                >
                  <div
                    className="w-2 h-2 rounded-sm m-1"
                    style={{ backgroundColor: preset.fg }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground/80">{preset.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-muted-foreground">Custom Colors</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Foreground</Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => onFgColorChange(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border/50 overflow-hidden"
                />
              </div>
              <Input
                type="text"
                value={fgColor}
                onChange={(e) => onFgColorChange(e.target.value)}
                className="h-12 font-mono text-sm uppercase rounded-xl input-craft bg-secondary/50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Background</Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => onBgColorChange(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border/50 overflow-hidden"
                />
              </div>
              <Input
                type="text"
                value={bgColor}
                onChange={(e) => onBgColorChange(e.target.value)}
                className="h-12 font-mono text-sm uppercase rounded-xl input-craft bg-secondary/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Size Slider */}
      <div className="space-y-4">
        <Label className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-medium text-foreground">
            <div className="p-1.5 rounded-lg bg-secondary">
              <Maximize2 className="w-4 h-4 text-muted-foreground" />
            </div>
            Size
          </span>
          <span className="text-sm font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-lg">
            {size}px
          </span>
        </Label>
        <Slider
          value={[size]}
          onValueChange={(values) => onSizeChange(values[0])}
          min={128}
          max={512}
          step={32}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Small</span>
          <span>Large</span>
        </div>
      </div>
    </div>
  );
}
