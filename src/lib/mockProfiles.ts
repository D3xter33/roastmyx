// src/lib/mockProfiles.ts
// Hand-curated mock dataset. 10 archetypes covering the CT / X spectrum.
// Real scraping/API can be plugged in via profileService.ts later.

import type { XProfile } from "./types";

const dicebear = (seed: string, style = "shapes") =>
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;

const banner = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1500&q=70`;

export const MOCK_PROFILES: Record<string, XProfile> = {
  vitalikbuterin: {
    handle: "vitalikbuterin",
    displayName: "vitalik.eth",
    bio: "Ethereum. Hopefully more.",
    pfpUrl: dicebear("vitalikbuterin", "bottts"),
    bannerUrl: banner("1620641788421-7a1c342ea42e"),
    followers: 5_400_000,
    following: 320,
    joined: "May 2011",
    recentTweets: [
      "the social layer matters more than the consensus layer at this stage",
      "small thread on rollups and the meaning of decentralization",
      "interesting paper on prediction markets and epistemic legitimacy",
      "good conference. saw old friends. ate a salad.",
    ],
    tags: ["philosopher-king"],
  },

  cz_binance: {
    handle: "cz_binance",
    displayName: "CZ 🔶 BNB",
    bio: "Ex-Binance. BNB.",
    pfpUrl: dicebear("cz_binance", "initials"),
    bannerUrl: banner("1639762681485-074b7f938ba0"),
    followers: 9_100_000,
    following: 88,
    joined: "Aug 2017",
    recentTweets: [
      "4",
      "Ignore the FUD. BUIDL.",
      "Funds are SAFU.",
      "Builders build through cycles.",
    ],
    tags: ["overlord"],
  },

  elonmusk: {
    handle: "elonmusk",
    displayName: "Elon Musk",
    bio: "",
    pfpUrl: dicebear("elonmusk", "thumbs"),
    bannerUrl: banner("1451187580459-43490279c0fa"),
    followers: 210_000_000,
    following: 1100,
    joined: "Jun 2009",
    recentTweets: [
      "Concerning",
      "lmao",
      "!!",
      "interesting",
      "true",
    ],
    tags: ["chaos-engine"],
  },

  ct_founder_99: {
    handle: "ct_founder_99",
    displayName: "alex | building 🛠️",
    bio: "Co-founder & CEO @stealthco. ex-banking. building the future of onchain X. dms open for builders.",
    pfpUrl: dicebear("ct_founder_99", "avataaars"),
    bannerUrl: banner("1518770660439-4636190af475"),
    followers: 14_200,
    following: 1_900,
    joined: "Jan 2022",
    recentTweets: [
      "Day 412 of building. We're cooking. 🧑‍🍳",
      "Hot take: most projects fail because of distribution, not product.",
      "Just closed a transformative partnership. More soon. 👀",
      "Reminder: you're either building or you're cope-trading.",
      "Quick thread on why we're entering a new attention paradigm 🧵",
    ],
    tags: ["founder-cosplay"],
  },

  reply_guy_pro: {
    handle: "reply_guy_pro",
    displayName: "marcus 📈",
    bio: "Markets, mindset, momentum. Father of two. Husband of one. Posts are my own.",
    pfpUrl: dicebear("reply_guy_pro", "personas"),
    bannerUrl: banner("1554224155-6726b3ff858f"),
    followers: 3_400,
    following: 8_900,
    joined: "Sep 2023",
    recentTweets: [
      "This. 100%.",
      "Underrated take.",
      "Saving this thread for later 🙏",
      "@elonmusk literally this",
      "Bookmarked. Print this and frame it.",
      "Bullish.",
    ],
    tags: ["premium-reply-guy"],
  },

  degen_pepe: {
    handle: "degen_pepe",
    displayName: "pepe 🐸 (e/acc)",
    bio: "fading your cope since '21. anon. no advice. probably nothing.",
    pfpUrl: dicebear("degen_pepe", "fun-emoji"),
    bannerUrl: banner("1517694712202-14dd9538aa97"),
    followers: 22_800,
    following: 200,
    joined: "Mar 2021",
    recentTweets: [
      "aped. no questions. ngmi if you didn't.",
      "this chart looks like my ex's electrocardiogram",
      "sirs the bottom is in. trust me bro.",
      "one trade away from the lambo. or jail. either works.",
      "if you sold here you don't deserve the next leg",
    ],
    tags: ["anon-degen"],
  },

  chart_addict: {
    handle: "chart_addict",
    displayName: "TheCryptoOracle™",
    bio: "TA only. 1M+ traders read me. NFA. Telegram in bio. 🚀📊",
    pfpUrl: dicebear("chart_addict", "miniavs"),
    bannerUrl: banner("1611974789855-9c2a0a7236a3"),
    followers: 187_400,
    following: 12,
    joined: "Nov 2020",
    recentTweets: [
      "BTC: classic bull flag forming. target $148k. NFA. 🚀",
      "I called it. Screenshot this.",
      "Wave 3 of 5. We are still early.",
      "If you're not buying here you simply don't get markets.",
      "Subscribe to my premium for more alpha 👇",
    ],
    tags: ["chart-addict"],
  },

  fake_rich_4u: {
    handle: "fake_rich_4u",
    displayName: "Daniel | 7-Figure Mindset",
    bio: "From $0 to $10M. I teach men how to escape the matrix. DMs open. 💎🦁",
    pfpUrl: dicebear("fake_rich_4u", "personas"),
    bannerUrl: banner("1503965830912-6d7b07921cd1"),
    followers: 88_200,
    following: 47,
    joined: "Apr 2022",
    recentTweets: [
      "Most men will never make it. Here's why 🧵",
      "Your bloodline is watching. Don't disappoint them.",
      "Wake up. Cold plunge. Conquer. Repeat.",
      "I almost lost everything. Then I built this empire. Lessons:",
      "Comment 'ALPHA' and I'll DM you my free guide.",
    ],
    tags: ["fake-rich-real-online"],
  },

  nft_survivor: {
    handle: "nft_survivor",
    displayName: "frank.jpeg",
    bio: "Digital art collector. Taste enjoyer. Bored since 2021. gm.",
    pfpUrl: dicebear("nft_survivor", "lorelei"),
    bannerUrl: banner("1557672172-298e090bd0f1"),
    followers: 9_700,
    following: 2_100,
    joined: "Aug 2021",
    recentTweets: [
      "still believe in art. floor doesn't matter. (it does)",
      "this collection is criminally underrated",
      "gm to the real ones who held through everything",
      "minted, paper-handed, refunded my soul. classic tuesday.",
    ],
    tags: ["nft-cope-survivor"],
  },

  anon_dev_42: {
    handle: "anon_dev_42",
    displayName: "0xshade",
    bio: "writing code for a living. ignoring everything else. anon. ⌐◨-◨",
    pfpUrl: dicebear("anon_dev_42", "shapes"),
    bannerUrl: banner("1517245386807-bb43f82c33c4"),
    followers: 2_100,
    following: 90,
    joined: "Feb 2024",
    recentTweets: [
      "shipped. caffeine consumed. retiring at age 31.",
      "if your protocol has a marketing team before audits, ngmi",
      "I touched grass once. It was overrated.",
      "git blame says it's me. I do not recall this.",
    ],
    tags: ["anon-builder"],
  },
};

// Aliases — let users type any common form of the handle.
const ALIASES: Record<string, string> = {
  vitalik: "vitalikbuterin",
  cz: "cz_binance",
  elon: "elonmusk",
  founder: "ct_founder_99",
  reply: "reply_guy_pro",
  pepe: "degen_pepe",
  oracle: "chart_addict",
  daniel: "fake_rich_4u",
  nft: "nft_survivor",
  dev: "anon_dev_42",
};

/**
 * Look up a handle in the mock dataset.
 * Strips @, lowercases, and resolves aliases.
 */
export function findMockProfile(rawHandle: string): XProfile | undefined {
  const h = rawHandle.replace(/^@/, "").trim().toLowerCase();
  if (!h) return undefined;
  const resolved = ALIASES[h] ?? h;
  return MOCK_PROFILES[resolved];
}

export const SAMPLE_HANDLES = Object.keys(MOCK_PROFILES);
