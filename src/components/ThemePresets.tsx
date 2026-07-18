import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import themePaperImg from '@/assets/theme-paper.webp';
import themeMidnightImg from '@/assets/theme-midnight.webp';
import themePastelImg from '@/assets/theme-pastel.webp';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  fgColor: string;
  bgColor: string;
  patternColor?: string;
  bgGradient?: string;
  image: string;
  isCustom?: boolean;
}

export const defaultThemePresets: ThemePreset[] = [
  {
    id: 'paper',
    name: 'Paper',
    description: 'Soft, minimal',
    fgColor: '#3d3225',
    bgColor: '#faf6f0',
    bgGradient: `
      radial-gradient(ellipse at 0% 0%, #f5ede3 0%, transparent 50%),
      radial-gradient(ellipse at 100% 0%, #ebe4d8 0%, transparent 50%),
      radial-gradient(ellipse at 100% 100%, #f0e6d6 0%, transparent 50%),
      radial-gradient(ellipse at 0% 100%, #faf6f0 0%, transparent 50%),
      linear-gradient(135deg, #faf6f0 0%, #f5ede3 100%)
    `.replace(/\s+/g, ' ').trim(),
    image: themePaperImg,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark, high contrast',
    fgColor: '#ffffff',
    bgColor: '#1e293b',
    bgGradient: `
      radial-gradient(ellipse at 0% 0%, #334155 0%, transparent 50%),
      radial-gradient(ellipse at 100% 50%, #1e3a5f 0%, transparent 50%),
      radial-gradient(ellipse at 50% 100%, #312e81 0%, transparent 50%),
      radial-gradient(ellipse at 0% 80%, #1e293b 0%, transparent 40%),
      linear-gradient(160deg, #0f172a 0%, #020617 100%)
    `.replace(/\s+/g, ' ').trim(),
    image: themeMidnightImg,
  },
  {
    id: 'pastel',
    name: 'Pastel',
    description: 'Soft, dreamy',
    fgColor: '#9f6b6b',
    bgColor: '#fdf6f3',
    bgGradient: `
      radial-gradient(ellipse at 0% 0%, #fce7f3 0%, transparent 50%),
      radial-gradient(ellipse at 100% 0%, #e9d5ff 0%, transparent 50%),
      radial-gradient(ellipse at 100% 100%, #fbcfe8 0%, transparent 50%),
      radial-gradient(ellipse at 0% 100%, #fdf6f3 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, #f5d0fe 0%, transparent 60%),
      linear-gradient(135deg, #fdf6f3 0%, #fce7f3 100%)
    `.replace(/\s+/g, ' ').trim(),
    image: themePastelImg,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm gradient',
    fgColor: '#ffffff',
    bgColor: '#ff6b35',
    bgGradient: `
      linear-gradient(135deg, #ff6b35 0%, #f7931e 25%, #fdb833 50%, #f15a24 75%, #c13e1d 100%)
    `.replace(/\s+/g, ' ').trim(),
    image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Cdefs%3E%3ClinearGradient id=%22g1%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%23ff6b35%22/%3E%3Cstop offset=%2250%25%22 style=%22stop-color:%23fdb833%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%23c13e1d%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%2240%22 height=%2240%22 fill=%22url(%23g1)%22/%3E%3C/svg%3E',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool gradient',
    fgColor: '#ffffff',
    bgColor: '#1a4d7a',
    bgGradient: `
      linear-gradient(135deg, #0a2f51 0%, #1a4d7a 25%, #2980b9 50%, #3498db 75%, #5dade2 100%)
    `.replace(/\s+/g, ' ').trim(),
    image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Cdefs%3E%3ClinearGradient id=%22g2%22 x1=%220%25%22 y1=%220%25%22 x2=%22100%25%22 y2=%22100%25%22%3E%3Cstop offset=%220%25%22 style=%22stop-color:%230a2f51%22/%3E%3Cstop offset=%2250%25%22 style=%22stop-color:%232980b9%22/%3E%3Cstop offset=%22100%25%22 style=%22stop-color:%235dade2%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%2240%22 height=%2240%22 fill=%22url(%23g2)%22/%3E%3C/svg%3E',
  },
];

