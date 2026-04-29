// src/lib/toneModes.ts
// Stage 2 of the two-stage roast system.
// Takes a CoreProfileTruth and rephrases it in one of 6 hidden tones.
// The MEANING never changes — only the voice.

import type { CoreProfileTruth, ToneMode } from "./types";

export const TONE_MODES: ToneMode[] = [
  "funny",
  "brutal",
  "degen-ct",
  "dry-deadpan",
  "mock-analyst",
  "unhinged",
];

/**
 * Pick a tone mode for this run. Excludes `previous` so consecutive
 * "Roast again" presses always feel different.
 */
export function pickToneMode(previous?: ToneMode): ToneMode {
  const pool = previous ? TONE_MODES.filter((m) => m !== previous) : TONE_MODES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

interface ToneOutput {
  verdictHeadline: string;
  coreParagraph: string;
  pfp: string;
  bio: string;
  banner: string;
  tweets: string;
  username: string;
}

/**
 * Rephrase a stable truth in the given tone. The verdict %, archetype,
 * scores, and final label NEVER change here — only delivery.
 */
export function applyTone(truth: CoreProfileTruth, mode: ToneMode): ToneOutput {
  switch (mode) {
    case "funny":      return funny(truth);
    case "brutal":     return brutal(truth);
    case "degen-ct":   return degenCt(truth);
    case "dry-deadpan":return dryDeadpan(truth);
    case "mock-analyst":return mockAnalyst(truth);
    case "unhinged":   return unhinged(truth);
  }
}

// ---------- tone implementations ----------

function funny(t: CoreProfileTruth): ToneOutput {
  return {
    verdictHeadline: `you are ${t.verdictPercent}% cooked`,
    coreParagraph:
      `okay so. ${t.coreParagraphSeed} ` +
      `that's the read. that's the whole read. you can disagree but the timeline is the receipt.`,
    pfp: lighten(t.pfpRead),
    bio: lighten(t.bioRead),
    banner: lighten(t.bannerRead),
    tweets: lighten(t.tweetsRead),
    username: lighten(t.usernameRead),
  };
}

function brutal(t: CoreProfileTruth): ToneOutput {
  return {
    verdictHeadline: `verdict: ${t.verdictPercent}% cooked. no appeal.`,
    coreParagraph:
      `let's be plain. ${t.coreParagraphSeed} ` +
      `nothing about this account is an accident. you chose every part of it. that's the part that should sting.`,
    pfp: harden(t.pfpRead),
    bio: harden(t.bioRead),
    banner: harden(t.bannerRead),
    tweets: harden(t.tweetsRead),
    username: harden(t.usernameRead),
  };
}

function degenCt(t: CoreProfileTruth): ToneOutput {
  return {
    verdictHeadline: `ngl bro, ${t.verdictPercent}% cooked`,
    coreParagraph:
      `gm. ser. respectfully. ${lower(t.coreParagraphSeed)} ` +
      `this is not financial advice. this is character advice. and you are short the float.`,
    pfp: ctify(t.pfpRead),
    bio: ctify(t.bioRead),
    banner: ctify(t.bannerRead),
    tweets: ctify(t.tweetsRead),
    username: ctify(t.usernameRead),
  };
}

function dryDeadpan(t: CoreProfileTruth): ToneOutput {
  return {
    verdictHeadline: `assessment: approximately ${t.verdictPercent}% cooked.`,
    coreParagraph:
      `${t.coreParagraphSeed} ` +
      `this is the situation. it does not require commentary. it has provided its own.`,
    pfp: deadpan(t.pfpRead),
    bio: deadpan(t.bioRead),
    banner: deadpan(t.bannerRead),
    tweets: deadpan(t.tweetsRead),
    username: deadpan(t.usernameRead),
  };
}

function mockAnalyst(t: CoreProfileTruth): ToneOutput {
  return {
    verdictHeadline: `Q4 personality review: ${t.verdictPercent}% cooked`,
    coreParagraph:
      `Executive summary. ${t.coreParagraphSeed} ` +
      `Recommendation: revise positioning. Risk factor: continued posting at current cadence. Rating: hold (yourself accountable).`,
    pfp: analystify("Profile imagery", t.pfpRead),
    bio: analystify("Bio copy", t.bioRead),
    banner: analystify("Banner asset", t.bannerRead),
    tweets: analystify("Recent posts", t.tweetsRead),
    username: analystify("Handle", t.usernameRead),
  };
}

function unhinged(t: CoreProfileTruth): ToneOutput {
  return {
    verdictHeadline: `${t.verdictPercent}% COOKED. WELL DONE. RESTING NOW.`,
    coreParagraph:
      `LISTEN. ${t.coreParagraphSeed} ` +
      `i didn't want to say it. the timeline made me. i'm a vessel. log off and reconsider your entire deal.`,
    pfp: unhingify(t.pfpRead),
    bio: unhingify(t.bioRead),
    banner: unhingify(t.bannerRead),
    tweets: unhingify(t.tweetsRead),
    username: unhingify(t.usernameRead),
  };
}

// ---------- tone shapers (small, safe transforms — never alter meaning) ----------

const lower = (s: string) => s.toLowerCase();

function lighten(s: string) {
  return lower(s) + " 😭";
}

function harden(s: string) {
  return s.replace(/^./, (c) => c.toUpperCase()) + ".";
}

function ctify(s: string) {
  return "ngl, " + lower(s) + " — anon you have to log off";
}

function deadpan(s: string) {
  return s.replace(/^./, (c) => c.toUpperCase()) + ". Noted.";
}

function analystify(label: string, s: string) {
  return `${label}: ${s}. (Confidence: high.)`;
}

function unhingify(s: string) {
  return lower(s).replace(/\.$/, "") + " AND I WILL NOT BE TAKING QUESTIONS";
}
