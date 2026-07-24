import { cn } from '@/lib/utils';
import patternSquare from '@/assets/pattern-square.svg';
import patternDots from '@/assets/pattern-dots.svg';
import patternRounded from '@/assets/pattern-rounded.svg';
import patternDiamond from '@/assets/pattern-diamond.svg';
import patternClassy from '@/assets/pattern-classy.svg';

export type BodyShape = 'square' | 'dots' | 'rounded' | 'classy' | 'sharp';

interface BodyShapeSelectorProps {
  selectedShape: BodyShape;
  onShapeChange: (shape: BodyShape) => void;
}

const bodyShapes: { id: BodyShape; label: string; icon: string }[] = [
  { id: 'square', label: 'Square', icon: patternSquare },
  { id: 'dots', label: 'Dots', icon: patternDots },
  { id: 'rounded', label: 'Rounded', icon: patternRounded },
  { id: 'sharp', label: 'Diamond', icon: patternDiamond },
  { id: 'classy', label: 'Classy', icon: patternClassy },
];

export function BodyShapeSelector({ selectedShape, onShapeChange }: BodyShapeSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {bodyShapes.map((shape) => (
        <button
          key={shape.id}
          onClick={() => onShapeChange(shape.id)}
          className={cn(
            "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-200 border",
            selectedShape === shape.id
              ? "gradient-border-selected"
              : "border-border bg-card hover:bg-muted/50"
          )}
          title={shape.label}
        >
          <img
            src={shape.icon}
            alt={shape.label}
            className="w-8 h-8 object-contain"
          />
          <span className="text-[10px] font-medium text-foreground leading-none w-full text-center truncate px-0.5">
            {shape.label}
          </span>
        </button>
      ))}
    </div>
  );
}
