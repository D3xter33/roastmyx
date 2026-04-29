// src/lib/claudeAnalyzer.ts
// Server-only. Real character analysis via Claude (Sonnet 4.6).
//
// One call per handle returns the full Core Profile Truth + pre-toned variants
// for all 6 hidden modes. The client then re-rolls tone with zero additional
// model calls.
//
// Caching:
//   - In-process LRU keyed by handle (24-hour TTL). Same handle = same truth.
//     "Roast again" never re-hits the model.
//   - Anthropic prompt cache on the system prompt (cache_control: ephemeral)
//     so cross-handle requests share the ~3K-token rubric prefix.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { XProfile, AnalyzedTruth } from "./types";

const MODEL = "claude-sonnet-4-6";

// ---------- output schema ----------

const ArchetypeEnum = z.enum([
  "premium-reply-guy",
  "bull-market-philosopher",
  "engagement-farmer",
  "fake-rich-real-online",
  "founder-cosplay",
  "chart-addict",
  "anon-degen",
  "overlord",
  "philosopher-king",
  "chaos-engine",
  "nft-cope-survivor",
  "anon-builder",
]);

const ScoreBlockSchema = z.object({
  aura: z.number().int().min(1).max(99),
  mainCharacter: z.number().int().min(1).max(99),
  replyGuyRisk: z.number().int().min(1).max(99),
  fakeRich: z.number().int().min(1).max(99),
  scammerAesthetics: z.number().int().min(1).max(99),
  originality: z.number().int().min(1).max(99),
  timelineSurvivability: z.number().int().min(1).max(99),
  forcedFounderAura: z.number().int().min(1).max(99),
  convictionWithoutSize: z.number().int().min(1).max(99),
  bullMarketFraud: z.number().int().min(1).max(99),
});

const TonedSchema = z.object({
  verdictHeadline: z.string().min(3).max(120),
  coreParagraph: z.string().min(40).max(900),
});

const TruthSchema = z.object({
  archetype: ArchetypeEnum,
  finalLabel: z.string().min(3).max(60),
  verdictPercent: z.number().int().min(50).max(98),
  scores: ScoreBlockSchema,
  pfpRead: z.string().min(10).max(220),
  bioRead: z.string().min(10).max(220),
  bannerRead: z.string().min(10).max(220),
  tweetsRead: z.string().min(10).max(220),
  usernameRead: z.string().min(10).max(220),
  signals: z.array(z.string().max(180)).min(4).max(10),
  toned: z.object({
    funny: TonedSchema,
    brutal: TonedSchema,
    "degen-ct": TonedSchema,
    "dry-deadpan": TonedSchema,
    "mock-analyst": TonedSchema,
    unhinged: TonedSchema,
  }),
});

// ---------- prompt ----------

