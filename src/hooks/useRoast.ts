// src/hooks/useRoast.ts
// Orchestrates: handle -> POST /api/roast -> cache truth -> apply tone.
// "Roast again" only re-rolls the local tone — same truth, no model call.

"use client";

import { useCallback, useRef, useState } from "react";
import { buildReport, pickToneMode } from "@/lib/roastEngine";
import type {
  AnalyzedTruth,
  RoastReport,
  ToneMode,
  XProfile,
} from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "error";

interface State {
  status: Status;
  handle: string | null;
  report: RoastReport | null;
  error: string | null;
}

interface CachedAnalysis {
  profile: XProfile;
  truth: AnalyzedTruth;
}

const initial: State = { status: "idle", handle: null, report: null, error: null };

export function useRoast() {
  const [state, setState] = useState<State>(initial);
  const analysisCache = useRef<Map<string, CachedAnalysis>>(new Map());
  const lastTone = useRef<ToneMode | undefined>(undefined);

  const roast = useCallback(async (rawHandle: string) => {
    const handle = rawHandle.replace(/^@/, "").trim().toLowerCase();
    if (!handle) return;

    setState({ status: "loading", handle, report: null, error: null });
    lastTone.current = undefined;

    try {
      let cached = analysisCache.current.get(handle);
      if (!cached) {
        const res = await fetch("/api/roast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `request failed (${res.status})`);
        }
        const data = (await res.json()) as CachedAnalysis;
        cached = data;
        analysisCache.current.set(handle, cached);
      }

      const tone = pickToneMode(lastTone.current);
      lastTone.current = tone;
      const report = buildReport(cached.profile, cached.truth, tone);

      setState({ status: "ready", handle, report, error: null });
    } catch (e) {
      setState({
        status: "error",
        handle,
        report: null,
        error: e instanceof Error ? e.message : "something broke",
      });
    }
  }, []);

  /** Re-roll tone for the current handle. Free, instant — no model call. */
  const roastAgain = useCallback(() => {
    if (!state.handle) return;
    const cached = analysisCache.current.get(state.handle);
    if (!cached) return;
    const tone = pickToneMode(lastTone.current);
    lastTone.current = tone;
    const report = buildReport(cached.profile, cached.truth, tone);
    setState((s) => ({ ...s, status: "ready", report, error: null }));
  }, [state.handle]);

  const reset = useCallback(() => {
    setState(initial);
    lastTone.current = undefined;
  }, []);

  return {
    ...state,
    roast,
    roastAgain,
    reset,
  };
}
