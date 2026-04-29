// src/app/api/img/route.ts
// Same-origin image proxy for X CDN assets.
//
// Why this exists:
//   pbs.twimg.com doesn't send `Access-Control-Allow-Origin: *`. When the
//   browser tries to read the pixels of a pfp/banner <img> for export
//   (html-to-image / canvas.toDataURL), the canvas becomes "tainted" and the
//   read fails. The PNG download silently breaks.
//
// Fix: fetch the image server-side and re-serve it from our own origin with
// permissive CORS headers. The browser then reads pixels normally.
//
// Whitelist is strict — only X's image CDN is proxied. Anything else is 400.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set(["pbs.twimg.com", "abs.twimg.com"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("u");
  if (!target) {
    return NextResponse.json({ error: "missing ?u=" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return NextResponse.json(
      { error: "host not allowed" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(url.toString(), {
      // X CDN is blocking certain UAs; mimic a normal browser.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      // Cache aggressively at the fetch layer so repeat requests are instant.
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream returned ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get("content-type") ?? "image/jpeg";
    const buf = await upstream.arrayBuffer();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        // Permissive CORS so html-to-image / canvas can read pixels.
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
