// src/components/HandleInput.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, AtSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SAMPLE_HANDLES } from "@/lib/sampleHandles";

interface Props {
  onRoast: (handle: string) => void;
  disabled?: boolean;
}

export function HandleInput({ onRoast, disabled }: Props) {
  const [value, setValue] = useState("");

  // Strip leading @ as the user types, so the AtSign icon doesn't visually
  // double up when someone pastes "@zaika_hl". Also strip whitespace and
  // any non-handle characters early.
  const cleanHandle = (raw: string) =>
    raw.replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = cleanHandle(value);
    if (!handle) return;
    onRoast(handle);
  };

  // Show 4 sample chips so empty-state users have one-click options.
  const samples = SAMPLE_HANDLES.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35 }}
      className="mt-10 max-w-xl mx-auto"
    >
      <form
        onSubmit={submit}
        className="relative flex flex-col sm:flex-row gap-3 p-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md shadow-[0_30px_80px_-30px_rgba(255,0,80,0.35)]"
      >
        <div className="relative flex-1">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={value}
            onChange={(e) => setValue(cleanHandle(e.target.value))}
            placeholder="handle"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            className="pl-9 h-12 border-transparent bg-transparent text-lg focus-visible:ring-0 focus-visible:border-transparent"
            disabled={disabled}
          />
        </div>
        <Button type="submit" size="lg" disabled={disabled || !value.trim()} className="sm:px-7">
          <Flame className="h-4 w-4" />
          Roast me
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-zinc-500">
        disturbingly accurate. emotionally unnecessary.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <span className="text-xs text-zinc-500 self-center mr-1">try:</span>
        {samples.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => {
              setValue(h);
              onRoast(h);
            }}
            disabled={disabled}
            className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300 hover:border-fuchsia-500/50 hover:text-white transition disabled:opacity-50"
          >
            @{h}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
