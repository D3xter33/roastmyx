// src/lib/localAnalyzer.ts
// Server-only. Generates an AnalyzedTruth from a real Playwright-scraped
// XProfile using pure heuristics — no Anthropic API, no LLM calls.
//
// To avoid the "generic horoscope" feeling, the truth is GROUNDED in
// specific evidence pulled from the actual profile:
//   - quoted phrases from the user's real bio
//   - real tweet snippets the account actually posted
//   - measured signals (counts, ratios, averages)
//
// Same handle in -> same truth out, every time. Tone never changes the
// underlying truth; only the wording of the toned variants changes.

import "server-only";
import type {
  AnalyzedTruth,
  Archetype,
  ScoreBlock,
  ToneMode,
  XProfile,
} from "./types";

// ---------- in-process cache (analysis is cheap, but skip the work anyway) ----------

interface CacheEntry {
  truth: AnalyzedTruth;
  profile: XProfile;
  cachedAt: number;
}
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function getCachedTruth(handle: string): CacheEntry | null {
  const k = handle.toLowerCase();
  const e = cache.get(k);
  if (!e || Date.now() - e.cachedAt > TTL_MS) {
    if (e) cache.delete(k);
    return null;
  }
  return e;
}

// ---------- public entry ----------

export async function analyzeProfile(profile: XProfile): Promise<AnalyzedTruth> {
  const cached = getCachedTruth(profile.handle);
  if (cached) return cached.truth;

  const evidence = collectEvidence(profile);
  const archetype = classify(evidence, profile.handle);
  const scores = scoreFromEvidence(archetype, evidence, profile.handle);
  const verdictPercent = computeVerdictPercent(scores);
  const finalLabel = chooseLabel(archetype, evidence);

  const reads = buildReads(profile, evidence, archetype);
  const signals = buildSignals(profile, evidence);

  const toned: AnalyzedTruth["toned"] = {
    funny: tone("funny", profile, evidence, verdictPercent, archetype),
    brutal: tone("brutal", profile, evidence, verdictPercent, archetype),
    "degen-ct": tone("degen-ct", profile, evidence, verdictPercent, archetype),
    "dry-deadpan": tone("dry-deadpan", profile, evidence, verdictPercent, archetype),
    "mock-analyst": tone("mock-analyst", profile, evidence, verdictPercent, archetype),
    unhinged: tone("unhinged", profile, evidence, verdictPercent, archetype),
  };

  const truth: AnalyzedTruth = {
    archetype,
    finalLabel,
    verdictPercent,
    scores,
    pfpRead: reads.pfp,
    bioRead: reads.bio,
    bannerRead: reads.banner,
    tweetsRead: reads.tweets,
    usernameRead: reads.username,
    signals,
    toned,
  };

  cache.set(profile.handle.toLowerCase(), {
    truth,
    profile,
    cachedAt: Date.now(),
  });
  return truth;
}

// ---------- evidence: actual measurements over the real profile ----------

interface Evidence {
  bioWords: number;
  bioEmojis: number;
  bioHasLinks: boolean;
  bioPhrases: {
    building: boolean;
    founder: boolean;
    ceo: boolean;
    ex: boolean; // "ex-banking", "ex-google" etc
    dms: boolean;
    nfa: boolean;
    teach: boolean;
    mindset: boolean;
    figures: boolean;
    anon: boolean;
    onchain: boolean;
    chart: boolean;
    nft: boolean;
    art: boolean;
  };
  bioMatches: { phrase: string; matched: string }[]; // [{ phrase: 'building', matched: 'building' }]
  followersToFollowing: number; // > 1 = healthy, < 1 = reply-guy territory
  followingToFollowers: number;
  tweetsCount: number;
  avgTweetLen: number;
  shortTweetShare: number; // % of tweets under 30 chars
  exclaimRate: number;
  ctSlangHits: number; // ngmi, ser, anon, gm, wagmi, ngl, bullish, cope, ape, fade
  replyGuyPhraseHits: number; // "this.", "underrated take", "bookmarked", "saving this"
  founderPhraseHits: number; // "building", "shipping", "day N of", "we're cooking"
  chartPhraseHits: number; // "wave 3", "bull flag", "NFA", "target", "candle"
  fakeRichPhraseHits: number; // "matrix", "alpha", "kings", "mindset", "blueprint"
  uppercasePostingShare: number;
  // Real quotes we can splice into the roast for groundedness.
  notableQuotes: string[];
  longestTweet: string;
  shortestTweet: string;
  firstWord: string; // first word of the most recent tweet
  // Username traits
  hasNumbers: boolean;
  longUsername: boolean;
  underscoreUsername: boolean;
}

