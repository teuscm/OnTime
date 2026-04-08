import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-onfly focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "gradient-onfly text-white shadow-md hover:shadow-lg hover:brightness-110 active:brightness-95",
        secondary:
          "bg-card border border-border text-foreground hover:bg-border-hover hover:border-border-hover",
        ghost:
          "text-muted hover:text-foreground hover:bg-card",
        onhappy:
          "gradient-onhappy text-white shadow-md hover:shadow-lg hover:brightness-110 active:brightness-95",
        outline:
          "border border-onfly/30 text-onfly hover:bg-onfly/10 hover:border-onfly/50",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-[var(--radius-sm)]",
        md: "h-10 px-5 text-sm rounded-[var(--radius-sm)]",
        lg: "h-12 px-8 text-base rounded-[var(--radius-md)]",
        xl: "h-14 px-10 text-lg rounded-[var(--radius-md)]",
        icon: "h-10 w-10 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
