// src/app/page.tsx
// The whole app is a single page: hero -> input -> (loading | result).
// State machine lives in useRoast(). UI just renders the current phase.

"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hero } from "@/components/Hero";
import { HandleInput } from "@/components/HandleInput";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RoastResult } from "@/components/RoastResult";
import { ShareBar } from "@/components/ShareBar";
import { Button } from "@/components/ui/button";
import { useRoast } from "@/hooks/useRoast";
import { ArrowLeft } from "lucide-react";

export default function HomePage() {
  const { status, handle, report, error, roast, roastAgain, reset } = useRoast();
  const cardRef = useRef<HTMLDivElement>(null);

  const isResting = status === "idle";
  const isLoading = status === "loading";
  const isReady = status === "ready" && !!report;
  const isError = status === "error";

  return (
    <main className="relative min-h-screen px-4 sm:px-6 pt-16 sm:pt-24 pb-24">
      <div className="mx-auto max-w-5xl">
        <AnimatePresence mode="wait">
          {(isResting || isLoading) && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <Hero />
              <HandleInput onRoast={roast} disabled={isLoading} />
              {isLoading && <LoadingScreen handle={handle ?? ""} />}
            </motion.div>
          )}

          {isReady && report && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-2 max-w-3xl mx-auto">
                <Button variant="ghost" size="sm" onClick={reset}>
                  <ArrowLeft className="h-4 w-4" />
                  new handle
                </Button>
                <div className="text-xs text-zinc-500">
                  result for <span className="text-zinc-300">@{report.handle}</span>
                </div>
              </div>

              <RoastResult ref={cardRef} report={report} />

              <div className="max-w-3xl mx-auto">
                <ShareBar
                  report={report}
                  cardRef={cardRef}
                  onRoastAgain={roastAgain}
                  onRoastMutual={reset}
                />

                <p className="mt-6 text-center text-xs text-zinc-500">
                  same handle = same diagnosis. only the delivery changes. roast again to feel something new.
                </p>
              </div>
            </motion.div>
          )}

          {isError && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-20 text-center max-w-md mx-auto"
            >
              <p className="text-lg text-zinc-200">couldn&apos;t roast that one.</p>
              <p className="mt-2 text-sm text-zinc-500 break-words">
                {error || "unknown error"}
              </p>
              <Button onClick={reset} variant="outline" size="sm" className="mt-6">
                try a different handle
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-24 text-center text-xs text-zinc-600">
          built with ❤️ and zero respect · RoastMyX is a parody / fan project,
          not affiliated with X
        </footer>
      </div>
    </main>
  );
}
