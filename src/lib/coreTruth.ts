// src/lib/coreTruth.ts
// Stage 1 of the two-stage roast system.
// Produces a HIDDEN, deterministic "Core Profile Truth" for a handle.
//
// Invariants:
//   - Same handle in => same truth out, every single run.
//   - Tone never modifies anything in here.
//   - This object is never shown to the user.

import type {
  Archetype,
  CoreProfileTruth,
  ScoreBlock,
  XProfile,
} from "./types";
import { hash } from "./profileService";

// Stable PRNG seeded by handle. Simple LCG — sufficient for picking variants.
function rng(seed: string) {
  let s = hash(seed);
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const ARCHETYPE_BY_TAG: Record<string, Archetype> = {
  "philosopher-king": "philosopher-king",
  "overlord": "overlord",
  "chaos-engine": "chaos-engine",
  "founder-cosplay": "founder-cosplay",
  "premium-reply-guy": "premium-reply-guy",
  "anon-degen": "anon-degen",
  "chart-addict": "chart-addict",
  "fake-rich-real-online": "fake-rich-real-online",
  "nft-cope-survivor": "nft-cope-survivor",
  "anon-builder": "anon-builder",
};

const FALLBACK_ARCHETYPES: Archetype[] = [
  "premium-reply-guy",
  "bull-market-philosopher",
  "engagement-farmer",
  "fake-rich-real-online",
  "founder-cosplay",
  "chart-addict",
  "anon-degen",
];

// Heuristics over the public profile fields. Cheap, deterministic, fun.
function inferArchetype(p: XProfile): Archetype {
  const tag = p.tags?.[0];
  if (tag && ARCHETYPE_BY_TAG[tag]) return ARCHETYPE_BY_TAG[tag];

  const bio = p.bio.toLowerCase();
  const tweets = p.recentTweets.join(" \n ").toLowerCase();
  const ratio = p.following / Math.max(p.followers, 1);

  if (/founder|ceo|building|builder|shipping/.test(bio)) return "founder-cosplay";
  if (/nfa|chart|ta|target|wave/.test(tweets)) return "chart-addict";
  if (/escape the matrix|mindset|7-figure|alpha/.test(bio + tweets)) return "fake-rich-real-online";
  if (/anon|⌐◨-◨/.test(bio)) return "anon-degen";
  if (ratio > 1.5 || /\bthis\.\b|underrated take|bookmarked/.test(tweets))
    return "premium-reply-guy";
  if (/jpeg|nft|floor|mint/.test(bio + tweets)) return "nft-cope-survivor";

  return FALLBACK_ARCHETYPES[hash(p.handle) % FALLBACK_ARCHETYPES.length]!;
}

// Each archetype has a baseline score profile. Then we deterministically
// jitter ±X based on handle hash so two reply guys aren't identical.
const ARCHETYPE_BASELINES: Record<Archetype, ScoreBlock> = {
  "philosopher-king": {
    aura: 92, mainCharacter: 78, replyGuyRisk: 8, fakeRich: 4,
    scammerAesthetics: 3, originality: 95, timelineSurvivability: 90,
    forcedFounderAura: 12, convictionWithoutSize: 30, bullMarketFraud: 5,
  },
  "overlord": {
    aura: 88, mainCharacter: 96, replyGuyRisk: 4, fakeRich: 20,
    scammerAesthetics: 18, originality: 60, timelineSurvivability: 95,
    forcedFounderAura: 30, convictionWithoutSize: 10, bullMarketFraud: 22,
  },
  "chaos-engine": {
    aura: 80, mainCharacter: 99, replyGuyRisk: 30, fakeRich: 70,
    scammerAesthetics: 35, originality: 70, timelineSurvivability: 88,
    forcedFounderAura: 55, convictionWithoutSize: 40, bullMarketFraud: 50,
  },
  "founder-cosplay": {
    aura: 38, mainCharacter: 72, replyGuyRisk: 35, fakeRich: 65,
    scammerAesthetics: 40, originality: 22, timelineSurvivability: 30,
    forcedFounderAura: 92, convictionWithoutSize: 78, bullMarketFraud: 70,
  },
  "premium-reply-guy": {
    aura: 18, mainCharacter: 12, replyGuyRisk: 96, fakeRich: 22,
    scammerAesthetics: 14, originality: 8, timelineSurvivability: 24,
    forcedFounderAura: 30, convictionWithoutSize: 60, bullMarketFraud: 18,
  },
  "engagement-farmer": {
    aura: 28, mainCharacter: 50, replyGuyRisk: 70, fakeRich: 40,
    scammerAesthetics: 38, originality: 14, timelineSurvivability: 45,
    forcedFounderAura: 40, convictionWithoutSize: 55, bullMarketFraud: 50,
  },
  "fake-rich-real-online": {
    aura: 22, mainCharacter: 80, replyGuyRisk: 18, fakeRich: 95,
    scammerAesthetics: 88, originality: 14, timelineSurvivability: 38,
    forcedFounderAura: 70, convictionWithoutSize: 90, bullMarketFraud: 92,
  },
  "anon-degen": {
    aura: 64, mainCharacter: 45, replyGuyRisk: 28, fakeRich: 45,
    scammerAesthetics: 42, originality: 70, timelineSurvivability: 70,
    forcedFounderAura: 18, convictionWithoutSize: 80, bullMarketFraud: 55,
  },
  "chart-addict": {
    aura: 40, mainCharacter: 60, replyGuyRisk: 22, fakeRich: 55,
    scammerAesthetics: 70, originality: 18, timelineSurvivability: 50,
    forcedFounderAura: 25, convictionWithoutSize: 88, bullMarketFraud: 78,
  },
  "bull-market-philosopher": {
    aura: 50, mainCharacter: 60, replyGuyRisk: 35, fakeRich: 58,
    scammerAesthetics: 30, originality: 30, timelineSurvivability: 40,
    forcedFounderAura: 60, convictionWithoutSize: 70, bullMarketFraud: 75,
  },
  "nft-cope-survivor": {
    aura: 55, mainCharacter: 38, replyGuyRisk: 30, fakeRich: 40,
    scammerAesthetics: 35, originality: 50, timelineSurvivability: 60,
    forcedFounderAura: 25, convictionWithoutSize: 70, bullMarketFraud: 55,
  },
  "anon-builder": {
    aura: 78, mainCharacter: 30, replyGuyRisk: 10, fakeRich: 8,
    scammerAesthetics: 6, originality: 80, timelineSurvivability: 80,
    forcedFounderAura: 20, convictionWithoutSize: 25, bullMarketFraud: 8,
  },
};

const FINAL_LABELS: Record<Archetype, string> = {
  "philosopher-king": "philosopher king (real)",
  "overlord": "low-effort exchange overlord",
  "chaos-engine": "chaos engine, posting division",
  "founder-cosplay": "founder cosplay account",
  "premium-reply-guy": "premium reply guy",
  "engagement-farmer": "engagement farmer in season",
  "fake-rich-real-online": "fake rich, real online",
  "anon-degen": "feral anon degen",
  "chart-addict": "chart addict with aura issues",
  "bull-market-philosopher": "bull market philosopher",
  "nft-cope-survivor": "jpeg cope survivor",
  "anon-builder": "anon builder, allergic to attention",
};

// Stable seeded jitter so a single handle's scores never wobble.
function applyJitter(base: ScoreBlock, seed: string): ScoreBlock {
  const r = rng(seed + "::scores");
  const adj = (v: number) => clamp(Math.round(v + (r() * 14 - 7)));
  return {
    aura: adj(base.aura),
    mainCharacter: adj(base.mainCharacter),
    replyGuyRisk: adj(base.replyGuyRisk),
    fakeRich: adj(base.fakeRich),
    scammerAesthetics: adj(base.scammerAesthetics),
    originality: adj(base.originality),
    timelineSurvivability: adj(base.timelineSurvivability),
    forcedFounderAura: adj(base.forcedFounderAura),
    convictionWithoutSize: adj(base.convictionWithoutSize),
    bullMarketFraud: adj(base.bullMarketFraud),
  };
}

const clamp = (n: number) => Math.max(1, Math.min(99, n));

function computeVerdictPercent(scores: ScoreBlock): number {
  // "% cooked" = a weighted blend of the embarrassing scores, capped to 50–98
  // so it always feels like a punchline.
  const cookedness =
    scores.replyGuyRisk * 0.18 +
    scores.fakeRich * 0.16 +
    scores.scammerAesthetics * 0.14 +
    scores.forcedFounderAura * 0.18 +
    scores.convictionWithoutSize * 0.16 +
    scores.bullMarketFraud * 0.18;
  return Math.max(50, Math.min(98, Math.round(cookedness)));
}

// Neutral, stable "reads" of each profile surface. Tone applies later.
function readSignals(p: XProfile, archetype: Archetype): {
  pfp: string; bio: string; banner: string; tweets: string; username: string;
  signals: string[];
} {
  const bioWords = p.bio.split(/\s+/).filter(Boolean).length;
  const avgTweetLen =
    p.recentTweets.reduce((a, t) => a + t.length, 0) /
    Math.max(p.recentTweets.length, 1);
  const ratio = p.following / Math.max(p.followers, 1);
  const exclaim = p.recentTweets.join(" ").match(/!/g)?.length ?? 0;
  const emojiInBio = (p.bio.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const replyish = p.recentTweets.filter((t) =>
    /^(this|underrated|bookmarked|saving|@|literally this)/i.test(t.trim())
  ).length;

  return {
    pfp: archetypePfpRead(archetype),
    bio:
      bioWords <= 4
        ? "bio reads like a man who refuses to elaborate"
        : emojiInBio >= 2
        ? "bio is held together by emojis and conviction"
        : `bio is ${bioWords} words of carefully chosen self-mythology`,
    banner: archetypeBannerRead(archetype),
    tweets:
      replyish >= 2
        ? "timeline is mostly replies to people who have not asked"
        : avgTweetLen < 25
        ? "tweets are short, confident, and almost meaning-free"
        : exclaim >= 3
        ? "tweets contain a concerning amount of forced excitement"
        : "tweets read like a personal brand workshop nobody attended",
    username: archetypeUsernameRead(archetype, p.handle),
    signals: [
      `archetype:${archetype}`,
      `followers:${p.followers}`,
      `following:${p.following}`,
      `following_to_follower_ratio:${ratio.toFixed(3)}`,
      `avg_tweet_len:${avgTweetLen.toFixed(0)}`,
      `reply_density:${replyish}`,
      `exclaim_count:${exclaim}`,
      `emoji_bio:${emojiInBio}`,
    ],
  };
}

function archetypePfpRead(a: Archetype): string {
  switch (a) {
    case "philosopher-king": return "pfp picked by someone who has nothing to prove";
    case "overlord": return "pfp is monogrammed and unbothered";
    case "chaos-engine": return "pfp changes more often than your moods";
    case "founder-cosplay": return "pfp is a navy half-zip in a dimly lit office";
    case "premium-reply-guy": return "pfp is a stock-photo grin in a stock-photo polo";
    case "engagement-farmer": return "pfp engineered for maximum bookmark rate";
    case "fake-rich-real-online": return "pfp shot in a rented car next to someone else's villa";
    case "anon-degen": return "pfp is a frog and that's the most stable thing about you";
    case "chart-addict": return "pfp has a candle in it, which is a choice";
    case "bull-market-philosopher": return "pfp says 'I have one good idea and twelve bad ones'";
    case "nft-cope-survivor": return "pfp is a jpeg you can't sell at any price";
    case "anon-builder": return "pfp is six pixels of pure not-your-business";
  }
}

function archetypeBannerRead(a: Archetype): string {
  switch (a) {
    case "philosopher-king": return "banner is calm, like the timeline you don't have";
    case "overlord": return "banner is a logo. that's the whole banner.";
    case "chaos-engine": return "banner is a meme that's already been retired twice";
    case "founder-cosplay": return "banner is a startup retreat group photo nobody looks at";
    case "premium-reply-guy": return "banner is a sunset behind a quote you didn't write";
    case "engagement-farmer": return "banner is a CTA pretending to be a banner";
    case "fake-rich-real-online": return "banner has a watch in it. of course it does.";
    case "anon-degen": return "banner is a green candle and a threat";
    case "chart-addict": return "banner is a TradingView screenshot from 2021";
    case "bull-market-philosopher": return "banner says 'we're so back' in a serif font";
    case "nft-cope-survivor": return "banner is a collage of bags you'd rather not discuss";
    case "anon-builder": return "banner is a black square. respectfully.";
  }
}

function archetypeUsernameRead(a: Archetype, handle: string): string {
  const hasNumbers = /\d/.test(handle);
  const long = handle.length >= 12;
  if (a === "anon-degen") return "username sounds like a wallet you'd rather not check";
  if (a === "fake-rich-real-online")
    return "username is the kind men whisper before recommending a course";
  if (a === "chart-addict") return "username has a ™ energy you cannot legally claim";
  if (hasNumbers) return "username has numbers in it, which is its own diagnosis";
  if (long) return "username is too long. that's the whole observation.";
  return "username is fine. that's the most polite thing here.";
}

function buildCoreParagraphSeed(p: XProfile, a: Archetype): string {
  switch (a) {
    case "philosopher-king":
      return `${p.handle} posts as if posting itself is beneath them, which is the most expensive form of posting. The bio refuses to elaborate. The timeline is mostly other people's homework. Aura is real. Online presence is incidental. The account exists, the way a mountain exists.`;
    case "overlord":
      return `${p.handle} runs a low-effort timeline because the leverage is elsewhere. Tweets are four words long because four words moves the price. There is no banner because there is no need. This isn't an account, it's a press release that occasionally hits 'post'.`;
    case "chaos-engine":
      return `${p.handle} posts like the algorithm is a slot machine and they own the casino. There is no plan. There is no editor. There is just the next button-press, and a timeline that will be talking about it for 36 hours.`;
    case "founder-cosplay":
      return `${p.handle} is in day-412-of-building, posting threads about distribution while the product is a Notion doc and a Linear board with one ticket. The bio uses the word 'building' the way other people use 'breathing'. The follower count grew. The product did not.`;
    case "premium-reply-guy":
      return `${p.handle} farms a presence one reply at a time. The original-tweet-to-reply ratio is a war crime. The bio mentions a wife and two children, neither of whom appear to follow back. Every quote-tweet is a polite thank-you to a man who did not ask.`;
    case "engagement-farmer":
      return `${p.handle} treats the timeline as a TikTok storefront. Hooks. Lists. Threads that promise life-changing alpha and deliver three obvious sentences and a CTA. The follower count goes up. The originality score does not.`;
    case "fake-rich-real-online":
      return `${p.handle} is a rented Lambo, an unfinished e-book, and one screenshot of a brokerage statement away from a federal indictment. The bio promises to teach men. The DMs promise a course. The course promises to teach more men. It's a pyramid, but spiritually.`;
    case "anon-degen":
      return `${p.handle} is anon, posts in lowercase, and treats every chart as a personal slight. There is no LinkedIn. There is no follow-back. There is just one frog, one wallet, and a deeply unprofitable level of conviction.`;
    case "chart-addict":
      return `${p.handle} draws lines on charts and asks you to subscribe. Every wave is wave 3. Every flag is bullish. The TradingView watermark has weathered three cycles and zero introspection. NFA, but psychologically: yes financial advice.`;
    case "bull-market-philosopher":
      return `${p.handle} only sounds smart in green candles. The takes get longer as PnL gets shorter. Every cycle they discover a new lens — attention, narratives, reflexivity — and use it to explain a position that was already wrong.`;
    case "nft-cope-survivor":
      return `${p.handle} is still here, which is impressive. The collection is 'criminally underrated'. The floor is 'irrelevant'. The bags are heavy. The taste is real. The market disagrees, gently, every single day.`;
    case "anon-builder":
      return `${p.handle} ships and shuts up. The pfp is geometry. The bio is two sentences and a lie about touching grass. The followers are mostly other anons who recognize the pattern: this person is too busy to be online and is online anyway.`;
  }
}

/**
 * Stable, hidden truth of a profile. NEVER shown to user.
 */
export function deriveCoreTruth(profile: XProfile): CoreProfileTruth {
  const archetype = inferArchetype(profile);
  const baseline = ARCHETYPE_BASELINES[archetype];
  const scores = applyJitter(baseline, profile.handle);
  const verdictPercent = computeVerdictPercent(scores);
  const reads = readSignals(profile, archetype);

  return {
    handle: profile.handle,
    archetype,
    finalLabel: FINAL_LABELS[archetype],
    verdictPercent,
    scores,
    signals: reads.signals,
    pfpRead: reads.pfp,
    bioRead: reads.bio,
    bannerRead: reads.banner,
    tweetsRead: reads.tweets,
    usernameRead: reads.username,
    coreParagraphSeed: buildCoreParagraphSeed(profile, archetype),
  };
}
