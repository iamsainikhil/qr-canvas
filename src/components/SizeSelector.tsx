import { cn } from '@/lib/utils';
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
}

const sizePresets: SizePreset[] = [
  { id: 'social', label: 'Social', description: 'Social media posts (500px)', size: 500 },
  { id: 'card', label: 'Card', description: 'Business cards (800px)', size: 800 },
  { id: 'print', label: 'Print', description: 'Flyers & posters (1200px)', size: 1200 },
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
                  "py-3 px-4 rounded-2xl text-sm font-medium transition-all duration-200 border",
                  selectedPreset.id === preset.id
                    ? "gradient-border-selected"
                    : "border-[#E5E5E5] bg-white hover:bg-[#F5F5F5]/50"
                )}
              >
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
