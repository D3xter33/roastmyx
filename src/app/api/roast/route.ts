// src/app/api/roast/route.ts
// POST /api/roast { handle: string } -> { profile: XProfile, truth: AnalyzedTruth }
//
// Server-only. Fetches the real X profile via syndication, then asks Claude
// (Sonnet 4.6, vision + text) to derive the Core Profile Truth + 6 toned
// variants in one call. Result is cached per handle in-process; client-side
// tone re-rolls hit the cached truth, never the model.

import { NextResponse } from "next/server";
import { fetchXProfile, XScrapeError } from "@/lib/xPlaywrightFetcher";
import { analyzeProfile } from "@/lib/localAnalyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReqBody {
  handle?: string;
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const handle = body.handle?.replace(/^@/, "").trim().toLowerCase();
  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    return NextResponse.json(
      { error: "handles can only contain letters, numbers, and underscores (max 15)" },
      { status: 400 }
    );
  }

  try {
    const profile = await fetchXProfile(handle);
    const truth = await analyzeProfile(profile);
    return NextResponse.json({ profile, truth });
  } catch (e) {
    if (e instanceof XScrapeError) {
      return NextResponse.json(
        { error: `couldn't read @${handle}: ${e.message}` },
        { status: 502 }
      );
    }
    console.error("[/api/roast] error", e);
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
