// src/components/LoadingScreen.tsx
// Funny rotating-message loader. Shown while profileService.fetchProfile resolves.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { LOADING_MESSAGES } from "@/lib/loadingMessages";

interface Props {
  handle: string;
}

export function LoadingScreen({ handle }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="mx-auto mt-16 max-w-xl text-center"
    >
      <div className="relative mx-auto h-24 w-24">
        <motion.div
          className="absolute inset-0 rounded-full bg-[#FF0033] blur-2xl opacity-50"
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="relative flex h-24 w-24 items-center justify-center rounded-full border border-fuchsia-500/40 bg-zinc-950"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        >
          <Flame className="h-10 w-10 text-[#FF1F8A]" />
        </motion.div>
      </div>

      <p className="mt-8 text-sm text-zinc-500">
        analyzing <span className="text-zinc-300 font-medium">@{handle}</span>
      </p>

      <div className="mt-2 h-7">
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-base font-medium text-white"
          >
            {LOADING_MESSAGES[idx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Soft progress shimmer */}
      <div className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded-full bg-zinc-900">
        <motion.div
          className="h-full w-1/3 bg-gradient-to-r from-[#FF1F8A] to-[#FF0033]"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