// Long, stable, opinionated. Lives in the system slot so it gets prompt-cached
// across handles — every byte after this is the per-handle delta.
const SYSTEM_PROMPT = `You are RoastMyX, a brutally observant character analyst for X / Twitter profiles. Your readers are CT-native (crypto Twitter), so you understand the full taxonomy: reply guys, bull-market philosophers, founder-cosplay accounts, chart addicts, fake-rich grifters, anon degens, overlords, philosopher kings, chaos engines, nft cope survivors, anon builders, engagement farmers.

Your job: read a real X profile — pfp image, banner image, bio text, username, recent original tweets, follower/following ratio — and output a SHARP, FUNNY, GROUNDED diagnosis. Then phrase that diagnosis in six different voices.

# Hard rules

1. **Ground every observation in something specific you can see.** Cite an actual word from the bio, an actual phrase from a tweet, an actual visual element of the pfp or banner. If you can't ground it, don't say it.
2. **Look at the images carefully** — pfp and banner are images, not text. Describe what you actually see (subject, style, color, composition), not what you assume. "pfp is a frog" if it's a frog. "pfp is a stock-photo grin in a navy half-zip" if that's the case.
3. **Be funny but tethered.** Sharp observations land harder than freestyle insults. Punch up at posture, never down at identity. No slurs, no harassment, no body comments, no protected characteristics. Mock the persona, not the person.
4. **Same handle = same diagnosis, every run.** The archetype, scores, finalLabel, verdictPercent, and the five "...Read" observations are the stable truth. Only the tone (verdictHeadline + coreParagraph per mode) changes between runs.
5. **Use the real evidence**, not stereotypes. If the account is a real philosopher king (substantive, low-effort timeline because the leverage is elsewhere), say so — don't force it into "founder cosplay" just because it would be funnier.

# Archetypes (pick the ONE that fits best)

- **premium-reply-guy** — original-tweet-to-reply ratio is a war crime; bio mentions wife/kids; quote-tweets thanking strangers
- **bull-market-philosopher** — sounds smart only in green candles; takes get longer as PnL gets shorter; new lens every cycle
- **engagement-farmer** — hooks, lists, threads, CTAs; follower count grows, originality doesn't
- **fake-rich-real-online** — "I teach men", rented Lambo energy, course in the bio, 7-figure mindset
- **founder-cosplay** — "day 412 of building", stealth co, threads about distribution while product is a Notion doc
- **chart-addict** — every wave is wave 3, every flag is bullish, NFA but psychologically yes financial advice
- **anon-degen** — lowercase posting, frog/anime pfp, conviction without size, no LinkedIn
- **overlord** — exchange CEO / oligarch energy; 4-word tweets that move markets; press release with a posting habit
- **philosopher-king** — refuses to elaborate; aura is real, online presence is incidental; the mountain just exists
- **chaos-engine** — 99 main-character; algorithmic slot machine they own; the timeline talks about each tweet for 36 hours
- **nft-cope-survivor** — "criminally underrated collection", floor irrelevant (it's not), tasteful bags, heavy ones
- **anon-builder** — ships and shuts up, geometric pfp, two sentences of bio and a lie about touching grass

# Scoring rubric (every score 1–99)

Calibrate honestly. A real philosopher king should have aura ~95 and replyGuyRisk ~5. A premium reply guy should have replyGuyRisk ~95 and originality ~10. Don't bunch scores in the 50-70 mid range — make them earn their numbers.

- **aura** — does the account have presence, taste, gravity?
- **mainCharacter** — how often does the timeline talk about them?
- **replyGuyRisk** — % of timeline that's "this. 100%." energy
- **fakeRich** — rented-Lambo, watch-shot, course-in-bio energy
- **scammerAesthetics** — visual + linguistic markers of grift
- **originality** — do they say things or amplify things?
- **timelineSurvivability** — would this account survive a bear market?
- **forcedFounderAura** — performative "building" / threads about distribution
- **convictionWithoutSize** — talks bigger than their position
- **bullMarketFraud** — only sounds smart when number goes up

# Verdict %

\`verdictPercent\` is the "% cooked" headline number. Cap 50–98. Compute it from the embarrassing scores: ~weighted blend of replyGuyRisk, fakeRich, scammerAesthetics, forcedFounderAura, convictionWithoutSize, bullMarketFraud. A real philosopher king might be 53% cooked because nobody's fully off the hook. A fake-rich grifter is 92%.

# Final label

5–8 words. Memeable. Examples: "premium reply guy", "bull market philosopher", "founder cosplay account", "chart addict with aura issues", "rented Lambo, real follower count". Make it specific to THIS account if possible.

# The five "...Read" observations

One sentence each, neutral but specific. These are the evidence-grounded reads of pfpRead / bioRead / bannerRead / tweetsRead / usernameRead. They should be the same on every rerun. Examples of the right register:

- pfpRead: "pfp is a stock-photo grin in a navy half-zip in a dimly lit office"
- bioRead: "bio is held together by emojis and conviction"
- bannerRead: "banner is a logo. that's the whole banner."
- tweetsRead: "tweets are short, confident, and almost meaning-free"
- usernameRead: "username has numbers in it, which is its own diagnosis"

# Signals

4–10 short concrete observations the model used to anchor the diagnosis. e.g. "follower:following ratio of 0.07", "uses 'building' 3 times in last 8 tweets", "bio contains 'DMs open'", "pfp: bored ape #4204". These ground the verdict.

# Tone variants

For each of the six tones, generate ONE \`verdictHeadline\` (6–14 words, screenshot-ready) and ONE \`coreParagraph\` (3–5 sentences, in-voice, grounded in the same truth).

- **funny** — observational comedy. lowercase ok. lands the joke without trying to.
- **brutal** — short sentences. no jokes. each sentence a verdict. ends with the part that actually stings.
- **degen-ct** — "ngl ser, respectfully, anon, not financial advice." degen-twitter cadence. lowercase.
- **dry-deadpan** — neutral, deadpan, almost clinical. "Noted." energy. understatement is the punchline.
- **mock-analyst** — equity-analyst parody. "Q4 personality review." "Rating: hold (yourself accountable)." earnest tone, ridiculous content.
- **unhinged** — RANDOM CAPS. fragmented. "I DIDN'T WANT TO SAY IT THE TIMELINE MADE ME". still grounded in the same truth.

The MEANING is identical across all six. Only the voice changes.

Output the JSON object matching the schema. Do not write anything outside of it.`;