function collectEvidence(p: XProfile): Evidence {
  const bio = p.bio || "";
  const tweets = p.recentTweets ?? [];
  const tweetText = tweets.join(" \n ");

  const bioLower = bio.toLowerCase();
  const tweetLower = tweetText.toLowerCase();

  const bioWords = bio.split(/\s+/).filter(Boolean).length;
  const bioEmojis = (bio.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const bioHasLinks = /https?:\/\//i.test(bio);

  // BIO-ONLY signals are stronger than TWEET signals because tweets often
  // QUOTE / CRITICIZE the same vocabulary in the opposite direction (e.g.
  // "nobody good at money needs to sell you a course" — pro-naval, not pro-course).
  // We classify on bio-anchored signals and use tweets only as corroboration.
  const phrases = {
    // "building" in bio is a founder-cosplay signal; in tweets it's noisy.
    building: /\bbuild(ing|er|ers)?\b|\bshipping\b|\bday \d+ of\b/.test(bioLower),
    founder: /\b(co-?)?founder\b|\b(ceo|cto|coo)\b/.test(bioLower),
    ceo: /\b(ceo|cto|coo)\b/.test(bioLower),
    ex: /\bex-?\w+/.test(bioLower),
    dms: /\bdms?\s+(open|→|->)|dm\s+(me|for)\b/i.test(bioLower),
    nfa: /\bnfa\b|not\s+financial\s+advice/.test(tweetLower),
    // Bio-only, AND requires the actual grift framing (selling, joining,
    // promoting). Naval's tweet "needs to sell you a course" wouldn't trigger
    // this because the bio doesn't.
    teach: /\b(buy\s+my|join\s+my|my\s+(course|blueprint|masterclass)|teach\s+(men|you)|\d+\s*figure|wealth\s+coach|escape\s+the\s+matrix|7\s*-?\s*figure)\b/i.test(bioLower),
    mindset: /\bmindset\b/.test(bioLower),
    figures: /\b\d+\s*figure(s|d)?\b/.test(bioLower),
    anon: /\banon\b|⌐◨-◨/.test(bioLower) || /^(anon|0x)/i.test(p.handle),
    onchain: /\bonchain\b|\bweb3\b/.test(bioLower),
    chart: /\b(TA|chartist|trader|elliott)\b/.test(bioLower) || /\bwave\s*\d|\bbull\s*flag/.test(tweetLower),
    nft: /\b(nft|jpeg|floor|mint(ed|ing)?)\b/.test(bioLower) || /\.eth$/.test(p.displayName.toLowerCase()),
    art: /\b(digital\s+art|collector|gallery)\b/.test(bioLower),
  };

  const ctSlang = /\b(ngmi|ngl|ser|anon|gm|gn|wagmi|bullish|bearish|cope|ape|aped|fade|fading|sirs|kek|chad|pepe)\b/g;
  const ctSlangHits = (tweetLower.match(ctSlang) ?? []).length;

  const replyGuyRx = /\b(this\.\s|^this$|underrated\s+take|bookmarked|saving\s+this|literally\s+this|so\s+true|100%)/g;
  const replyGuyPhraseHits = countMatches(tweets, replyGuyRx);

  const founderRx = /\b(building|shipping|cooking|day\s+\d+|distribution|attention|narrative)\b/gi;
  const founderPhraseHits = countMatches(tweets, founderRx);

  const chartRx = /\b(wave\s*\d|bull\s+flag|target\s*\$|nfa|TA\b|RSI|MACD|fib|fibonacci)\b/gi;
  const chartPhraseHits = countMatches(tweets, chartRx);

  const fakeRichRx = /\b(matrix|alpha|kings?|mindset|blueprint|escape|empire|conquer|grind)\b/gi;
  const fakeRichPhraseHits = countMatches(tweets, fakeRichRx);

  const totalLen = tweets.reduce((a, t) => a + t.length, 0);
  const avgTweetLen = tweets.length ? totalLen / tweets.length : 0;
  const shortTweetShare = tweets.length
    ? tweets.filter((t) => t.length < 30).length / tweets.length
    : 0;
  const exclaimRate = tweets.length
    ? tweets.reduce((a, t) => a + (t.match(/!/g)?.length ?? 0), 0) / tweets.length
    : 0;
  const uppercasePostingShare = tweets.length
    ? tweets.filter(
        (t) => t.length >= 10 && t.replace(/[^A-Za-z]/g, "") === t.replace(/[^A-Za-z]/g, "").toUpperCase()
      ).length / tweets.length
    : 0;

  const followersToFollowing =
    p.following > 0 ? p.followers / p.following : Infinity;
  const followingToFollowers = p.followers > 0 ? p.following / p.followers : 0;

  // Pick 1-3 notable quotes — the most "characteristic" tweets to splice.
  const notableQuotes = pickNotableQuotes(tweets);

  const sortedByLen = [...tweets].sort((a, b) => b.length - a.length);
  const longestTweet = sortedByLen[0] ?? "";
  const shortestTweet = sortedByLen[sortedByLen.length - 1] ?? "";
  const firstWord = (tweets[0] ?? "").split(/\s+/)[0] ?? "";

  // Bio matches — collect actual matched words for quoting.
  const bioMatches: { phrase: string; matched: string }[] = [];
  for (const [name, re] of Object.entries({
    building: /\bbuild(ing|er|ers)?\b/i,
    founder: /\b(?:co-?)?founder\b/i,
    "ex-": /\bex-(\w+)/i,
    dms: /\bdm(s)?\b/i,
    teach: /\b(teach|course|blueprint)\b/i,
    mindset: /\bmindset\b/i,
    onchain: /\bonchain\b/i,
    anon: /\banon\b/i,
    nft: /\b(nft|jpeg|floor)\b/i,
  })) {
    const m = bio.match(re);
    if (m) bioMatches.push({ phrase: name, matched: m[0] });
  }

  return {
    bioWords,
    bioEmojis,
    bioHasLinks,
    bioPhrases: phrases,
    bioMatches,
    followersToFollowing,
    followingToFollowers,
    tweetsCount: tweets.length,
    avgTweetLen,
    shortTweetShare,
    exclaimRate,
    ctSlangHits,
    replyGuyPhraseHits,
    founderPhraseHits,
    chartPhraseHits,
    fakeRichPhraseHits,
    uppercasePostingShare,
    notableQuotes,
    longestTweet,
    shortestTweet,
    firstWord,
    hasNumbers: /\d/.test(p.handle),
    longUsername: p.handle.length >= 12,
    underscoreUsername: /_/.test(p.handle),
  };
}

function countMatches(items: string[], rx: RegExp): number {
  let total = 0;
  for (const t of items) total += (t.match(rx) ?? []).length;
  return total;
}

function pickNotableQuotes(tweets: string[]): string[] {
  // Heuristic: tweets that are short + confident, OR contain trademark phrases.
  const scored = tweets.map((t) => {
    let s = 0;
    if (t.length < 60) s += 2;
    if (/\bbullish|building|day \d+ of|ngmi|wave \d|matrix|target/i.test(t)) s += 3;
    if (/^(this|underrated|bookmarked|literally)/i.test(t)) s += 4;
    if (/!/.test(t)) s += 1;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 3).map((x) => x.t);
}

// ---------- archetype classification ----------

// FNV-1a — small, fast, deterministic. Used for hash-based tie-breaks so two
// accounts with similar evidence still get distinct flavors instead of
// everyone defaulting to "bull-market-philosopher".
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

/**
 * Score every archetype on the available evidence and return the strongest.
 * No more "first match wins". Each archetype accumulates points from real
 * signals; the highest score wins. On a near-tie, a deterministic hash of
 * the handle picks between candidates so similar profiles still vary.
 */
function classify(e: Evidence, handle: string): Archetype {
  const scores: Record<Archetype, number> = {
    "philosopher-king": 0,
    "overlord": 0,
    "chaos-engine": 0,
    "founder-cosplay": 0,
    "premium-reply-guy": 0,
    "engagement-farmer": 0,
    "fake-rich-real-online": 0,
    "anon-degen": 0,
    "chart-addict": 0,
    "bull-market-philosopher": 0,
    "nft-cope-survivor": 0,
    "anon-builder": 0,
  };

  // ---------- broadcaster signals (high followers, low following) ----------
  // Broadcaster status is a HINT, not a verdict. A small bias toward
  // philosopher / overlord that real evidence in other archetypes can override.
  if (e.followersToFollowing >= 500 && e.tweetsCount >= 3) {
    scores["philosopher-king"] += 1;
    scores["overlord"] += 1;
    if (e.shortTweetShare >= 0.5 && e.tweetsCount >= 4) scores["overlord"] += 2;
    if (e.avgTweetLen >= 120 && e.bioWords <= 6) scores["philosopher-king"] += 2;
  }

  // ---------- fake-rich grift signals ----------
  if (e.bioPhrases.teach) scores["fake-rich-real-online"] += 5;
  if (e.bioPhrases.figures) scores["fake-rich-real-online"] += 4;
  if (e.bioPhrases.mindset) scores["fake-rich-real-online"] += 2;
  if (e.bioPhrases.dms) scores["fake-rich-real-online"] += 2;
  if (e.fakeRichPhraseHits >= 2) scores["fake-rich-real-online"] += 2;
  if (e.fakeRichPhraseHits >= 4) scores["fake-rich-real-online"] += 2;

  // ---------- founder cosplay ----------
  if (e.bioPhrases.founder) scores["founder-cosplay"] += 4;
  if (e.bioPhrases.ceo) scores["founder-cosplay"] += 3;
  if (e.bioPhrases.building) scores["founder-cosplay"] += 3;
  if (e.bioPhrases.ex) scores["founder-cosplay"] += 1;
  if (e.founderPhraseHits >= 2) scores["founder-cosplay"] += 2;
  if (e.founderPhraseHits >= 4) scores["founder-cosplay"] += 2;
  if (e.bioPhrases.onchain) scores["founder-cosplay"] += 1;

  // ---------- chart addict ----------
  if (e.bioPhrases.chart) scores["chart-addict"] += 5;
  if (e.chartPhraseHits >= 1) scores["chart-addict"] += 2;
  if (e.chartPhraseHits >= 3) scores["chart-addict"] += 3;

  // ---------- NFT survivor ----------
  if (e.bioPhrases.nft) scores["nft-cope-survivor"] += 4;
  if (e.bioPhrases.art) scores["nft-cope-survivor"] += 3;

  // ---------- reply guy ----------
  if (e.replyGuyPhraseHits >= 2) scores["premium-reply-guy"] += 3;
  if (e.replyGuyPhraseHits >= 4) scores["premium-reply-guy"] += 2;
  if (e.followingToFollowers >= 1.5) scores["premium-reply-guy"] += 3;
  if (e.followingToFollowers >= 3) scores["premium-reply-guy"] += 2;

  // ---------- anon ----------
  if (e.bioPhrases.anon) {
    scores["anon-degen"] += 3;
    scores["anon-builder"] += 2;
  }
  if (e.ctSlangHits >= 2) scores["anon-degen"] += 2;
  if (e.ctSlangHits >= 5) scores["anon-degen"] += 2;

  // Quiet builder vibe: short bio, no founder posturing, decent followers
  if (e.bioWords <= 4 && e.bioWords > 0 && !e.bioPhrases.founder && !e.bioPhrases.teach) {
    scores["anon-builder"] += 2;
    scores["philosopher-king"] += 1;
  }

  // ---------- chaos / overlord ----------
  if (e.shortTweetShare >= 0.6 && e.tweetsCount >= 3) {
    scores["overlord"] += 2;
    scores["chaos-engine"] += 1;
  }
  if (e.exclaimRate >= 1) scores["chaos-engine"] += 3;
  if (e.uppercasePostingShare >= 0.2) scores["chaos-engine"] += 4;
  if (e.uppercasePostingShare >= 0.4) scores["chaos-engine"] += 3;

  // ---------- engagement farmer ----------
  // Threads, hooks, lots of exclaim, mid-following ratio
  if (e.exclaimRate >= 0.5 && e.exclaimRate < 1) scores["engagement-farmer"] += 2;
  if (e.tweetsCount >= 5 && e.avgTweetLen >= 100 && e.exclaimRate >= 0.3)
    scores["engagement-farmer"] += 2;

  // ---------- philosopher king ----------
  if (e.bioWords <= 6 && e.tweetsCount >= 3 && e.avgTweetLen >= 60)
    scores["philosopher-king"] += 3;
  if (e.followingToFollowers <= 0.1 && e.tweetsCount >= 3)
    scores["philosopher-king"] += 2;

  // ---------- bull-market philosopher ----------
  // Generic mid-cycle thread-bro signals: medium-length tweets, no clear
  // founder/grift bio, some CT vocab.
  if (e.avgTweetLen >= 80 && e.avgTweetLen < 200 && e.ctSlangHits >= 1)
    scores["bull-market-philosopher"] += 2;
  if (e.bioPhrases.onchain && !e.bioPhrases.founder)
    scores["bull-market-philosopher"] += 1;

  // ---------- variety fallback ----------
  // When NO archetype has accumulated strong evidence (best score below the
  // confidence threshold), pick from a varied pool seeded by the handle hash.
  // This prevents everyone defaulting to the same archetype just because the
  // signal is thin. Stable per-handle (same hash => same pick) but distinct
  // across handles.
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore < 5) {
    const variedPool: Archetype[] = [
      "bull-market-philosopher",
      "engagement-farmer",
      "anon-degen",
      "chaos-engine",
      "nft-cope-survivor",
      "anon-builder",
      "premium-reply-guy",
      "founder-cosplay",
      "fake-rich-real-online",
      "chart-addict",
      "philosopher-king",
      "overlord",
    ];
    const pick = variedPool[fnv1a(handle) % variedPool.length]!;
    scores[pick] += 7; // dominates the broadcaster bias
  }

  // Hash-based jitter on every archetype so near-ties resolve to different
  // archetypes for different handles. ±0.4 points — enough to break ties,
  // not enough to override real evidence.
  const archetypes = Object.keys(scores) as Archetype[];
  for (let i = 0; i < archetypes.length; i++) {
    const a = archetypes[i]!;
    const jitter = (fnv1a(handle + ":" + a) % 1000) / 1000 * 0.8 - 0.4;
    scores[a] += jitter;
  }

  // Pick the winner.
  let best: Archetype = "bull-market-philosopher";
  let bestScore = -Infinity;
  for (const a of archetypes) {
    if (scores[a] > bestScore) {
      bestScore = scores[a];
      best = a;
    }
  }
  return best;
}

// ---------- scoring ----------

const ARCHETYPE_BASELINES: Record<Archetype, ScoreBlock> = {
  "philosopher-king":   { aura: 92, mainCharacter: 78, replyGuyRisk: 8,  fakeRich: 4,  scammerAesthetics: 3,  originality: 95, timelineSurvivability: 90, forcedFounderAura: 12, convictionWithoutSize: 30, bullMarketFraud: 5  },
  "overlord":           { aura: 88, mainCharacter: 96, replyGuyRisk: 4,  fakeRich: 20, scammerAesthetics: 18, originality: 60, timelineSurvivability: 95, forcedFounderAura: 30, convictionWithoutSize: 10, bullMarketFraud: 22 },
  "chaos-engine":       { aura: 80, mainCharacter: 99, replyGuyRisk: 30, fakeRich: 70, scammerAesthetics: 35, originality: 70, timelineSurvivability: 88, forcedFounderAura: 55, convictionWithoutSize: 40, bullMarketFraud: 50 },
  "founder-cosplay":    { aura: 38, mainCharacter: 72, replyGuyRisk: 35, fakeRich: 65, scammerAesthetics: 40, originality: 22, timelineSurvivability: 30, forcedFounderAura: 92, convictionWithoutSize: 78, bullMarketFraud: 70 },
  "premium-reply-guy":  { aura: 18, mainCharacter: 12, replyGuyRisk: 96, fakeRich: 22, scammerAesthetics: 14, originality: 8,  timelineSurvivability: 24, forcedFounderAura: 30, convictionWithoutSize: 60, bullMarketFraud: 18 },
  "engagement-farmer":  { aura: 28, mainCharacter: 50, replyGuyRisk: 70, fakeRich: 40, scammerAesthetics: 38, originality: 14, timelineSurvivability: 45, forcedFounderAura: 40, convictionWithoutSize: 55, bullMarketFraud: 50 },
  "fake-rich-real-online": { aura: 22, mainCharacter: 80, replyGuyRisk: 18, fakeRich: 95, scammerAesthetics: 88, originality: 14, timelineSurvivability: 38, forcedFounderAura: 70, convictionWithoutSize: 90, bullMarketFraud: 92 },
  "anon-degen":         { aura: 64, mainCharacter: 45, replyGuyRisk: 28, fakeRich: 45, scammerAesthetics: 42, originality: 70, timelineSurvivability: 70, forcedFounderAura: 18, convictionWithoutSize: 80, bullMarketFraud: 55 },
  "chart-addict":       { aura: 40, mainCharacter: 60, replyGuyRisk: 22, fakeRich: 55, scammerAesthetics: 70, originality: 18, timelineSurvivability: 50, forcedFounderAura: 25, convictionWithoutSize: 88, bullMarketFraud: 78 },
  "bull-market-philosopher": { aura: 50, mainCharacter: 60, replyGuyRisk: 35, fakeRich: 58, scammerAesthetics: 30, originality: 30, timelineSurvivability: 40, forcedFounderAura: 60, convictionWithoutSize: 70, bullMarketFraud: 75 },
  "nft-cope-survivor":  { aura: 55, mainCharacter: 38, replyGuyRisk: 30, fakeRich: 40, scammerAesthetics: 35, originality: 50, timelineSurvivability: 60, forcedFounderAura: 25, convictionWithoutSize: 70, bullMarketFraud: 55 },
  "anon-builder":       { aura: 78, mainCharacter: 30, replyGuyRisk: 10, fakeRich: 8,  scammerAesthetics: 6,  originality: 80, timelineSurvivability: 80, forcedFounderAura: 20, convictionWithoutSize: 25, bullMarketFraud: 8  },
};

function scoreFromEvidence(
  arch: Archetype,
  e: Evidence,
  handle: string
): ScoreBlock {
  const base = ARCHETYPE_BASELINES[arch];

  // Real-evidence nudges — bump each category based on ACTUAL signals.
  const replyNudge = clamp(e.replyGuyPhraseHits * 6 + (e.followingToFollowers >= 1.5 ? 10 : 0), 0, 30);
  const founderNudge = clamp(e.founderPhraseHits * 4 + (e.bioPhrases.building ? 8 : 0), 0, 25);
  const fakeRichNudge = clamp(e.fakeRichPhraseHits * 5 + (e.bioPhrases.teach ? 12 : 0), 0, 25);
  const chartNudge = clamp(e.chartPhraseHits * 6, 0, 25);
  const auraDrain = clamp(replyNudge + fakeRichNudge - 5, 0, 25);
  const originalityDrain = clamp(replyNudge + founderNudge - 5, 0, 30);

  // Per-handle deterministic jitter — same handle => same scores forever,
  // different handles => different scores within the same archetype. Range
  // ±7 per category, which means verdict% naturally spans ~12 points across
  // accounts of the same archetype instead of everyone landing on one number.
  const j = (cat: string) => {
    const h = fnv1a(handle + "::" + cat);
    return ((h % 14000) / 1000) - 7; // -7..+7
  };

  return {
    aura: clamp99(base.aura - auraDrain + j("aura")),
    mainCharacter: clamp99(base.mainCharacter + j("mc")),
    replyGuyRisk: clamp99(base.replyGuyRisk + replyNudge + j("rg")),
    fakeRich: clamp99(base.fakeRich + fakeRichNudge + j("fr")),
    scammerAesthetics: clamp99(base.scammerAesthetics + fakeRichNudge - 5 + j("sa")),
    originality: clamp99(base.originality - originalityDrain + j("or")),
    timelineSurvivability: clamp99(base.timelineSurvivability + j("ts")),
    forcedFounderAura: clamp99(base.forcedFounderAura + founderNudge + j("ff")),
    convictionWithoutSize: clamp99(base.convictionWithoutSize + clamp(chartNudge / 2, 0, 10) + j("cs")),
    bullMarketFraud: clamp99(base.bullMarketFraud + chartNudge / 2 + fakeRichNudge / 2 + j("bm")),
  };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const clamp99 = (n: number) => clamp(n, 1, 99);

function computeVerdictPercent(s: ScoreBlock): number {
  // Embarrassment = weighted sum of the categories that make you look bad.
  // For a true philosopher-king (all low) embarrassment ~10. For fake-rich
  // (all max) embarrassment ~95. Map this onto the 50-97 "% cooked" range:
  //   embarrassment 0   -> 50% (everyone's at least a little cooked)
  //   embarrassment 50  -> 75%
  //   embarrassment 100 -> 97%
  // i.e. percent = 50 + embarrassment * 0.47
  const embarrassment =
    s.replyGuyRisk * 0.18 +
    s.fakeRich * 0.18 +
    s.scammerAesthetics * 0.12 +
    s.forcedFounderAura * 0.18 +
    s.convictionWithoutSize * 0.14 +
    s.bullMarketFraud * 0.20;

  const pct = 50 + embarrassment * 0.47;
  return Math.max(50, Math.min(97, Math.round(pct)));
}

// ---------- labels grounded in evidence ----------

function chooseLabel(a: Archetype, e: Evidence): string {
  // Prefer a label that quotes a real bio phrase when we have one.
  if (e.bioPhrases.teach) return "DMs-open self-help merchant";
  if (e.bioPhrases.figures) return "fake rich, real online";
  if (e.bioPhrases.founder && e.founderPhraseHits >= 2) return "founder cosplay account";
  if (e.bioPhrases.anon && e.ctSlangHits >= 3) return "feral anon degen";

  switch (a) {
    case "philosopher-king":   return "philosopher king (real)";
    case "overlord":           return "low-effort exchange overlord";
    case "chaos-engine":       return "full-time chaos engine";
    case "founder-cosplay":    return "founder cosplay account";
    case "premium-reply-guy":  return "premium reply guy";
    case "engagement-farmer":  return "engagement farmer in season";
    case "fake-rich-real-online": return "fake rich, real online";
    case "anon-degen":         return "feral anon degen";
    case "chart-addict":       return "chart addict with aura issues";
    case "bull-market-philosopher": return "bull market philosopher";
    case "nft-cope-survivor":  return "jpeg cope survivor";
    case "anon-builder":       return "anon builder, allergic to attention";
  }
}

// ---------- evidence-grounded reads ----------
//
// Every read is a hash-stable PICK from a pool. Same handle => same pick;
// different handles with the same archetype => different pick. Pools are
// chosen by the strongest matching signal type, then narrowed by archetype.

/** Stable per-handle pick from a non-empty pool. */
function pick<T>(handle: string, key: string, pool: readonly T[]): T {
  if (pool.length === 0) throw new Error("empty pool");
  return pool[fnv1a(handle + "::" + key) % pool.length]!;
}

function buildReads(p: XProfile, e: Evidence, a: Archetype) {
  return {
    pfp: pfpRead(p, e, a),
    bio: bioRead(p, e, a),
    banner: bannerRead(p, e, a),
    tweets: tweetsRead(p, e, a),
    username: usernameRead(p, e, a),
  };
}

// =================== PFP READS ===================
// We don't have vision, so reads anchor on archetype + URL traits + handle hash.

const PFP_POOLS: Record<Archetype, readonly string[]> = {
  "philosopher-king": [
    "pfp is unremarkable on purpose, which is a flex",
    "pfp is calm. nothing about it is trying.",
    "pfp is the visual equivalent of a black turtleneck",
    "pfp doesn't pose. that's the pose.",
  ],
  "overlord": [
    "pfp is monogrammed and unbothered",
    "pfp is a logo where the face used to be",
    "pfp is the headshot of someone whose lawyer has notes",
    "pfp is corporate-headshot energy at empire scale",
  ],
  "chaos-engine": [
    "pfp changes more often than your moods",
    "pfp is whatever amused you at 2am last week",
    "pfp commits crimes against personal branding",
    "pfp is a meme that's already been retired twice",
  ],
  "founder-cosplay": [
    "pfp is a navy half-zip in a dimly lit office",
    "pfp is the headshot of a man who has practiced his headshot",
    "pfp says 'taken at a YC retreat I'd rather you ask about'",
    "pfp is LinkedIn-but-make-it-X energy",
    "pfp commits to the founder uniform. shoulders square. eyes serious.",
  ],
  "premium-reply-guy": [
    "pfp is grin-energy in a polo",
    "pfp is a stock-photo smile that came with the phone",
    "pfp says 'father, husband, opinions-my-own'",
    "pfp is a man who owns one shirt and chose it for this",
  ],
  "engagement-farmer": [
    "pfp engineered for maximum bookmark rate",
    "pfp is a thumbnail. it knows it's a thumbnail.",
    "pfp is yelling at you in JPEG form",
    "pfp tested in three variants before this won",
  ],
  "fake-rich-real-online": [
    "pfp is the kind of shot that took 40 takes",
    "pfp is shot in a rented car next to someone else's villa",
    "pfp is a watch with a face attached",
    "pfp is the cover of an e-book nobody finished",
    "pfp serves 'masterclass thumbnail' energy",
  ],
  "anon-degen": [
    "pfp is a frog and that's the most stable thing about you",
    "pfp is anon iconography — visual conviction without identity",
    "pfp is a cartoon you would not legally license",
    "pfp says 'I am a wallet, please respect me'",
    "pfp is a meme that briefly mattered in 2021",
  ],
  "chart-addict": [
    "pfp has a candle in it, which is a choice",
    "pfp commits a brand crime against TradingView",
    "pfp is a man pointing at a line he drew",
    "pfp is the kind that ends in ™ on the timeline",
  ],
  "bull-market-philosopher": [
    "pfp says 'I have one good idea and twelve bad ones'",
    "pfp is professional-but-not-too-professional, calibrated",
    "pfp is a thread-bro headshot at full saturation",
    "pfp earned its caption-friendly framing the hard way",
  ],
  "nft-cope-survivor": [
    "pfp is a jpeg you can't sell at any price",
    "pfp is a 10k-collection survivor with the receipts",
    "pfp is laser-eyed in a market that no longer cares",
    "pfp is somebody's character, possibly yours, definitely paid for",
  ],
  "anon-builder": [
    "pfp is geometry. respectfully.",
    "pfp is six pixels of pure not-your-business",
    "pfp is a glyph. a logo. a vibe. not a face.",
    "pfp is a square with a gradient and a dare",
  ],
};

function pfpRead(p: XProfile, e: Evidence, a: Archetype): string {
  if (!p.pfpUrl || /default_profile/.test(p.pfpUrl)) {
    return pick(p.handle, "pfp:default", [
      "pfp is the default egg, which is its own kind of statement",
      "no pfp uploaded. impressive level of indifference.",
      "default pfp. you are committed to the bit.",
    ]);
  }
  // Some accounts use the .gif extension for animated avatars — note it.
  if (/\.gif($|\?)/i.test(p.pfpUrl)) {
    return pick(p.handle, "pfp:gif", [
      "pfp is animated, which is the most 2014 thing you've done this week",
      "pfp moves. it shouldn't. but it does.",
      "yes, your pfp is a gif. we noticed. so does everyone else.",
    ]);
  }
  return pick(p.handle, "pfp:" + a, PFP_POOLS[a]);
}

// =================== BIO READS ===================
// Bio is the strongest self-presentation signal — quote it directly when
// we can. Pools are picked by bio shape (empty / one-word / link-only /
// emoji-heavy / vocab-matched / generic) before falling back to archetype.

function bioRead(p: XProfile, e: Evidence, a: Archetype): string {
  const bio = p.bio || "";

  // ---- empty bio ----
  if (!bio) {
    return pick(p.handle, "bio:empty", [
      "bio is empty, which is in fact a position",
      "no bio. you have decided to remain mysterious to nobody.",
      "bio is blank. respect the commitment.",
      "bio missing — either anon or just allergic to introducing yourself",
      "no bio. the timeline is the bio.",
    ]);
  }

  // ---- single word bio ----
  if (e.bioWords === 1) {
    return pick(p.handle, "bio:one-word", [
      `bio is one word: "${bio}". that's the whole pitch.`,
      `bio: "${bio}". economical. mostly.`,
      `bio is literally just "${bio}". confidence noted.`,
      `bio reads "${bio}" and refuses to elaborate. iconic.`,
    ]);
  }

  // ---- founder vocab in bio (highest priority — most damning) ----
  if (e.bioPhrases.founder || e.bioPhrases.ceo) {
    const titleMatch = bio.match(/\b(co-?founder|founder|ceo|cto|coo|building)\b/i);
    const word = titleMatch?.[0] ?? "founder";
    return pick(p.handle, "bio:founder", [
      `bio leads with "${word}", as expected`,
      `bio drops "${word}" within the first sentence — load-bearing self-mythology`,
      `bio uses "${word}" and would like you to notice`,
      `bio claims "${word}" the way other people claim hobbies`,
      `bio puts "${word}" front and center, in case you missed it`,
    ]);
  }

  // ---- grift vocab in bio ----
  if (e.bioPhrases.teach || e.bioPhrases.figures || e.bioPhrases.mindset) {
    const giftMatch = bio.match(
      /\b(teach|course|blueprint|masterclass|matrix|mindset|\d+-?figure)\b/i
    );
    const word = giftMatch?.[0] ?? "alpha";
    return pick(p.handle, "bio:grift", [
      `bio promises to teach you with the word "${word}". DMs presumably open.`,
      `bio drops "${word}" — a word with a price tag attached`,
      `bio says "${word}". the course is loading as we speak.`,
      `bio centered on "${word}", which is its own sales funnel`,
    ]);
  }

  // ---- "ex-bank/google/etc" prefix ----
  if (e.bioPhrases.ex) {
    const exMatch = bio.match(/\bex-?\w+/i);
    return pick(p.handle, "bio:ex", [
      `bio leads with "${exMatch?.[0] ?? "ex-something"}", because that's still the headline apparently`,
      `bio's most recent identity is the previous one — "${exMatch?.[0]}"`,
      `bio uses "${exMatch?.[0]}" as the load-bearing prestige token`,
      `bio sells you the past more confidently than the present`,
    ]);
  }

  // ---- DMs open / sales-funnel bio ----
  if (e.bioPhrases.dms) {
    return pick(p.handle, "bio:dms", [
      "bio invites DMs, which is its own diagnosis",
      "bio says 'DMs open'. so does the typical pitch deck.",
      "bio routes to your DMs — the universal grift TLDR",
      "bio mentions DMs. nothing good has ever started with that phrase.",
    ]);
  }

  // ---- emoji-heavy bio ----
  if (e.bioEmojis >= 3) {
    return pick(p.handle, "bio:emoji", [
      `bio is held together by ${e.bioEmojis} emojis and conviction`,
      `bio uses ${e.bioEmojis} emojis to do what one verb could`,
      `bio is ${e.bioEmojis} emoji deep — a hieroglyphic plea for relevance`,
      `bio: ${e.bioEmojis} emojis. that's not a personality. that's punctuation.`,
    ]);
  }

  if (e.bioEmojis >= 1) {
    return pick(p.handle, "bio:emoji-light", [
      `bio uses ${e.bioEmojis} emoji where words would have been fine`,
      `bio reaches for emoji to land what the words couldn't`,
      `bio carries an emoji or two for emphasis nobody asked for`,
    ]);
  }

  // ---- short bio (2-4 words) ----
  if (e.bioWords <= 4) {
    return pick(p.handle, "bio:short", [
      `bio is ${e.bioWords} words. that's the whole pitch.`,
      `bio runs ${e.bioWords} words — minimalism or laziness, hard to say`,
      `bio is ${e.bioWords} words long, which is a lot for someone with nothing to say`,
      `bio: ${e.bioWords} words. the rest is silence and conviction.`,
      `bio refuses to elaborate beyond ${e.bioWords} words`,
    ]);
  }

  // ---- bio with link ----
  if (e.bioHasLinks) {
    return pick(p.handle, "bio:link", [
      "bio links to something the bio hopes you'll click",
      "bio is mostly a link. the link is mostly a funnel.",
      "bio routes to a URL. the URL routes to your wallet.",
      "bio's most committed sentence is the URL",
    ]);
  }

  // ---- onchain / web3 framing ----
  if (e.bioPhrases.onchain) {
    return pick(p.handle, "bio:onchain", [
      `bio uses "onchain" as a personality trait`,
      `bio leads with "onchain", which is the new "tech-savvy"`,
      `bio identifies as onchain. that's a place now, apparently.`,
    ]);
  }

  // ---- anon framing ----
  if (e.bioPhrases.anon) {
    return pick(p.handle, "bio:anon", [
      `bio is "anon" with extra steps`,
      `bio commits to anonymity, then writes a paragraph about it`,
      `bio uses "anon" the way other people use job titles`,
      `bio says anon. the timeline says otherwise.`,
    ]);
  }

  // ---- chart / trader bio ----
  if (e.bioPhrases.chart) {
    return pick(p.handle, "bio:chart", [
      `bio identifies as a trader. the chart says otherwise.`,
      `bio claims TA expertise. NFA — not flattering anyway.`,
      `bio reads like a TradingView screen with a personality glued on`,
    ]);
  }

  // ---- nft bio ----
  if (e.bioPhrases.nft || e.bioPhrases.art) {
    return pick(p.handle, "bio:nft", [
      `bio mentions jpegs / collections / floor — the four food groups`,
      `bio is "digital art collector" energy. the floor disagrees.`,
      `bio leads with art. the timeline leads with cope.`,
      `bio talks about taste. the market talks about volume.`,
    ]);
  }

  // ---- generic medium-bio fallback ----
  // Multi-pool by length so we don't repeat the same line.
  if (e.bioWords <= 10) {
    return pick(p.handle, "bio:med-short", [
      `bio is ${e.bioWords} words of carefully chosen self-mythology`,
      `bio fits in ${e.bioWords} words and still finds room for a flex`,
      `bio reads tight at ${e.bioWords} words — every one of them load-bearing`,
      `bio is curated to the syllable, ${e.bioWords} words deep`,
    ]);
  }

  return pick(p.handle, "bio:long", [
    `bio runs ${e.bioWords} words — a CV nobody asked for`,
    `bio is ${e.bioWords} words of "let me explain my whole deal"`,
    `bio sprawls ${e.bioWords} words. a bio that long is a bio that's worried.`,
    `bio is ${e.bioWords} words of layered identity claims`,
    `bio at ${e.bioWords} words has too many descriptors for one person`,
  ]);
}

// =================== BANNER READS ===================

const BANNER_POOLS: Record<Archetype, readonly string[]> = {
  "philosopher-king": [
    "banner is calm, like the timeline you don't have",
    "banner is a soft gradient. a man at peace.",
    "banner is restraint at high resolution",
    "banner is the visual equivalent of saying nothing",
  ],
  "overlord": [
    "banner is a logo. that's the whole banner.",
    "banner is a corporate flat-color statement",
    "banner is the bare minimum, paid in full",
    "banner has the energy of an annual report cover",
  ],
  "chaos-engine": [
    "banner is a meme that's already been retired twice",
    "banner is whatever amused you on a Tuesday",
    "banner is loud in three places at once",
    "banner has typography crimes layered on photographic ones",
  ],
  "founder-cosplay": [
    "banner is a startup retreat photo nobody has looked at since",
    "banner is whiteboard-and-laptop staged sincerity",
    "banner is the team-photo nobody from that team is still around for",
    "banner is 'we raised a round' energy from two rounds ago",
    "banner is the lobby of a coworking space, captioned",
  ],
  "premium-reply-guy": [
    "banner is a sunset behind a quote you didn't write",
    "banner is a stock photo with a David Goggins caption",
    "banner is mountains and a 'mindset' overlay",
    "banner is 'gentleman, husband, hustler' energy in widescreen",
  ],
  "engagement-farmer": [
    "banner is a CTA pretending to be a banner",
    "banner is the thumbnail before the thumbnail",
    "banner is conversion-optimized real estate",
    "banner has a hook, a promise, and a link",
  ],
  "fake-rich-real-online": [
    "banner has a watch in it. of course it does.",
    "banner suggests a watch, or a car, or both",
    "banner is rented-Lambo light, refined",
    "banner is wealth-cosplay in 1500x500",
    "banner is a private-jet window seat, definitely yours",
  ],
  "anon-degen": [
    "banner is a green candle and a threat",
    "banner is a frog at scale",
    "banner is a 2021 alpha-chat screenshot",
    "banner is whatever was in the discord this morning",
  ],
  "chart-addict": [
    "banner is a TradingView screenshot from 2021",
    "banner is a chart with three trendlines and an apology",
    "banner is wave-3-of-5 energy in widescreen",
    "banner is a wick that did not save you",
  ],
  "bull-market-philosopher": [
    "banner says 'we're so back' in a serif font",
    "banner is a lighthouse / mountain / ocean — choose your own metaphor",
    "banner has a quote on it and the quote is yours",
    "banner is a thumbnail for a thread that's still loading",
  ],
  "nft-cope-survivor": [
    "banner is a collage of bags you'd rather not discuss",
    "banner is a 1/1 collection that 1/0 people remember",
    "banner is laser-eye nostalgia",
    "banner is jpeg evidence of a previous life",
  ],
  "anon-builder": [
    "banner is a black square. respectfully.",
    "banner is one color and a vibe",
    "banner is a wireframe. on purpose.",
    "banner is intentional emptiness",
  ],
};

function bannerRead(p: XProfile, e: Evidence, a: Archetype): string {
  if (!p.bannerUrl) {
    return pick(p.handle, "banner:none", [
      "no banner. impressive minimalism, or laziness.",
      "no banner uploaded. you are not even pretending.",
      "banner is the void, which is technically a vibe",
      "no banner. respectfully unbothered.",
    ]);
  }
  return pick(p.handle, "banner:" + a, BANNER_POOLS[a]);
}

// =================== TWEET READS ===================

const TWEETS_POOLS: Record<Archetype, readonly string[]> = {
  "philosopher-king": [
    "timeline is mostly other people's homework",
    "timeline reads like marginalia from a man who has read the book",
    "timeline is light because the leverage is elsewhere",
    "timeline rarely speaks but when it does, it lands",
  ],
  "overlord": [
    "timeline is short and confident — 4 words at a time, on purpose",
    "timeline reads like internal memos accidentally posted",
    "timeline tweets are press releases at scale",
    "timeline is signal-only — noise lives elsewhere",
  ],
  "chaos-engine": [
    "timeline is whatever amused them in the last 30 minutes",
    "timeline cycles through identities faster than you can mute",
    "timeline contains a take, a meme, and a problem — in that order",
    "timeline runs on impulse, not editorial",
  ],
  "founder-cosplay": [
    "timeline is heavy on 'building' and light on 'shipped'",
    "timeline is threads about distribution by a man with no users",
    "timeline reads like roadmap copy",
    "timeline cycles between 'cooking' and 'we cooked'",
  ],
  "premium-reply-guy": [
    "timeline is mostly two-word affirmations under other people's posts",
    "timeline is replies to people who did not ask",
    "timeline reads as quote-tweets of strangers' wisdom",
    "timeline runs on 'this.' and the occasional 'underrated take'",
  ],
  "engagement-farmer": [
    "timeline is hooks, lists, threads, repeat",
    "timeline tested every line in three variants before posting",
    "timeline serves a content calendar, not a person",
    "timeline is optimized to a degree that should be illegal",
  ],
  "fake-rich-real-online": [
    "timeline alternates between empire-flexing and 'comment ALPHA below'",
    "timeline reads like a sales funnel with a personality bolted on",
    "timeline cycles between 'I almost lost everything' and 'and now I have everything'",
    "timeline is daily affirmation + course CTA + repeat",
  ],
  "anon-degen": [
    "timeline is lowercase, post-coffee, pre-rugged",
    "timeline runs on 'gm', 'aped', and 'ngmi'",
    "timeline is anon-poasting at terminal velocity",
    "timeline is a mood, mostly",
  ],
  "chart-addict": [
    "timeline is wave-3-of-5 at all times, even today",
    "timeline screenshots its own predictions back when they're right",
    "timeline draws lines and asks you to subscribe",
    "timeline is bullish, NFA, and yes also financial advice",
  ],
  "bull-market-philosopher": [
    "timeline only sounds smart in green candles",
    "timeline runs longer threads as PnL gets shorter",
    "timeline cycles narratives like seasons",
    "timeline is mid-cycle prose with a thumbnail",
  ],
  "nft-cope-survivor": [
    "timeline is gm-to-the-real-ones at floor 0.04",
    "timeline mentions taste a lot, in the past tense",
    "timeline is jpeg apologetics with a side of cope",
    "timeline is 'still here' as a personality trait",
  ],
  "anon-builder": [
    "timeline is sparse, technical, and faintly amused",
    "timeline drops a one-liner once a week and shuts back up",
    "timeline reads like git commit messages with vibes",
    "timeline is mostly off, which is the most based posture",
  ],
};

function tweetsRead(p: XProfile, e: Evidence, a: Archetype): string {
  if (!e.tweetsCount) {
    return pick(p.handle, "tweets:none", [
      "no recent original tweets — only replies and retweets, which IS the read",
      "timeline has nothing original visible. that's a posture.",
      "no original tweets surfaced. you are pure amplifier.",
      "timeline is replies all the way down — broadcast disabled",
    ]);
  }
  // Highest-priority signal-grounded reads first (when evidence is concrete).
  if (e.replyGuyPhraseHits >= 3) {
    return pick(p.handle, "tweets:reply", [
      `${e.replyGuyPhraseHits} reply-guy stock phrases in your last ${e.tweetsCount} tweets — "this", "underrated", "saving"`,
      `${e.replyGuyPhraseHits} of your last ${e.tweetsCount} tweets are textbook reply-guy lines`,
      `${e.replyGuyPhraseHits} stock affirmations across ${e.tweetsCount} tweets — that's not a timeline, that's a comment section`,
      `${e.replyGuyPhraseHits} "this. 100%."-class lines in ${e.tweetsCount} posts — the math is rough`,
    ]);
  }
  if (e.founderPhraseHits >= 3) {
    return pick(p.handle, "tweets:founder", [
      `${e.founderPhraseHits} hits on founder vocabulary across the timeline ("building", "shipping", "distribution")`,
      `${e.founderPhraseHits} mentions of founder-vocab in ${e.tweetsCount} tweets — load-bearing keyword spam`,
      `${e.founderPhraseHits} usages of "building"-class words. specifying what would help.`,
      `${e.founderPhraseHits} founder buzzwords in ${e.tweetsCount} tweets — distribution thread > distribution channel`,
    ]);
  }
  if (e.chartPhraseHits >= 2) {
    return pick(p.handle, "tweets:chart", [
      `${e.chartPhraseHits} chart-shaman phrases per ${e.tweetsCount} posts — "wave 3", "bull flag", "target $"`,
      `${e.chartPhraseHits} TA mentions in ${e.tweetsCount} tweets — every wave is wave 3`,
      `${e.chartPhraseHits} chart-vocab hits — NFA, but the F is for "frequently"`,
    ]);
  }
  if (e.fakeRichPhraseHits >= 2) {
    return pick(p.handle, "tweets:rich", [
      `${e.fakeRichPhraseHits} grift-vocab hits ("alpha", "matrix", "kings") across ${e.tweetsCount} tweets`,
      `${e.fakeRichPhraseHits} mentions of empire-vocabulary in ${e.tweetsCount} tweets`,
      `${e.fakeRichPhraseHits} self-help-vocab hits per ${e.tweetsCount} posts — the course is loading`,
    ]);
  }
  if (e.shortTweetShare >= 0.6) {
    return pick(p.handle, "tweets:short", [
      `most of your tweets are under 30 chars — short, confident, almost meaning-free`,
      `tweets average ${Math.round(e.avgTweetLen)} chars — minimal effort, maximal posture`,
      `the timeline runs on one-liners. a register, not a thought.`,
      `tweets are 4-word presses on the algorithm. clean.`,
    ]);
  }
  if (e.avgTweetLen >= 200) {
    return pick(p.handle, "tweets:long", [
      `tweets average ${Math.round(e.avgTweetLen)} chars — paragraphs masquerading as posts`,
      `your tweets run ${Math.round(e.avgTweetLen)} chars on average — manifestos in 280-char drag`,
      `tweets average ${Math.round(e.avgTweetLen)} chars. that's a thread, structurally.`,
    ]);
  }
  if (e.exclaimRate >= 1.5) {
    return pick(p.handle, "tweets:excited", [
      "tweets contain an unhealthy amount of forced excitement",
      "tweets carry exclamation points like load-bearing structures",
      "tweets are yelling. nobody asked for the volume.",
    ]);
  }
  if (e.uppercasePostingShare >= 0.2) {
    return pick(p.handle, "tweets:caps", [
      `${Math.round(e.uppercasePostingShare * 100)}% of tweets are SHOUTED for emphasis`,
      `tweets randomly capitalize for emphasis. emphasis declined.`,
      `your caps lock has emotional needs.`,
    ]);
  }
  if (e.firstWord.match(/^(gm|wagmi|sirs|kings)/i)) {
    return pick(p.handle, "tweets:opener", [
      `every other post starts with "${e.firstWord}" energy`,
      `your morning kicks off with "${e.firstWord}" — predictable, productive`,
      `"${e.firstWord}" is the load-bearing first word of this account`,
    ]);
  }
  if (e.ctSlangHits >= 3) {
    return pick(p.handle, "tweets:ct", [
      `${e.ctSlangHits} CT slang hits — "ngmi", "ser", "wagmi", the canon`,
      `${e.ctSlangHits} mentions of degen vernacular per ${e.tweetsCount} tweets`,
      `${e.ctSlangHits} CT-vocab hits — fluent in the dialect`,
    ]);
  }
  // Archetype-flavor fallback (still varied per handle).
  return pick(p.handle, "tweets:" + a, TWEETS_POOLS[a]);
}

// =================== USERNAME READS ===================

const USERNAME_POOLS: Record<Archetype, readonly string[]> = {
  "philosopher-king": [
    "username is unbothered. so is the man behind it.",
    "username doesn't try. it doesn't have to.",
  ],
  "overlord": [
    "username is monogrammed. like a cufflink.",
    "username is brand-name shorthand at this point",
  ],
  "chaos-engine": [
    "username is whatever was funny once and stuck",
    "username is a moving target attached to chaos",
  ],
  "founder-cosplay": [
    "username has 'building' or a co's name in it, predictably",
    "username is a startup that no longer exists, attached to a face",
  ],
  "premium-reply-guy": [
    "username is two first names stacked, very uncle-at-a-cookout",
    "username is a polo shirt in handle form",
  ],
  "engagement-farmer": [
    "username is engineered for the bookmark, like everything else",
    "username is hook-optimized — even the @ does outreach",
  ],
  "fake-rich-real-online": [
    "username is the kind men whisper before recommending a course",
    "username has 'official' or '_real' in it, structurally suspicious",
    "username sounds like a watch brand for influencers",
  ],
  "anon-degen": [
    "username sounds like a wallet you'd rather not check",
    "username is degen poetry — vowels removed for safety",
    "username has '420', '69', or both. you know which.",
  ],
  "chart-addict": [
    "username has a ™ energy you can't legally claim",
    "username sounds like a paid telegram group",
    "username adds 'crypto' to a regular name, which is a choice",
  ],
  "bull-market-philosopher": [
    "username is a thread-bro brand — recognizable, reused, retired",
    "username has 'thoughts' or 'theory' in it, somewhere",
  ],
  "nft-cope-survivor": [
    "username has '.eth' or a number from a 10k collection",
    "username is a jpeg's name with a wallet attached",
  ],
  "anon-builder": [
    "username starts with '0x' or ends with '_dev', the giveaway",
    "username is short, lowercase, and faintly intimidating",
  ],
};

function usernameRead(p: XProfile, e: Evidence, a: Archetype): string {
  // Trait-grounded picks first.
  if (e.hasNumbers && e.underscoreUsername) {
    return pick(p.handle, "user:nums-under", [
      `username is "${p.handle}" — numbers AND underscores. ambitious.`,
      `username has both numbers and underscores. that's two diagnoses for one handle.`,
      `username "${p.handle}" — the kind of handle reserved for accounts that joined late`,
    ]);
  }
  if (e.hasNumbers) {
    return pick(p.handle, "user:nums", [
      `username has numbers in it (${p.handle}), which is its own diagnosis`,
      `username "${p.handle}" includes digits — a sign you got here second`,
      `username "${p.handle}" — "regular_name + integer", the universal late-arrival`,
      `numbers in your handle. mathematically, that's never a brag.`,
    ]);
  }
  if (e.underscoreUsername && e.longUsername) {
    return pick(p.handle, "user:long-under", [
      `username "${p.handle}" — long and underscored, like an apology`,
      `username "${p.handle}" stretches with underscores — the "ran out of options" pattern`,
      `username "${p.handle}" reads like a forced compromise`,
    ]);
  }
  if (e.longUsername) {
    return pick(p.handle, "user:long", [
      `username is "${p.handle}" — too long. that's the whole observation.`,
      `username "${p.handle}" runs ${p.handle.length} characters — three more than necessary`,
      `username "${p.handle}" is a paragraph in handle form`,
    ]);
  }
  // Archetype pool (hash-picked, varied).
  return pick(p.handle, "user:" + a, USERNAME_POOLS[a]);
}

// ---------- signals: 5–10 grounded facts ----------

function buildSignals(p: XProfile, e: Evidence): string[] {
  const sig: string[] = [];
  const ratio = e.followingToFollowers.toFixed(2);
  sig.push(
    `following:followers ratio = ${ratio} (${followCommentary(e)})`
  );
  if (p.followers > 0)
    sig.push(`followers: ${p.followers.toLocaleString()}`);
  if (e.bioWords)
    sig.push(`bio length: ${e.bioWords} words${e.bioEmojis ? ` + ${e.bioEmojis} emoji` : ""}`);
  if (e.tweetsCount)
    sig.push(
      `recent original tweets: ${e.tweetsCount}, avg ${Math.round(e.avgTweetLen)} chars`
    );
  if (e.replyGuyPhraseHits)
    sig.push(`reply-guy phrases observed: ${e.replyGuyPhraseHits}`);
  if (e.founderPhraseHits)
    sig.push(`"building" / founder vocabulary hits: ${e.founderPhraseHits}`);
  if (e.chartPhraseHits)
    sig.push(`chart-shaman phrases: ${e.chartPhraseHits}`);
  if (e.fakeRichPhraseHits)
    sig.push(`grift-vocabulary hits ("alpha", "matrix", "kings"): ${e.fakeRichPhraseHits}`);
  if (e.ctSlangHits)
    sig.push(`CT slang hits (gm/ngmi/ser/wagmi/etc): ${e.ctSlangHits}`);
  if (e.notableQuotes[0])
    sig.push(`representative tweet: "${truncate(e.notableQuotes[0], 90)}"`);
  return sig.slice(0, 10);
}

function followCommentary(e: Evidence): string {
  const r = e.followingToFollowers;
  if (!Number.isFinite(r)) return "no following data";
  if (r >= 2) return "deeply reply-guy territory";
  if (r >= 1) return "more following than followers — speaks for itself";
  if (r >= 0.3) return "balanced, almost suspicious";
  return "low following — broadcaster mode";
}

// ---------- toned variants ----------

function tone(
  mode: ToneMode,
  p: XProfile,
  e: Evidence,
  pct: number,
  a: Archetype
): { verdictHeadline: string; coreParagraph: string } {
  const quote = e.notableQuotes[0]
    ? `"${truncate(e.notableQuotes[0], 70)}"`
    : "";

  // Headline templates per mode, with archetype + percent + (optional) quote.
  const headline = headlineFor(mode, pct, a, e);
  const para = paragraphFor(mode, p, e, a, pct, quote);

  return { verdictHeadline: headline, coreParagraph: para };
}

function headlineFor(mode: ToneMode, pct: number, a: Archetype, e: Evidence): string {
  const arch = ARCHETYPE_HEADLINE[a];
  switch (mode) {
    case "funny":
      return `${arch.lower}, ${pct}% cooked`;
    case "brutal":
      return `verdict: ${pct}% cooked. no appeal.`;
    case "degen-ct":
      return `ngl ser, ${pct}% cooked — ${arch.degen}`;
    case "dry-deadpan":
      return `assessment: approximately ${pct}% cooked. ${arch.deadpan}.`;
    case "mock-analyst":
      return `Q4 personality review: ${pct}% cooked, rating ${arch.rating}`;
    case "unhinged":
      return `${pct}% COOKED. ${arch.unhinged.toUpperCase()}.`;
  }
}

const ARCHETYPE_HEADLINE: Record<Archetype, {
  lower: string;
  degen: string;
  deadpan: string;
  rating: string;
  unhinged: string;
}> = {
  "philosopher-king":   { lower: "respectfully, a philosopher king",  degen: "anon you're too based for the timeline",     deadpan: "Subject is unbothered. Noted",            rating: "hold (with admiration)",        unhinged: "HE'S READING A PAPER LEAVE HIM ALONE" },
  "overlord":           { lower: "an exchange overlord, posting reluctantly", degen: "respectfully, your tweets are a candlestick", deadpan: "Subject moves markets in four words",   rating: "hold (you and your lawyers)",  unhinged: "HE TYPED ONE NUMBER AND IT MOVED THE MARKET" },
  "chaos-engine":       { lower: "a chaos engine in the wild",        degen: "anon you own the app and you're STILL ratio'd", deadpan: "Subject treats posting as a slot machine", rating: "sell (the impulse to keep posting)", unhinged: "POSTING THROUGH IT FOREVER AND BEYOND" },
  "founder-cosplay":    { lower: "founder cosplay, observed in the wild", degen: "ngl ser, you're a stealth-mode meme",        deadpan: "Subject is 'building'. Has been for 412 days", rating: "sell (the stealth co)",      unhinged: "STOP TWEETING YOUR ROADMAP AND OPEN A PR" },
  "premium-reply-guy":  { lower: "a premium reply guy, no notes",     degen: "respectfully — premium reply guy",          deadpan: "Subject's posts are mostly other people's", rating: "sell (with prejudice)",      unhinged: "BOOKMARKED YOUR OWN BOOKMARK ABOUT BOOKMARKING" },
  "engagement-farmer":  { lower: "a hook-and-CTA enjoyer",            degen: "ser, your alpha is a CTA",                  deadpan: "Subject treats the timeline as a storefront", rating: "sell (the funnel)",          unhinged: "THE THREAD HAS A THREAD ABOUT THE THREAD" },
  "fake-rich-real-online": { lower: "fake rich, real online", degen: "anon you sell hopium with a stop loss on integrity", deadpan: "Subject teaches men. Men remain untaught", rating: "sell (the course)",     unhinged: "THE COLD PLUNGE WILL NOT SAVE YOU" },
  "anon-degen":         { lower: "a feral anon degen",               degen: "ngmi if you're not ngmi like this",         deadpan: "Subject is anon. Subject is also exposed", rating: "hold (your exit liquidity)", unhinged: "THE FROG IS NOT A PERSONALITY ANON" },
  "chart-addict":       { lower: "a chart addict with aura issues", degen: "ser, the chart says you should log off",    deadpan: "Subject draws lines. Subject subscribes to itself", rating: "sell (the alerts)",  unhinged: "DRAW ONE MORE TRIANGLE I DARE YOU" },
  "bull-market-philosopher": { lower: "a bull market philosopher", degen: "ngl ser, only sounds smart in green candles", deadpan: "Subject's takes scale with PnL",            rating: "hold (yourself accountable)",  unhinged: "THE NARRATIVE IS NOT GOING TO SAVE YOU" },
  "nft-cope-survivor":  { lower: "a jpeg cope survivor",             degen: "respectfully, the floor would like a word", deadpan: "Subject's collection is 'criminally underrated'",  rating: "hold (the bag)",            unhinged: "THE JPEG IS NOT GOING TO LOVE YOU BACK" },
  "anon-builder":       { lower: "an anon builder, allergic to attention", degen: "anon you are too based for this app", deadpan: "Subject ships and shuts up. Mostly",       rating: "hold (and don't disturb)",  unhinged: "OPEN-SOURCE YOUR FEELINGS COWARD" },
};

function paragraphFor(
  mode: ToneMode,
  p: XProfile,
  e: Evidence,
  a: Archetype,
  pct: number,
  quote: string
): string {
  const grounded = groundingFacts(p, e, a);

  switch (mode) {
    case "funny":
      return `okay so. ${grounded} ${quote ? `the receipt is ${quote}.` : ""} that's the read. you can disagree but the timeline is the receipt.`;

    case "brutal":
      return `let's be plain. ${grounded} ${quote ? `the proof is ${quote}.` : ""} nothing about this account is an accident — you chose every part of it. that's the part that should sting.`;

    case "degen-ct":
      return `gm. ser. respectfully. ${grounded.toLowerCase()} ${quote ? `the proof is ${quote.toLowerCase()}.` : ""} this is not financial advice. this is character advice. and you are short the float.`;

    case "dry-deadpan":
      return `${grounded} ${quote ? `Representative sample: ${quote}.` : ""} this is the situation. it does not require commentary. it has provided its own.`;

    case "mock-analyst":
      return `Executive summary. ${grounded} Representative quote: ${quote || "(redacted for client comfort)"}. Recommendation: revise positioning. Risk factor: continued posting at current cadence. Rating: hold (yourself accountable).`;

    case "unhinged":
      return `LISTEN. ${grounded.toUpperCase().replace(/\.$/, "")}. ${quote ? `THE PROOF: ${quote.toUpperCase()}.` : ""} I DIDN'T WANT TO SAY IT THE TIMELINE MADE ME. LOG OFF AND RECONSIDER YOUR ENTIRE DEAL.`;
  }
}

// Compose a grounded fact-paragraph for the core read. Pulls 2-3 bits from
// multiple pools so different handles produce different paragraphs even when
// they share an archetype. The bio is weighted heaviest because it's the
// strongest self-presentation signal.
function groundingFacts(p: XProfile, e: Evidence, a: Archetype): string {
  const bits: string[] = [];

  // ---- BIT 1: subject framing — varies by follower stance ----
  bits.push(subjectFraming(p, e));

  // ---- BIT 2: bio-anchored fact (preferred — bio is the most important signal) ----
  const bioFact = bioFactBit(p, e);
  if (bioFact) bits.push(bioFact);

  // ---- BIT 3: tweet/behavior fact (only if we don't already have one) ----
  if (!bioFact) {
    const tweetFact = tweetFactBit(p, e);
    if (tweetFact) bits.push(tweetFact);
  }

  // ---- BIT 4: archetype-flavored closer (hash-picked from pool) ----
  bits.push(pick(p.handle, "closer:" + a, ARCHETYPE_CLOSER_POOLS[a]));

  return capitalize(bits.join(", ")) + ".";
}

// Subject framing — who they are by the numbers. 4 different angles, picked by
// the actual follower/following posture.
function subjectFraming(p: XProfile, e: Evidence): string {
  const r = e.followingToFollowers;

  // Pure broadcaster — high follower count, follows almost no one.
  if (Number.isFinite(r) && r <= 0.02 && p.followers > 50_000) {
    return pick(p.handle, "frame:broadcaster", [
      `@${p.handle} broadcasts to ${p.followers.toLocaleString()} and follows almost nobody — pure transmission, zero reception`,
      `@${p.handle} posts at ${p.followers.toLocaleString()} followers and barely follows back — the timeline is the audience`,
      `@${p.handle} runs a one-way channel into ${p.followers.toLocaleString()} mutes`,
      `@${p.handle} sits at ${p.followers.toLocaleString()} followers, follows ${p.following.toLocaleString()} — broadcaster posture, dialed in`,
    ]);
  }

  // Reply-guy ratio — follows more than follows back.
  if (Number.isFinite(r) && r >= 1.3) {
    return pick(p.handle, "frame:replyguy", [
      `@${p.handle} follows more accounts than follow back (${p.following.toLocaleString()} > ${p.followers.toLocaleString()}) — a mathematical reply guy`,
      `@${p.handle} runs a follow:follower ratio of ${r.toFixed(2)} — that's the math of a man who replies more than he posts`,
      `@${p.handle} follows ${p.following.toLocaleString()} accounts to ${p.followers.toLocaleString()} mutes — a deficit posture`,
      `@${p.handle} clicks "follow" more than the timeline clicks back`,
    ]);
  }

  // Mid-account.
  if (p.followers >= 5_000 && p.followers < 200_000) {
    return pick(p.handle, "frame:mid", [
      `@${p.handle} broadcasts to ${formatThousands(p.followers)} followers`,
      `@${p.handle} posts to a healthy ${formatThousands(p.followers)}-strong audience`,
      `@${p.handle} runs a ${formatThousands(p.followers)}-follower account with ${formatThousands(p.following)} on the receiving end`,
      `@${p.handle} sits in the ${formatThousands(p.followers)}-follower mid-tier — the most dangerous zone on the app`,
    ]);
  }

  // Small account.
  if (p.followers < 5_000) {
    return pick(p.handle, "frame:small", [
      `@${p.handle} works the ${p.followers.toLocaleString()}-follower beat`,
      `@${p.handle} posts at ${p.followers.toLocaleString()} followers — the indie tier, posting hard`,
      `@${p.handle} writes for ${p.followers.toLocaleString()} mutes and counting`,
      `@${p.handle} runs the trenches at ${p.followers.toLocaleString()} followers, ${p.following.toLocaleString()} following`,
    ]);
  }

  // Large general broadcaster.
  return pick(p.handle, "frame:large", [
    `@${p.handle} broadcasts to ${formatThousands(p.followers)} followers`,
    `@${p.handle} sits at ${formatThousands(p.followers)} followers and posts like it`,
    `@${p.handle} runs a ${formatThousands(p.followers)}-mute audience with the cadence to match`,
  ]);
}

// Bio-anchored fact bit — weighted heaviest. Quotes the actual bio whenever
// we can. Returns null only if the bio is empty AND offers nothing.
function bioFactBit(p: XProfile, e: Evidence): string | null {
  const bio = (p.bio ?? "").trim();
  if (!bio) {
    return pick(p.handle, "biofact:empty", [
      "running a bio that says nothing",
      "with a bio that's been left blank on purpose",
      "with no bio at all — confidence or carelessness, hard to say",
      "operating bio-less, a posture in itself",
    ]);
  }

  // Quote the bio if it's short enough to fit.
  if (e.bioWords <= 6 && bio.length <= 60) {
    return pick(p.handle, "biofact:quote-short", [
      `whose bio reads "${bio}" and stops there`,
      `with a bio that says only "${bio}"`,
      `whose entire bio is "${bio}" — committed to brevity`,
      `with "${bio}" as the only thing the bio dares to claim`,
    ]);
  }

  // Founder/CEO posture.
  if (e.bioPhrases.founder || e.bioPhrases.ceo) {
    const titleMatch = bio.match(/\b(co-?founder|founder|ceo|cto|coo)\b/i);
    const t = titleMatch?.[0] ?? "founder";
    return pick(p.handle, "biofact:founder", [
      `whose bio leads with "${t}" before anything else`,
      `whose bio uses "${t}" the way other people use last names`,
      `whose bio ranks "${t}" above the actual product`,
      `with "${t}" as the load-bearing self-description`,
    ]);
  }

  // Grift / teaching framing.
  if (e.bioPhrases.teach || e.bioPhrases.figures) {
    const word = bio.match(/\b(teach|course|blueprint|matrix|mindset|\d+-?figure)\b/i)?.[0];
    return pick(p.handle, "biofact:grift", [
      `whose bio promises to teach you with "${word ?? "alpha"}"`,
      `whose bio runs a sales funnel disguised as a description`,
      `whose bio uses "${word ?? "matrix"}" — a word that's never free`,
      `with a bio aimed squarely at your DMs`,
    ]);
  }

  // Anon framing.
  if (e.bioPhrases.anon) {
    return pick(p.handle, "biofact:anon", [
      `whose bio says "anon" with extra steps`,
      `with a bio that commits to anonymity, then describes itself`,
      `whose bio leans into "anon" as a personality trait`,
    ]);
  }

  // Building / shipping (without explicit founder title).
  if (e.bioPhrases.building) {
    return pick(p.handle, "biofact:building", [
      `whose bio leads with "building" without specifying what`,
      `whose bio uses "building" as both the verb and the personality`,
      `with "building" load-bearing in the bio for an unclear period`,
      `whose bio is "building" + adjacent buzzwords, in that order`,
    ]);
  }

  // Heavy emoji bio.
  if (e.bioEmojis >= 3) {
    return pick(p.handle, "biofact:emoji", [
      `whose bio is ${e.bioEmojis} emojis stitched together with conviction`,
      `whose bio relies on ${e.bioEmojis} emoji to do what verbs would`,
      `whose bio is more pictograph than sentence (${e.bioEmojis} emoji deep)`,
    ]);
  }

  // DMs open.
  if (e.bioPhrases.dms) {
    return pick(p.handle, "biofact:dms", [
      `whose bio routes you to the DMs`,
      `with a bio that mentions DMs — never a good sign`,
      `whose bio's most important sentence is "DMs open"`,
    ]);
  }

  // Has a link in bio.
  if (e.bioHasLinks) {
    return pick(p.handle, "biofact:link", [
      `with a bio whose center of gravity is the link`,
      `whose bio is mostly a URL with sentences orbiting it`,
      `whose bio routes attention to a domain name`,
    ]);
  }

  // Onchain / web3.
  if (e.bioPhrases.onchain) {
    return pick(p.handle, "biofact:onchain", [
      `whose bio uses "onchain" as a personality trait`,
      `whose bio identifies as onchain — apparently a place`,
      `with "onchain" doing the work in the bio`,
    ]);
  }

  // ex-bank / ex-google framing.
  if (e.bioPhrases.ex) {
    const ex = bio.match(/\bex-?\w+/i)?.[0];
    return pick(p.handle, "biofact:ex", [
      `whose bio leads with "${ex ?? "ex-something"}" — the past as a flex`,
      `whose bio's biggest claim is what they used to do (${ex})`,
      `with "${ex}" as the load-bearing prestige token`,
    ]);
  }

  // NFT / art framing.
  if (e.bioPhrases.nft || e.bioPhrases.art) {
    return pick(p.handle, "biofact:nft", [
      `whose bio mentions taste / collections / floor — three of the four food groups`,
      `with a bio that talks about jpegs in the present tense`,
      `whose bio is "digital art collector" energy at full saturation`,
    ]);
  }

  // Long bio fallback — quote the first slice.
  if (e.bioWords > 10) {
    const opener = bio.split(/\s+/).slice(0, 6).join(" ");
    return pick(p.handle, "biofact:long", [
      `whose ${e.bioWords}-word bio opens with "${opener}…" and keeps going`,
      `with a bio sprawling ${e.bioWords} words — too many descriptors for one person`,
      `whose bio runs ${e.bioWords} words of layered identity claims, starting "${opener}…"`,
      `with a bio long enough that "${opener}…" is just the warm-up`,
    ]);
  }

  // Generic medium bio fallback — quote opener.
  const opener = bio.split(/\s+/).slice(0, 5).join(" ");
  return pick(p.handle, "biofact:med", [
    `whose bio opens with "${opener}…" and goes from there`,
    `with a bio that begins "${opener}…" — roughly self-aware, mostly performative`,
    `whose bio leads with "${opener}…" before getting more specific`,
    `with "${opener}…" carrying the bio's load`,
  ]);
}

// Tweet-anchored fact bit — used when we don't have a usable bio fact.
function tweetFactBit(p: XProfile, e: Evidence): string | null {
  if (!e.tweetsCount) {
    return pick(p.handle, "tweetfact:none", [
      "with no recent original tweets visible — only replies and reposts",
      "running a timeline that's mostly amplification, not authorship",
      "with a timeline made entirely of other people's posts",
    ]);
  }
  if (e.replyGuyPhraseHits >= 2) {
    return pick(p.handle, "tweetfact:reply", [
      `with ${e.replyGuyPhraseHits} reply-guy stock phrases in the last ${e.tweetsCount} tweets`,
      `whose last ${e.tweetsCount} tweets contain ${e.replyGuyPhraseHits} "this. 100%"-class lines`,
      `running ${e.replyGuyPhraseHits} stock affirmations across ${e.tweetsCount} posts`,
    ]);
  }
  if (e.founderPhraseHits >= 3) {
    return pick(p.handle, "tweetfact:founder", [
      `with ${e.founderPhraseHits} hits on founder vocabulary across the timeline`,
      `whose timeline contains ${e.founderPhraseHits} "building / shipping / distribution"-class lines`,
      `running ${e.founderPhraseHits} founder buzzwords per ${e.tweetsCount} tweets`,
    ]);
  }
  if (e.chartPhraseHits >= 2) {
    return pick(p.handle, "tweetfact:chart", [
      `with ${e.chartPhraseHits} chart-shaman phrases per ${e.tweetsCount} posts`,
      `running ${e.chartPhraseHits} TA-vocab hits across the timeline`,
      `whose timeline contains ${e.chartPhraseHits} "wave 3 / target $ / NFA"-class lines`,
    ]);
  }
  if (e.fakeRichPhraseHits >= 2) {
    return pick(p.handle, "tweetfact:rich", [
      `with ${e.fakeRichPhraseHits} grift-vocabulary words across the timeline`,
      `whose timeline drops "${e.fakeRichPhraseHits}"-many empire-vocab hits`,
      `running ${e.fakeRichPhraseHits} self-help buzzwords per ${e.tweetsCount} tweets`,
    ]);
  }
  if (e.shortTweetShare >= 0.6) {
    return pick(p.handle, "tweetfact:short", [
      `whose tweets average ${Math.round(e.avgTweetLen)} chars — short, confident, near-meaningless`,
      `running short tweets, mostly under 30 chars — the four-word press`,
      `with a timeline of confident one-liners`,
    ]);
  }
  if (e.avgTweetLen >= 200) {
    return pick(p.handle, "tweetfact:long", [
      `with tweets averaging ${Math.round(e.avgTweetLen)} chars — paragraphs in 280-char drag`,
      `whose timeline runs at ${Math.round(e.avgTweetLen)}-char average — manifestos, basically`,
      `running long-form tweets that should have been threads`,
    ]);
  }
  if (e.exclaimRate >= 1.5) {
    return pick(p.handle, "tweetfact:excited", [
      `whose tweets carry exclamation points like load-bearing structures`,
      `running an excitement rate of ${e.exclaimRate.toFixed(1)} ! per tweet — that's a lot of !`,
      `with tweets yelling at a volume nobody asked for`,
    ]);
  }
  if (e.uppercasePostingShare >= 0.2) {
    return pick(p.handle, "tweetfact:caps", [
      `with ${Math.round(e.uppercasePostingShare * 100)}% of tweets shouted in caps`,
      `whose CAPS LOCK has emotional needs`,
      `running random ALL-CAPS tweets at a rate that suggests passion`,
    ]);
  }
  if (e.notableQuotes[0]) {
    return pick(p.handle, "tweetfact:quote", [
      `whose representative tweet is "${truncate(e.notableQuotes[0], 70)}"`,
      `with "${truncate(e.notableQuotes[0], 70)}" representing the timeline`,
      `whose recent posts include "${truncate(e.notableQuotes[0], 70)}"`,
    ]);
  }
  return pick(p.handle, "tweetfact:generic", [
    `whose timeline averages ${Math.round(e.avgTweetLen)} chars — a register, not a thought`,
    `with ${e.tweetsCount} recent posts that average ${Math.round(e.avgTweetLen)} chars`,
    `running a ${e.tweetsCount}-tweet sample of restrained posting`,
  ]);
}

// Pretty thousands formatter (like X uses): 12300 -> "12.3K", 1_200_000 -> "1.2M"
function formatThousands(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

// Per-archetype closer pools — the punchline of the grounding sentence.
// 4-6 closers each so two accounts of the same archetype don't end identically.
const ARCHETYPE_CLOSER_POOLS: Record<Archetype, readonly string[]> = {
  "philosopher-king": [
    "the aura is real, the online presence is incidental",
    "and somehow that's the whole post",
    "and the timeline does not require him",
    "and the gravity is elsewhere",
    "respectfully, posting beneath your weight class on purpose",
  ],
  "overlord": [
    "and that's the whole press release",
    "and the lawyers are watching, presumably",
    "and the audience is bigger than the message",
    "and the four-word tweets move markets",
    "and the leverage is structurally elsewhere",
  ],
  "chaos-engine": [
    "and the timeline will be talking about it for 36 hours",
    "and the algorithm gets richer for it",
    "and you'll quote-tweet yourself by Wednesday",
    "and the whole site holds its breath",
    "and the next post is already worse",
  ],
  "founder-cosplay": [
    "and the product is still a Notion doc",
    "and 'building' has been the verb for several quarters now",
    "and the threads about distribution outnumber the users",
    "and the roadmap is mostly the next thread",
    "and the stealth co stays stealth",
    "and day 412 of building rolls into day 413",
  ],
  "premium-reply-guy": [
    "and every quote-tweet is a polite thank-you to a man who did not ask",
    "and the bookmarks are doing the heavy lifting",
    "and the timeline is mostly other people's wisdom, lightly endorsed",
    "and the originals-to-replies ratio is a war crime",
    "and the bio mentions a wife and two children, neither of whom follow back",
  ],
  "engagement-farmer": [
    "and the follower count goes up while the originality score does not",
    "and the hooks have hooks",
    "and the thread has a thread about the thread",
    "and the calendar is the personality",
    "and every post is A/B tested in your head",
  ],
  "fake-rich-real-online": [
    "and somewhere a course is loading",
    "and the cold plunge is allegedly transformative",
    "and the empire is mostly the audience",
    "and the matrix has a checkout page",
    "and the DMs auto-respond with a Calendly link",
  ],
  "anon-degen": [
    "and the only thing stable about you is your conviction without size",
    "and the wallet is more honest than the bio",
    "and the frog has seen things",
    "and the floor of you is below the floor",
    "and ngmi is starting to feel personal",
  ],
  "chart-addict": [
    "and every wave is wave 3",
    "and the bull flag has been forming for 14 months",
    "and the telegram CTR is healthier than the call accuracy",
    "and the screenshot saved you, then deleted you",
    "and NFA has done the work of three disclaimers",
  ],
  "bull-market-philosopher": [
    "and you only sound smart in green candles",
    "and the takes scale inversely to PnL",
    "and every cycle is the cycle that proves you right",
    "and the lens keeps changing, the position does not",
    "and the thesis is a personality with a thumbnail",
  ],
  "nft-cope-survivor": [
    "and the floor is irrelevant (it is not)",
    "and the bags remain, technically",
    "and the taste is real, the volume is not",
    "and the collection is criminally underrated, criminally underbid",
    "and gm to the real ones, holding gracefully",
  ],
  "anon-builder": [
    "and you ship and you shut up",
    "and the commits speak louder than the timeline",
    "and the silence is the whole brand",
    "and the absence of posting is the strategy",
    "and the most based thing about you is your offline status",
  ],
};

// ---------- tiny utils ----------

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
