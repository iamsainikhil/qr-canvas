import { cn, isValidHex, normalizeHex, getImageSrc } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@iconify/react';
import { InlineColorPickerField, fgSwatches, bgSwatches } from '@/components/ColorPicker';
import themePaperImg from '@/assets/theme-paper.webp';
import themeMidnightImg from '@/assets/theme-midnight.webp';
import themePastelImg from '@/assets/theme-pastel.webp';
import type { StaticImageData } from 'next/image';
import { getCurrentOwnerUid } from '@/lib/authOwner';
import {
  loadCustomThemesForOwner,
  saveCustomThemeForOwner,
  deleteCustomThemeForOwner,
} from '@/lib/firestoreQrCodes';

const buildAutoGradientCss = (backgroundColor: string, foregroundColor: string) =>
  `linear-gradient(135deg, ${backgroundColor} 0%, ${foregroundColor} 100%)`;

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  fgColor: string;
  bgColor: string;
  patternColor?: string;
  bgGradient?: string;
  image: string | StaticImageData;
  isCustom?: boolean;
  createdAt?: string;
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
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [themeName, setThemeName] = useState('');
  const [editBgColor, setEditBgColor] = useState('#FFFFFF');
  const [editFgColor, setEditFgColor] = useState('#1A1A1A');
  const [editPatternColor, setEditPatternColor] = useState('#1A1A1A');
  const [editBgColorInput, setEditBgColorInput] = useState('#FFFFFF');
  const [editFgColorInput, setEditFgColorInput] = useState('#1A1A1A');
  const [editPatternColorInput, setEditPatternColorInput] = useState('#1A1A1A');
  const [editBgGradientInput, setEditBgGradientInput] = useState('');
  const [useGradient, setUseGradient] = useState(false);
  const [lastAutoGradientInput, setLastAutoGradientInput] = useState<string | null>(null);

  const ownerUid = getCurrentOwnerUid();

  useEffect(() => {
    if (!ownerUid) return;
    setIsLoadingThemes(true);
    loadCustomThemesForOwner(ownerUid)
      .then((themes) => setCustomThemes(themes))
      .catch(() => {/* silent — user may not be signed in yet */})
      .finally(() => setIsLoadingThemes(false));
  }, [ownerUid]);

  const openNewThemeDialog = () => {
    setEditBgColor(currentBgColor);
    setEditFgColor(currentFgColor);
    setEditPatternColor(currentPatternColor || currentFgColor);
    setEditBgColorInput(currentBgColor);
    setEditFgColorInput(currentFgColor);
    setEditPatternColorInput(currentPatternColor || currentFgColor);
    setEditBgGradientInput(currentBgGradient || '');
    setLastAutoGradientInput(null);
    setUseGradient(!!currentBgGradient);
    setThemeName('');
    setShowSaveDialog(true);
  };

  const syncGradientTextarea = (
    backgroundColor: string,
    foregroundColor: string,
    force = false,
  ) => {
    const nextGradient = buildAutoGradientCss(backgroundColor, foregroundColor);
    if (force || !editBgGradientInput.trim() || editBgGradientInput === lastAutoGradientInput) {
      setEditBgGradientInput(nextGradient);
      setLastAutoGradientInput(nextGradient);
    }
  };

  const handleHexInput = (
    value: string,
    setColor: (c: string) => void,
    setInput: (c: string) => void,
    onValidColor?: (color: string) => void,
  ) => {
    const formatted = normalizeHex(value);
    setInput(formatted);
    if (isValidHex(formatted)) {
      setColor(formatted);
      onValidColor?.(formatted);
    }
  };

  const allThemes = [...defaultThemePresets, ...customThemes];

  const handleSaveTheme = async () => {
    if (!themeName.trim()) return;

    const bgGradientToSave = useGradient && editBgGradientInput.trim() ? editBgGradientInput.trim() : undefined;

    let previewImage = '';
    if (bgGradientToSave) {
      const encodedGradient = bgGradientToSave.replace(/"/g, "'");
      previewImage = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 style=%22background:${encodeURIComponent(encodedGradient)}%22%3E%3C/svg%3E`;
    } else {
      previewImage = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22${encodeURIComponent(editBgColor)}%22 /%3E%3Crect x=%228%22 y=%228%22 width=%228%22 height=%228%22 fill=%22${encodeURIComponent(editPatternColor)}%22 /%3E%3Crect x=%2224%22 y=%228%22 width=%228%22 height=%228%22 fill=%22${encodeURIComponent(editPatternColor)}%22 /%3E%3Crect x=%228%22 y=%2224%22 width=%228%22 height=%228%22 fill=%22${encodeURIComponent(editPatternColor)}%22 /%3E%3Crect x=%2218%22 y=%2218%22 width=%224%22 height=%224%22 fill=%22${encodeURIComponent(editFgColor)}%22 /%3E%3C/svg%3E`;
    }

    const newTheme: ThemePreset = {
      id: `custom-${Date.now()}`,
      name: themeName.trim(),
      description: 'Custom theme',
      fgColor: editFgColor,
      bgColor: editBgColor,
      patternColor: editPatternColor !== editFgColor ? editPatternColor : undefined,
      bgGradient: bgGradientToSave,
      image: previewImage,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      if (ownerUid) {
        await saveCustomThemeForOwner(ownerUid, newTheme);
      }
      const updated = [...customThemes, newTheme];
      setCustomThemes(updated);
      setThemeName('');
      setShowSaveDialog(false);
      onThemeChange(newTheme);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomTheme = async (id: string) => {
    if (ownerUid) {
      await deleteCustomThemeForOwner(ownerUid, id).catch(() => {/* ignore */});
    }
    setCustomThemes((prev) => prev.filter((t) => t.id !== id));
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
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <img 
                src={getImageSrc(theme.image)} 
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
                <Icon icon="lucide:x" width={12} height={12} />
              </button>
            )}
          </div>
        ))}
        
        <button
          onClick={openNewThemeDialog}
          disabled={isLoadingThemes}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200 border border-border bg-card hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Create a new custom theme"
        >
          {isLoadingThemes ? (
            <Icon icon="lucide:loader-circle" width={20} height={20} className="text-muted-foreground animate-spin" />
          ) : (
            <Icon icon="lucide:plus" width={20} height={20} className="text-muted-foreground" />
          )}
          <p className="text-xs font-medium text-foreground">New Theme</p>
        </button>
      </div>

      {showSaveDialog && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:palette" width={14} height={14} className="text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">New Custom Theme</p>
            </div>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Cancel"
            >
              <Icon icon="lucide:x" width={14} height={14} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Theme name input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Theme name</label>
              <Input
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder="e.g. Forest, Neon, Brand…"
                className="h-9 text-sm bg-background border-border focus-visible:ring-1 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTheme();
                  if (e.key === 'Escape') setShowSaveDialog(false);
                }}
                autoFocus
              />
            </div>

            {/* Color editors */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Colors</p>
              <div className="rounded-xl border border-border bg-background/50 divide-y divide-border">
                <div className="px-3 py-2.5">
                  <InlineColorPickerField
                    label="Background"
                    color={editBgColor}
                    inputValue={editBgColorInput}
                    onColorChange={(color) => {
                      setEditBgColor(color);
                      setEditBgColorInput(color);
                      if (useGradient) syncGradientTextarea(color, editFgColor);
                    }}
                    onInputChange={(value) => handleHexInput(value, setEditBgColor, setEditBgColorInput, (nextColor) => {
                      if (useGradient) syncGradientTextarea(nextColor, editFgColor);
                    })}
                    swatches={bgSwatches}
                  />
                </div>
                <div className="px-3 py-2.5">
                  <InlineColorPickerField
                    label="Foreground"
                    color={editFgColor}
                    inputValue={editFgColorInput}
                    onColorChange={(color) => {
                      setEditFgColor(color);
                      setEditFgColorInput(color);
                      if (useGradient) syncGradientTextarea(editBgColor, color);
                    }}
                    onInputChange={(value) => handleHexInput(value, setEditFgColor, setEditFgColorInput, (nextColor) => {
                      if (useGradient) syncGradientTextarea(editBgColor, nextColor);
                    })}
                    swatches={fgSwatches}
                  />
                </div>
                <div className="px-3 py-2.5">
                  <InlineColorPickerField
                    label="Pattern"
                    color={editPatternColor}
                    inputValue={editPatternColorInput}
                    onColorChange={(color) => {
                      setEditPatternColor(color);
                      setEditPatternColorInput(color);
                    }}
                    onInputChange={(value) => handleHexInput(value, setEditPatternColor, setEditPatternColorInput)}
                    swatches={fgSwatches}
                  />
                </div>
              </div>
            </div>

            {/* Gradient section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={useGradient}
                  onCheckedChange={(checked) => {
                    const nextUseGradient = checked === true;
                    setUseGradient(nextUseGradient);
                    if (nextUseGradient) {
                      syncGradientTextarea(editBgColor, editFgColor, true);
                    }
                  }}
                  className="cursor-pointer"
                  id="use-gradient"
                />
                <label htmlFor="use-gradient" className="text-xs font-medium text-foreground cursor-pointer select-none">
                  Use gradient background
                </label>
              </div>
              {useGradient && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gradient CSS</label>
                  <textarea
                    value={editBgGradientInput}
                    onChange={(e) => setEditBgGradientInput(e.target.value)}
                    placeholder="e.g., linear-gradient(135deg, #ff6b35 0%, #fdb833 100%)"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-background font-mono resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring transition-shadow text-foreground placeholder:text-muted-foreground"
                    spellCheck={false}
                  />
                  {editBgGradientInput.trim() && (
                    <div
                      className="h-6 w-full rounded-lg border border-border"
                      style={{ background: editBgGradientInput.trim() }}
                      title="Gradient preview"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSaveTheme}
                disabled={!themeName.trim() || isSaving}
                size="sm"
                className="flex-1 h-9"
              >
                {isSaving ? (
                  <span className="flex items-center gap-1.5">
                    <Icon icon="lucide:loader-circle" width={13} height={13} className="animate-spin" />
                    Saving…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Icon icon="lucide:save" width={13} height={13} />
                    Save Theme
                  </span>
                )}
              </Button>
              <Button
                onClick={() => setShowSaveDialog(false)}
                variant="outline"
                size="sm"
                className="h-9 px-4"
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