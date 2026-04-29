// src/lib/roastEngine.ts
// Pure client-side assembly. Combines:
//   - the immutable AnalyzedTruth returned by the server (cached per handle)
//   - one of 6 hidden tone modes (re-rolled locally, no model call)
// into a RoastReport ready for the UI.

import type {
  AnalyzedTruth,
  Archetype,
  RoastReport,
  ScoreBlock,
  ToneMode,
  XProfile,
} from "./types";

const SCORE_LABELS: Record<keyof ScoreBlock, string> = {
  aura: "Aura",
  mainCharacter: "Main Character",
  replyGuyRisk: "Reply Guy Risk",
  fakeRich: "Fake Rich",
  scammerAesthetics: "Scammer Aesthetics",
  originality: "Originality",
  // The internal key stays `timelineSurvivability` so the analyzer +
  // schema don't change. Only the displayed label flipped.
  timelineSurvivability: "Trend Catcher",
  forcedFounderAura: "Forced Founder Aura",
  convictionWithoutSize: "Conviction Without Size",
  bullMarketFraud: "Bull Market Fraud",
};

// Per archetype, surface the 6 most damning / interesting categories.
// Hidden ones still factor into verdictPercent, they just don't render.
const VISIBLE_CATEGORIES: Record<Archetype, (keyof ScoreBlock)[]> = {
  "philosopher-king": ["aura", "originality", "mainCharacter", "timelineSurvivability", "forcedFounderAura", "replyGuyRisk"],
  "overlord": ["mainCharacter", "aura", "timelineSurvivability", "scammerAesthetics", "fakeRich", "bullMarketFraud"],
  "chaos-engine": ["mainCharacter", "aura", "timelineSurvivability", "fakeRich", "forcedFounderAura", "bullMarketFraud"],
  "founder-cosplay": ["forcedFounderAura", "fakeRich", "originality", "convictionWithoutSize", "bullMarketFraud", "aura"],
  "premium-reply-guy": ["replyGuyRisk", "originality", "aura", "mainCharacter", "convictionWithoutSize", "timelineSurvivability"],
  "engagement-farmer": ["replyGuyRisk", "originality", "scammerAesthetics", "forcedFounderAura", "bullMarketFraud", "aura"],
  "fake-rich-real-online": ["fakeRich", "scammerAesthetics", "bullMarketFraud", "convictionWithoutSize", "forcedFounderAura", "originality"],
  "anon-degen": ["aura", "convictionWithoutSize", "originality", "bullMarketFraud", "timelineSurvivability", "scammerAesthetics"],
  "chart-addict": ["scammerAesthetics", "convictionWithoutSize", "bullMarketFraud", "originality", "fakeRich", "aura"],
  "bull-market-philosopher": ["forcedFounderAura", "bullMarketFraud", "convictionWithoutSize", "originality", "aura", "fakeRich"],
  "nft-cope-survivor": ["timelineSurvivability", "convictionWithoutSize", "originality", "aura", "fakeRich", "bullMarketFraud"],
  "anon-builder": ["aura", "originality", "timelineSurvivability", "replyGuyRisk", "fakeRich", "forcedFounderAura"],
};

const TONE_MODES: ToneMode[] = [
  "funny",
  "brutal",
  "degen-ct",
  "dry-deadpan",
  "mock-analyst",
  "unhinged",
];

/** Pick a tone, avoiding the previous one so consecutive presses always shift. */
export function pickToneMode(previous?: ToneMode): ToneMode {
  const pool = previous ? TONE_MODES.filter((m) => m !== previous) : TONE_MODES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Assemble a RoastReport from server-cached truth + a chosen tone.
 * Same truth + same tone => identical report. The truth never changes for
 * a given handle.
 */
export function buildReport(
  profile: XProfile,
  truth: AnalyzedTruth,
  tone: ToneMode
): RoastReport {
  const visible = VISIBLE_CATEGORIES[truth.archetype];
  const scoreCategories = visible.map((key) => ({
    key,
    label: SCORE_LABELS[key],
    value: truth.scores[key],
  }));

  const toned = truth.toned[tone];

  return {
    handle: profile.handle,
    profile,
    verdictHeadline: toned.verdictHeadline,
    verdictPercent: truth.verdictPercent,
    finalLabel: truth.finalLabel,
    scores: truth.scores,
    scoreCategories,
    coreParagraph: toned.coreParagraph,
    quickHits: {
      pfp: truth.pfpRead,
      bio: truth.bioRead,
      banner: truth.bannerRead,
      tweets: truth.tweetsRead,
      username: truth.usernameRead,
    },
    _meta: {
      archetype: truth.archetype,
      toneMode: tone,
    },
  };
}
