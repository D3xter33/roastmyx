// src/lib/handVariants.ts
// Hand-written verdict-headline variants for the marquee mock profiles.
// Used purely as a flavor boost on top of the algorithmic engine — the
// underlying core truth (archetype, scores, verdict %) never changes.
//
// Lookup is by (handle, toneMode). Missing entries fall back to engine defaults.

import type { ToneMode } from "./types";

type Variant = { headline: string };

export const HAND_VARIANTS: Record<string, Partial<Record<ToneMode, Variant[]>>> = {
  vitalikbuterin: {
    funny: [{ headline: "profile verdict: too smart to be online, here anyway" }],
    brutal: [{ headline: "verdict: posting beneath your weight class on purpose" }],
    "dry-deadpan": [{ headline: "assessment: respectful. unbothered. mildly amused." }],
    "mock-analyst": [{ headline: "Q4 review: outperforming the timeline by abstaining from it" }],
    unhinged: [{ headline: "HE'S LITERALLY READING A PAPER RIGHT NOW LEAVE HIM ALONE" }],
    "degen-ct": [{ headline: "ngl, the only philosopher king CT actually has" }],
  },

  cz_binance: {
    funny: [{ headline: "profile verdict: '4'" }],
    brutal: [{ headline: "verdict: tweets like a man whose lawyers are watching" }],
    "dry-deadpan": [{ headline: "assessment: minimum viable posting. maximum viable leverage." }],
    "mock-analyst": [{ headline: "Q4 review: tweet length inversely correlated with market cap" }],
    unhinged: [{ headline: "HE TYPED ONE NUMBER. ONE. AND IT MOVED THE MARKET." }],
    "degen-ct": [{ headline: "respectfully, your tweets are a candlestick" }],
  },

  elonmusk: {
    funny: [{ headline: "profile verdict: posting through it, forever" }],
    brutal: [{ headline: "verdict: richest reply guy ever recorded" }],
    "dry-deadpan": [{ headline: "assessment: 210M followers. zero impulse control." }],
    "mock-analyst": [{ headline: "Q4 review: unhinged at scale, monetized at scale" }],
    unhinged: [{ headline: "HE OWNS THE APP AND POSTS LIKE A 14 YEAR OLD" }],
    "degen-ct": [{ headline: "anon owns the timeline and is still ratio'd weekly" }],
  },

  ct_founder_99: {
    funny: [{ headline: "profile verdict: day 412 of building a Notion page" }],
    brutal: [{ headline: "verdict: founder cosplay, real follower count" }],
    "dry-deadpan": [{ headline: "assessment: 'building'. observed for 11 months. no product." }],
    "mock-analyst": [{ headline: "Q4 review: distribution thread > distribution channel" }],
    unhinged: [{ headline: "STOP TWEETING YOUR ROADMAP AND OPEN A PR" }],
    "degen-ct": [{ headline: "ngl ser, you're a stealth-mode meme" }],
  },

  reply_guy_pro: {
    funny: [{ headline: "profile verdict: 'this. 100%.' — 4,200 times" }],
    brutal: [{ headline: "verdict: a career built one reply at a time" }],
    "dry-deadpan": [{ headline: "assessment: posts that are mostly other people's." }],
    "mock-analyst": [{ headline: "Q4 review: reply yield strong, originality yield zero" }],
    unhinged: [{ headline: "BOOKMARKED YOUR OWN BOOKMARK ABOUT BOOKMARKING" }],
    "degen-ct": [{ headline: "respectfully — premium reply guy, no notes" }],
  },

  degen_pepe: {
    funny: [{ headline: "profile verdict: aped, no questions asked" }],
    brutal: [{ headline: "verdict: anon, broke, beautiful" }],
    "dry-deadpan": [{ headline: "assessment: lowercase posting. uppercase losses." }],
    "mock-analyst": [{ headline: "Q4 review: sharpe ratio negative, vibe ratio elite" }],
    unhinged: [{ headline: "THE FROG IS NOT A PERSONALITY ANON. OR IS IT" }],
    "degen-ct": [{ headline: "ngmi if you're not ngmi like this" }],
  },

  chart_addict: {
    funny: [{ headline: "profile verdict: every wave is wave 3" }],
    brutal: [{ headline: "verdict: NFA but psychologically yes financial advice" }],
    "dry-deadpan": [{ headline: "assessment: lines drawn. predictions drawn. conclusions undrawn." }],
    "mock-analyst": [{ headline: "Q4 review: TA accuracy 8%, telegram CTR 92%" }],
    unhinged: [{ headline: "DRAW ONE MORE TRIANGLE I DARE YOU" }],
    "degen-ct": [{ headline: "ser, the chart is bullish on you logging off" }],
  },

  fake_rich_4u: {
    funny: [{ headline: "profile verdict: rented Lambo, real follower count" }],
    brutal: [{ headline: "verdict: a pyramid, but spiritually" }],
    "dry-deadpan": [{ headline: "assessment: teaches men. men remain untaught." }],
    "mock-analyst": [{ headline: "Q4 review: course revenue up, soul revenue down" }],
    unhinged: [{ headline: "THE COLD PLUNGE IS NOT GOING TO SAVE YOU" }],
    "degen-ct": [{ headline: "anon you sell hopium with a stop loss on integrity" }],
  },

  nft_survivor: {
    funny: [{ headline: "profile verdict: still here. somehow." }],
    brutal: [{ headline: "verdict: the floor is irrelevant (it is not)" }],
    "dry-deadpan": [{ headline: "assessment: tasteful bags. heavy ones." }],
    "mock-analyst": [{ headline: "Q4 review: aesthetic conviction high, secondary volume low" }],
    unhinged: [{ headline: "THE JPEG IS NOT GOING TO LOVE YOU BACK" }],
    "degen-ct": [{ headline: "respectfully, the floor would like a word" }],
  },

  anon_dev_42: {
    funny: [{ headline: "profile verdict: ships and shuts up, mostly" }],
    brutal: [{ headline: "verdict: too based to log off, too based to engage" }],
    "dry-deadpan": [{ headline: "assessment: builder. anon. unaffected. (suspicious.)" }],
    "mock-analyst": [{ headline: "Q4 review: commits up, posts up, grass touched: zero" }],
    unhinged: [{ headline: "OPEN-SOURCE YOUR FEELINGS COWARD" }],
    "degen-ct": [{ headline: "anon you are too based for this app, log off" }],
  },
};
