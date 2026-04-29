// src/lib/types.ts

export interface XProfile {
  handle: string;
  displayName: string;
  bio: string;
  pfpUrl: string;
  bannerUrl: string;
  followers: number;
  following: number;
  joined: string;
  recentTweets: string[];
  // Optional human-tagged signals — used by core truth derivation when present.
  tags?: string[];
}

// The hidden, deterministic "Core Profile Truth".
// Same handle => same truth, every single run. Tone never changes this.
export interface CoreProfileTruth {
  handle: string;
  archetype: Archetype;
  finalLabel: string;
  verdictPercent: number; // e.g. 83 -> "you are 83% cooked"
  scores: ScoreBlock;
  signals: string[]; // raw, neutral observations about the account
  pfpRead: string;
  bioRead: string;
  bannerRead: string;
  tweetsRead: string;
  usernameRead: string;
  coreParagraphSeed: string; // a stable, neutral truth paragraph (rephrased by tone)
}

export interface ScoreBlock {
  aura: number;
  mainCharacter: number;
  replyGuyRisk: number;
  fakeRich: number;
  scammerAesthetics: number;
  originality: number;
  timelineSurvivability: number;
  forcedFounderAura: number;
  convictionWithoutSize: number;
  bullMarketFraud: number;
}

export type Archetype =
  | "premium-reply-guy"
  | "bull-market-philosopher"
  | "engagement-farmer"
  | "fake-rich-real-online"
  | "founder-cosplay"
  | "chart-addict"
  | "anon-degen"
  | "overlord"
  | "philosopher-king"
  | "chaos-engine"
  | "nft-cope-survivor"
  | "anon-builder";

export type ToneMode =
  | "funny"
  | "brutal"
  | "degen-ct"
  | "dry-deadpan"
  | "mock-analyst"
  | "unhinged";

// Live, model-grounded analysis returned by claudeAnalyzer.
// Stable per handle; the `toned` map carries pre-rendered variants for all
// six modes so client-side "Roast again" never hits the model.
export interface AnalyzedTruth {
  archetype: Archetype;
  finalLabel: string;
  verdictPercent: number;
  scores: ScoreBlock;
  pfpRead: string;
  bioRead: string;
  bannerRead: string;
  tweetsRead: string;
  usernameRead: string;
  signals: string[];
  toned: Record<ToneMode, { verdictHeadline: string; coreParagraph: string }>;
}

// What we hand to the UI. Tone is applied; truth is preserved.
export interface RoastReport {
  handle: string;
  profile: XProfile;
  verdictHeadline: string;
  verdictPercent: number;
  finalLabel: string;
  scores: ScoreBlock;
  scoreCategories: { key: keyof ScoreBlock; label: string; value: number }[];
  coreParagraph: string;
  quickHits: {
    pfp: string;
    bio: string;
    banner: string;
    tweets: string;
    username: string;
  };
  // Internal-only — never rendered, but useful for debug overlays during dev.
  _meta: {
    archetype: Archetype;
    toneMode: ToneMode;
  };
}
