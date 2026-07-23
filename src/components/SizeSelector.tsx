import { cn } from '@/lib/utils';
import { Icon } from '@iconify/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SizePreset {
  id: string;
  label: string;
  description: string;
  size: number;
  icon: string;
}

const sizePresets: SizePreset[] = [
  { id: 'social', label: 'Social', description: 'Social media posts (500px)', size: 500, icon: 'lucide:smartphone' },
  { id: 'card', label: 'Card', description: 'Business cards (800px)', size: 800, icon: 'lucide:rectangle-horizontal' },
  { id: 'print', label: 'Print', description: 'Flyers & posters (1200px)', size: 1200, icon: 'lucide:printer' },
];

interface SizeSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

export function SizeSelector({ value, onChange }: SizeSelectorProps) {
  // Find the closest preset
  const selectedPreset = sizePresets.reduce((prev, curr) => 
    Math.abs(curr.size - value) < Math.abs(prev.size - value) ? curr : prev
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-3 gap-2">
        {sizePresets.map((preset) => (
          <Tooltip key={preset.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onChange(preset.size)}
                className={cn(
                  "h-12 px-4 rounded-2xl text-sm font-medium transition-all duration-200 border inline-flex items-center justify-center gap-2 w-full",
                  selectedPreset.id === preset.id
                    ? "gradient-border-selected"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                <Icon icon={preset.icon} className="h-4 w-4" />
                {preset.label}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{preset.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
