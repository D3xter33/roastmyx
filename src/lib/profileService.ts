// src/lib/profileService.ts
// Clean interface for fetching X profiles. Today: mock-backed.
// Swap MockProfileService -> a real X API / scraper later without touching UI.

import type { XProfile } from "./types";
import { findMockProfile, SAMPLE_HANDLES, MOCK_PROFILES } from "./mockProfiles";

export interface ProfileService {
  fetchProfile(handle: string): Promise<XProfile>;
}

class MockProfileService implements ProfileService {
  async fetchProfile(handle: string): Promise<XProfile> {
    // Simulate latency so the loading screen has time to be funny.
    await new Promise((r) => setTimeout(r, 1800 + Math.random() * 1200));

    const found = findMockProfile(handle);
    if (found) return found;

    // Unknown handle: synthesize a plausible profile so the app still works.
    return synthesizeProfile(handle);
  }
}

export const profileService: ProfileService = new MockProfileService();

// --- helpers ---

function synthesizeProfile(rawHandle: string): XProfile {
  const handle = rawHandle.replace(/^@/, "").trim().toLowerCase() || "anon";

  // Deterministic-ish picks so a given handle always synthesizes the same fake
  // profile. (The real determinism for the *roast* lives in coreTruth.ts.)
  const seed = handle;
  const pick = <T,>(arr: T[]) => arr[hash(seed) % arr.length]!;
  const pickN = (arr: string[], n: number) =>
    arr.slice().sort((a, b) => hash(a + seed) - hash(b + seed)).slice(0, n);

  const bios = [
    "shitposting professionally. dm for collabs.",
    "building something. probably. eventually. trust.",
    "ex-banking, current vibes. opinions = mine.",
    "no thoughts head empty. bullish.",
    "anon. don't ask. ⌐◨-◨",
    "father, founder, freedom maxi. links below.",
    "Markets. Mindset. Momentum. NFA.",
  ];

  const pool = [
    "this is the most bullish setup I've ever seen",
    "if you're not building right now ngmi",
    "@everyone literally this",
    "saving this for the bookmarks 🙏",
    "wake up kings. it's a beautiful day to be onchain.",
    "one chart that explains everything 🧵",
    "ratio'd by my own mom but bullish",
    "I called this 6 months ago. screenshot it.",
  ];

  return {
    handle,
    displayName: handle,
    bio: pick(bios),
    pfpUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(handle)}`,
    bannerUrl:
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1500&q=70",
    followers: 500 + (hash(handle) % 50_000),
    following: 200 + (hash(handle + "f") % 4_000),
    joined: "2023",
    recentTweets: pickN(pool, 5),
  };
}

// FNV-1a — small, deterministic, no deps. Used everywhere we need stability.
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

export { SAMPLE_HANDLES, MOCK_PROFILES };
