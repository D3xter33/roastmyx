// src/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-base text-zinc-100 placeholder:text-zinc-500 backdrop-blur-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:border-fuchsia-500/60",
        "disabled:cursor-not-allowed disabled:opacity-50 transition",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
