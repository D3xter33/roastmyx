// src/components/RoastResult.tsx
// The screenshot-optimized result card.
// Designed to look great as a PNG export — no heavy images, all fonts/colors
// inline-styled enough that html-to-image can serialize cleanly.

"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Flame, Sparkles, AtSign, Image as ImageIcon, MessageSquare, User2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScoreMeter } from "./ScoreMeter";
import { cn, formatCount } from "@/lib/utils";
import type { RoastReport } from "@/lib/types";

// Route external X CDN URLs through our same-origin proxy. The proxy serves
// the bytes with permissive CORS headers so html-to-image can actually read
// pixels off the canvas — without this, the PNG download silently breaks.
function proxied(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("twimg.com")) {
      return `/api/img?u=${encodeURIComponent(url)}`;
    }
  } catch {
    /* not a URL — pass through */
  }
  return url;
}

interface Props {
  report: RoastReport;
}

const QUICK_HIT_ICONS = {
  pfp: ImageIcon,
  bio: User2,
  banner: Sparkles,
  tweets: MessageSquare,
  username: AtSign,
};

const QUICK_HIT_LABELS = {
  pfp: "PFP",
  bio: "Bio",
  banner: "Banner",
  tweets: "Tweets",
  username: "Username",
};

export const RoastResult = forwardRef<HTMLDivElement, Props>(({ report }, ref) => {
  const { profile } = report;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto mt-8 max-w-3xl"
    >
      {/* The screenshot target. Everything inside this div is what gets exported. */}
      <div ref={ref} className="relative">
        <Card className="overflow-hidden p-0">
          {/* Banner — proxied through same origin so html-to-image can read it */}
          <div className="relative h-32 sm:h-40 w-full overflow-hidden">
            {profile.bannerUrl && (
              <Image
                src={proxied(profile.bannerUrl)}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                unoptimized
                priority
                crossOrigin="anonymous"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-zinc-950/40 to-zinc-950" />
          </div>

          {/* Profile header */}
          <div className="relative px-6 sm:px-8">
            <div className="-mt-12 flex items-end gap-4">
              <div className="relative h-24 w-24 shrink-0 rounded-full ring-4 ring-zinc-950 overflow-hidden bg-zinc-900">
                {profile.pfpUrl && (
                  <Image
                    src={proxied(profile.pfpUrl)}
                    alt={profile.displayName}
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized
                    crossOrigin="anonymous"
                  />
                )}
              </div>
              <div className="pb-1 min-w-0 flex-1">
                <h2 className="text-xl font-bold text-white truncate">{profile.displayName}</h2>
                <p className="text-sm text-zinc-400">@{profile.handle}</p>
              </div>
              <div className="hidden sm:flex flex-col items-end text-right pb-1">
                <div className="text-xs text-zinc-500">followers</div>
                <div className="text-base font-semibold text-zinc-200">
                  {formatCount(profile.followers)}
                </div>
              </div>
            </div>

            {/* Account classification — first thing under the username so it's
                front-and-center on every shareable screenshot. */}
            <div className="mt-5 rounded-xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/10 via-rose-500/5 to-transparent p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
                account classification
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {report.finalLabel}
              </div>
            </div>

            {/* Verdict headline */}
            <div className="mt-6 rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-rose-500/5 to-transparent p-5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
                <Flame className="h-3 w-3" />
                verdict
              </div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight leading-[1.05] text-white">
                {report.verdictHeadline}
              </h1>
              <CookedMeter percent={report.verdictPercent} />
            </div>

            {/* Score meters */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {report.scoreCategories.map((c, i) => (
                <ScoreMeter key={c.key} label={c.label} value={c.value} delay={0.1 + i * 0.06} />
              ))}
            </div>

            {/* Core paragraph */}
            <div className="mt-7 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                the read
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-200">
                {report.coreParagraph}
              </p>
            </div>

            {/* Quick hits */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(report.quickHits) as (keyof typeof QUICK_HIT_LABELS)[]).map((k) => {
                const Icon = QUICK_HIT_ICONS[k];
                return (
                  <div
                    key={k}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      <Icon className="h-3 w-3" />
                      {QUICK_HIT_LABELS[k]}
                    </div>
                    <p className="mt-1 text-sm text-zinc-200">{report.quickHits[k]}</p>
                  </div>
                );
              })}
            </div>

            {/* Watermark / footer — keeps the screenshot branded without
                duplicating the classification (now at the top). */}
            <div className="mt-6 mb-6 flex items-center justify-end">
              <div className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-300">
                roastmyx.app
              </div>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
});

RoastResult.displayName = "RoastResult";

function CookedMeter({ percent }: { percent: number }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-zinc-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-[#FF1F8A] to-[#FF0033]",
            "shadow-[0_0_24px_rgba(255,0,80,0.6)]"
          )}
        />
      </div>
      <span className="text-sm font-bold text-[#FF1F8A] tabular-nums">{percent}%</span>
    </div>
  );
}
