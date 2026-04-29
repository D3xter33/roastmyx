// src/components/ShareBar.tsx
// Sticky-feeling action bar at the bottom of the result card.

"use client";

import { Button } from "@/components/ui/button";
import { Copy, Download, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import {
  buildShareText,
  copyToClipboard,
  downloadCardAsPng,
  fireConfetti,
} from "@/lib/share";
import type { RoastReport } from "@/lib/types";

interface Props {
  report: RoastReport;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onRoastAgain: () => void;
  onRoastMutual: () => void;
}

export function ShareBar({ report, cardRef, onRoastAgain, onRoastMutual }: Props) {
  const handleCopy = async () => {
    await copyToClipboard(buildShareText(report));
    toast.success("copied. now paste it somewhere brave.");
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      await downloadCardAsPng(cardRef.current, `roastmyx-${report.handle}.png`);
      fireConfetti();
      toast.success("saved. now post it to X yourself.");
    } catch (e) {
      // Surface real error so users (and us) can debug instead of guessing.
      const msg = e instanceof Error ? e.message : "unknown error";
      console.error("[download] failed", e);
      toast.error(`download failed: ${msg}`);
    }
  };

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      {/* Primary action — the only path to share is download + manually post */}
      <Button onClick={handleDownload} size="lg">
        <Download className="h-4 w-4" />
        Download PNG
      </Button>
      <Button onClick={handleCopy} variant="secondary" size="lg">
        <Copy className="h-4 w-4" />
        Copy result
      </Button>
      <Button onClick={onRoastAgain} variant="outline" size="lg">
        <RefreshCw className="h-4 w-4" />
        Roast again
      </Button>
      <Button onClick={onRoastMutual} variant="ghost" size="lg">
        <Users className="h-4 w-4" />
        Roast your mutuals
      </Button>
    </div>
  );
}
