// src/components/ScoreMeter.tsx
// Animated horizontal score bar. Used for the 6 visible category scores.

"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number; // 1-99
  delay?: number;
}

export function ScoreMeter({ label, value, delay = 0 }: Props) {
  // Color by intensity: low = magenta, mid = pink/red, high = bright red.
  const tone =
    value >= 80
      ? "from-[#FF0033] to-[#FF1F8A]"
      : value >= 50
      ? "from-[#FF1F8A] to-fuchsia-500"
      : "from-fuchsia-500 to-violet-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <span className={cn("text-sm font-bold tabular-nums",
          value >= 80 ? "text-[#FF1F8A]" : "text-zinc-200"
        )}>
          {value}
          <span className="text-zinc-600 font-normal text-xs">/100</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-zinc-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "h-full rounded-full bg-gradient-to-r shadow-[0_0_18px_rgba(255,0,80,0.45)]",
            tone
          )}
        />
      </div>
    </div>
  );
}
