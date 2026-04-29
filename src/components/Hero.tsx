// src/components/Hero.tsx
// Title block. Big bold logotype + sub + helper line.

"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

export function Hero() {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300"
      >
        <Flame className="h-3.5 w-3.5" />
        live · brutally accurate · not affiliated with X
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="mt-6 text-6xl sm:text-7xl md:text-8xl font-black tracking-tight leading-[0.95]"
      >
        <span className="bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-transparent">
          Roast
        </span>
        <span className="bg-gradient-to-b from-[#FF1F8A] to-[#FF0033] bg-clip-text text-transparent">
          My
        </span>
        <span className="bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-transparent">
          X
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mt-5 text-lg sm:text-xl text-zinc-300"
      >
        the app that tells you what your X profile actually looks like
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-2 text-sm text-zinc-500"
      >
        analyzes your pfp, bio, banner, username and recent tweets
      </motion.p>
    </div>
  );
}