interface ThemePresetsProps {
  selectedTheme: string;
  onThemeChange: (theme: ThemePreset) => void;
  onThemeUnselect: () => void;
  currentFgColor: string;
  currentBgColor: string;
  currentPatternColor: string | null;
  currentBgGradient: string | null;
}

export function ThemePresets({ selectedTheme, onThemeChange, onThemeUnselect, currentFgColor, currentBgColor, currentPatternColor, currentBgGradient }: ThemePresetsProps) {
  const [customThemes, setCustomThemes] = useState<ThemePreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [themeName, setThemeName] = useState('');
  const [editBgColor, setEditBgColor] = useState('#FFFFFF');
  const [editFgColor, setEditFgColor] = useState('#1A1A1A');
  const [editPatternColor, setEditPatternColor] = useState('#1A1A1A');
  const [editBgColorInput, setEditBgColorInput] = useState('#FFFFFF');
  const [editFgColorInput, setEditFgColorInput] = useState('#1A1A1A');
  const [editPatternColorInput, setEditPatternColorInput] = useState('#1A1A1A');
  const [editBgGradient, setEditBgGradient] = useState<string | null>(null);
  const [editBgGradientInput, setEditBgGradientInput] = useState('');
  const [useGradient, setUseGradient] = useState(false);

  const openNewThemeDialog = () => {
    setEditBgColor(currentBgColor);
    setEditFgColor(currentFgColor);
    setEditPatternColor(currentPatternColor || currentFgColor);
    setEditBgColorInput(currentBgColor);
    setEditFgColorInput(currentFgColor);
    setEditPatternColorInput(currentPatternColor || currentFgColor);
    setEditBgGradient(currentBgGradient);
    setEditBgGradientInput(currentBgGradient || '');
    setUseGradient(!!currentBgGradient);
    setThemeName('');
    setShowSaveDialog(true);
  };

  const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  const handleHexInput = (
    value: string,
    setColor: (c: string) => void,
    setInput: (c: string) => void,
  ) => {
    const normalized = value.startsWith('#') ? value : `#${value}`;
    setInput(normalized);
    if (isValidHex(normalized)) setColor(normalized);
  };

  const allThemes = [...defaultThemePresets, ...customThemes];

  const handleSaveTheme = () => {
    if (!themeName.trim()) return;
    
    const bgGradientToSave = useGradient && editBgGradientInput.trim() ? editBgGradientInput.trim() : undefined;
    
    // Build preview thumbnail
    let previewImage = '';
    if (bgGradientToSave) {
      // For gradients, use a simple approach: generate SVG with background style
      const encodedGradient = bgGradientToSave.replace(/"/g, "'");
      previewImage = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 style=%22background:${encodeURIComponent(encodedGradient)}%22%3E%3C/svg%3E`;
    } else {
      previewImage = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22${encodeURIComponent(editBgColor)}%22 /%3E%3Crect x=%228%22 y=%228%22 width=%228%22 height=%228%22 fill=%22${encodeURIComponent(editPatternColor)}%22 /%3E%3Crect x=%2224%22 y=%228%22 width=%228%22 height=%228%22 fill=%22${encodeURIComponent(editPatternColor)}%22 /%3E%3Crect x=%228%22 y=%2224%22 width=%228%22 height=%228%22 fill=%22${encodeURIComponent(editPatternColor)}%22 /%3E%3Crect x=%2218%22 y=%2218%22 width=%224%22 height=%224%22 fill=%22${encodeURIComponent(editFgColor)}%22 /%3E%3C/svg%3E`;
    }
    
    const newTheme: ThemePreset = {
      id: `custom-${Date.now()}`,
      name: themeName,
      description: 'Custom theme',
      fgColor: editFgColor,
      bgColor: editBgColor,
      patternColor: editPatternColor !== editFgColor ? editPatternColor : undefined,
      bgGradient: bgGradientToSave,
      image: previewImage,
      isCustom: true,
    };
    
    const updated = [...customThemes, newTheme];
    setCustomThemes(updated);
    setThemeName('');
    setShowSaveDialog(false);
    onThemeChange(newTheme);
  };

  const handleDeleteCustomTheme = (id: string) => {
    const updated = customThemes.filter(t => t.id !== id);
    setCustomThemes(updated);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {allThemes.map((theme) => (
          <div key={theme.id} className="relative">
            <button
              onClick={() => selectedTheme === theme.id ? onThemeUnselect() : onThemeChange(theme)}
              className={cn(
                "w-full flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200 border",
                selectedTheme === theme.id
                  ? "gradient-border-selected"
                  : "border-[#E5E5E5] bg-white hover:bg-[#F5F5F5]/50"
              )}
            >
              <img 
                src={theme.image} 
                alt={theme.name}
                className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
              />
              <p className="text-xs font-medium text-foreground truncate w-full text-center">
                {theme.name}
              </p>
            </button>
            {theme.isCustom && (
              <button
                onClick={() => handleDeleteCustomTheme(theme.id)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                title="Delete custom theme"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        
        <button
          onClick={openNewThemeDialog}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200 border border-[#E5E5E5] bg-white hover:bg-[#F5F5F5]/50"
          title="Create a new custom theme"
        >
          <Plus size={20} className="text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">New Theme</p>
        </button>
      </div>

      {showSaveDialog && (
        <div className="border border-[#E5E5E5] rounded-xl p-3 bg-white space-y-3">
          <p className="text-xs font-semibold text-foreground">New Theme</p>

          {/* Color editors */}
          <div className="space-y-2">
            {([
              { label: 'Background', color: editBgColor, input: editBgColorInput, setColor: setEditBgColor, setInput: setEditBgColorInput },
              { label: 'Foreground', color: editFgColor, input: editFgColorInput, setColor: setEditFgColor, setInput: setEditFgColorInput },
              { label: 'Pattern', color: editPatternColor, input: editPatternColorInput, setColor: setEditPatternColor, setInput: setEditPatternColorInput },
            ] as const).map(({ label, color, input, setColor, setInput }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
                <label className="relative flex-shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setInput(e.target.value);
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                  <div
                    className="w-7 h-7 rounded-lg border border-border shadow-sm flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                </label>
                <Input
                  value={input}
                  onChange={(e) => handleHexInput(e.target.value, setColor, setInput)}
                  placeholder="#000000"
                  className="text-xs h-7 font-mono flex-1"
                  maxLength={7}
                />
              </div>
            ))}
          </div>

          {/* Gradient toggle and editor */}
          <div className="space-y-2 border-t border-border pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useGradient}
                onChange={(e) => setUseGradient(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
                id="use-gradient"
              />
              <label htmlFor="use-gradient" className="text-xs font-medium text-foreground cursor-pointer">
                Use gradient background
              </label>
            </div>
            {useGradient && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Gradient CSS</span>
                <textarea
                  value={editBgGradientInput}
                  onChange={(e) => setEditBgGradientInput(e.target.value)}
                  placeholder="e.g., linear-gradient(135deg, #ff6b35 0%, #fdb833 100%)"
                  className="w-full p-2 text-xs rounded-lg border border-border bg-background font-mono resize-none h-16 focus:outline-none focus:ring-2 focus:ring-ring input-field"
                />
              </div>
            )}
          </div>

          {/* Name + actions */}
          <div className="space-y-2">
            <Input
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="Theme name…"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTheme();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveTheme}
                disabled={!themeName.trim()}
                size="sm"
                className="flex-1"
              >
                Save Theme
              </Button>
              <Button
                onClick={() => setShowSaveDialog(false)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}