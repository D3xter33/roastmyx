// src/components/ui/button.tsx
// shadcn/ui button — themed for RoastMyX (hot magenta primary).

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-zinc-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[#FF1F8A] to-[#FF0033] text-white shadow-[0_10px_30px_-10px_rgba(255,0,80,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110",
        secondary:
          "bg-zinc-900 text-zinc-100 border border-zinc-800 hover:bg-zinc-800",
        ghost: "text-zinc-300 hover:bg-zinc-900 hover:text-white",
        outline:
          "border border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-900",
        destructive:
          "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-14 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
