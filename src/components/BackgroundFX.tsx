// src/components/BackgroundFX.tsx
// Ambient page background: deep charcoal + soft magenta/red glow blobs +
// subtle grid. Lives behind everything, pointer-events:none.

"use client";

import { motion } from "framer-motion";

export function BackgroundFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-zinc-950"
    >
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* Soft animated glow — magenta */}
      <motion.div
        className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[#FF00AA] blur-[140px] opacity-25"
        animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft animated glow — neon red */}
      <motion.div
        className="absolute top-1/3 -right-40 h-[460px] w-[460px] rounded-full bg-[#FF0033] blur-[140px] opacity-20"
        animate={{ x: [0, -40, 20, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft animated glow — violet accent */}
      <motion.div
        className="absolute bottom-[-200px] left-1/3 h-[420px] w-[420px] rounded-full bg-violet-700 blur-[140px] opacity-15"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