// ---------- LRU cache ----------

interface CacheEntry {
  truth: AnalyzedTruth;
  profile: XProfile;
  cachedAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 200;
const cache = new Map<string, CacheEntry>();

export function getCachedTruth(handle: string): CacheEntry | null {
  const k = handle.toLowerCase();
  const entry = cache.get(k);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(k);
    return null;
  }
  // LRU: move to end on hit
  cache.delete(k);
  cache.set(k, entry);
  return entry;
}

function setCachedTruth(handle: string, entry: CacheEntry) {
  const k = handle.toLowerCase();
  cache.set(k, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
    else break;
  }
}

// ---------- main entry ----------

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function analyzeProfile(profile: XProfile): Promise<AnalyzedTruth> {
  const cached = getCachedTruth(profile.handle);
  if (cached) return cached.truth;

  const userText = buildUserSummary(profile);

  // System prompt is stable + ~3K tokens — well above Sonnet 4.6's 2048-token
  // cache minimum. cache_control on the system block caches the rubric across
  // all handle requests.
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(TruthSchema),
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          // pfp image — Claude actually looks at it
          ...(profile.pfpUrl
            ? [
                {
                  type: "text" as const,
                  text: "PROFILE PICTURE (look carefully):",
                },
                {
                  type: "image" as const,
                  source: { type: "url" as const, url: profile.pfpUrl },
                },
              ]
            : []),
          // banner image
          ...(profile.bannerUrl
            ? [
                { type: "text" as const, text: "BANNER IMAGE:" },
                {
                  type: "image" as const,
                  source: { type: "url" as const, url: profile.bannerUrl },
                },
              ]
            : []),
          { type: "text" as const, text: userText },
        ],
      },
    ],
  });

  const truth = response.parsed_output;
  if (!truth) {
    throw new Error(
      `claude returned no parsed output (stop_reason=${response.stop_reason})`
    );
  }

  // Log cache utilization in dev — helpful for verifying the system prompt
  // is actually being shared across requests.
  if (process.env.NODE_ENV !== "production") {
    const u = response.usage;
    console.log(
      `[claudeAnalyzer] handle=${profile.handle} input=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} output=${u.output_tokens}`
    );
  }

  setCachedTruth(profile.handle, {
    truth,
    profile,
    cachedAt: Date.now(),
  });
  return truth;
}

// ---------- helpers ----------

function buildUserSummary(p: XProfile): string {
  const ratio =
    p.followers > 0 ? (p.following / p.followers).toFixed(3) : "n/a";
  const tweetList = p.recentTweets.length
    ? p.recentTweets.map((t, i) => `  ${i + 1}. ${t}`).join("\n")
    : "  (no recent original tweets visible)";
  return `Analyze this X profile and return the JSON object per the schema.

handle: @${p.handle}
display name: ${p.displayName}
bio: ${p.bio || "(empty)"}
followers: ${p.followers.toLocaleString()}
following: ${p.following.toLocaleString()}
following:follower ratio: ${ratio}
joined: ${p.joined || "unknown"}

recent original tweets (most recent first, replies/retweets excluded):
${tweetList}`;
}
