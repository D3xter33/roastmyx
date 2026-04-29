# RoastMyX 🔥

The app that tells you what your X profile actually looks like.

Paste any handle. Get a brutally accurate, funny, screenshot-friendly roast of
their pfp, bio, banner, username and recent tweets. Rerun for new flavor — the
**diagnosis stays the same, only the voice changes**.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — pick a sample handle from the chips, or paste any
handle (unknown ones are deterministically synthesized).

## What's interesting in here

**Two-stage roast pipeline** — same input, same diagnosis, every run.

```
   handle
     │
     ▼
profileService.fetchProfile(handle)        ← swap in a real API later
     │
     ▼
deriveCoreTruth(profile)                   ← STAGE 1: stable, hidden truth
  ├─ archetype                              (deterministic from handle hash)
  ├─ scores (10 categories, ±jitter seeded)
  ├─ verdictPercent
  ├─ finalLabel
  └─ neutral profile reads
     │
     ▼
applyTone(truth, randomToneMode)           ← STAGE 2: random voice per run
                                             funny | brutal | degen-CT |
                                             dry-deadpan | mock-analyst |
                                             unhinged
     │
     ▼
RoastReport  →  UI
```

The core truth never changes for a given handle. Only the wording does. The
user never sees the archetype or the tone mode.

## Folder map

```
src/
  app/             layout.tsx · page.tsx · globals.css
  components/      Hero · HandleInput · LoadingScreen · RoastResult ·
                   ScoreMeter · ShareBar · BackgroundFX · ui/*
  lib/             types · profileService · mockProfiles · coreTruth ·
                   toneModes · roastEngine · handVariants ·
                   loadingMessages · share · utils
  hooks/           useRoast — state machine for the whole flow
```

## Plugging in a real X scraper / API

Implement the `ProfileService` interface in `src/lib/profileService.ts`:

```ts
export interface ProfileService {
  fetchProfile(handle: string): Promise<XProfile>;
}
```

Replace the exported `profileService` with your real implementation. The roast
engine doesn't care where the profile came from — only the shape matters.

## Sample handles

`vitalikbuterin` · `cz_binance` · `elonmusk` · `ct_founder_99` ·
`reply_guy_pro` · `degen_pepe` · `chart_addict` · `fake_rich_4u` ·
`nft_survivor` · `anon_dev_42`

Each has a hand-tuned archetype and hand-written headline variants per tone for
maximum "roast again" magic.

## Stack

- Next.js 15 (App Router) · TypeScript strict · React 19
- Tailwind CSS v4 · shadcn/ui + Radix primitives
- Framer Motion for everything that moves
- lucide-react for icons
- html-to-image for PNG export · canvas-confetti for celebration · sonner for toasts

## Disclaimer

RoastMyX is a parody / fan project. Not affiliated with X. Don't use the roasts
to bully people you wouldn't roast in real life. Or do, idk, you're an adult.
