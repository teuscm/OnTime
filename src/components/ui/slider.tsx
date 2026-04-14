"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatLabel?: (value: number) => string;
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, min, max, step = 1, onChange, formatLabel, ...props }, ref) => {
    const percent = ((value - min) / (max - min)) * 100;

    return (
      <div className={cn("space-y-2", className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) ${percent}%, hsl(var(--muted)) ${percent}%)`,
          }}
          {...props}
        />
        {formatLabel && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatLabel(min)}</span>
            <span className="font-medium text-foreground">{formatLabel(value)}</span>
            <span>{formatLabel(max)}</span>
          </div>
        )}
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
