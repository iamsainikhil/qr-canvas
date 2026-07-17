import { Slider } from '@/components/ui/slider';

interface SizeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function SizeSlider({ value, onChange, min = 128, max = 512 }: SizeSliderProps) {
  // Normalize value to 0-100 range for slider
  const normalizedValue = ((value - min) / (max - min)) * 100;
  
  const handleChange = (values: number[]) => {
    const denormalized = Math.round((values[0] / 100) * (max - min) + min);
    onChange(denormalized);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Size</p>
      <div className="p-4 rounded-xl border border-border bg-background space-y-3">
        <Slider
          value={[normalizedValue]}
          onValueChange={handleChange}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Small</span>
          <span>Large</span>
        </div>
      </div>
    </div>
  );
}
