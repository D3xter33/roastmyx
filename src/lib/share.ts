// src/lib/share.ts
// Share + download helpers. Client-only; html-to-image is dynamically imported
// so it never lands in the server bundle.

import type { RoastReport } from "./types";

export function buildShareText(r: RoastReport): string {
  const top = r.scoreCategories.slice(0, 3)
    .map((c) => `${c.label}: ${c.value}/100`)
    .join(" · ");
  return [
    `@${r.handle} — ${r.verdictHeadline}`,
    "",
    top,
    "",
    `final label: ${r.finalLabel}`,
    "",
    "roasted by RoastMyX 🔥",
  ].join("\n");
}

export function buildTweetIntent(r: RoastReport): string {
  const text = encodeURIComponent(
    `@${r.handle} — ${r.verdictHeadline}\n\nfinal label: ${r.finalLabel}\n\nroasted by RoastMyX 🔥`
  );
  return `https://twitter.com/intent/tweet?text=${text}`;
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for older browsers / non-secure contexts.
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export async function downloadCardAsPng(node: HTMLElement, filename: string) {
  // Wait for every <img> in the card to be fully decoded. html-to-image waits
  // for `complete=true`, but Next.js's <Image> uses async decoding paths that
  // can leave .complete=true while pixels aren't yet decodable. Calling
  // .decode() blocks until pixels are ready, which prevents the export from
  // racing the network/decoder.
  const imgs = Array.from(node.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
        }
        if ("decode" in img) await img.decode().catch(() => {});
      } catch {
        /* ignore — single broken image shouldn't break the export */
      }
    })
  );

  const { toPng } = await import("html-to-image");

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#09090b",
    // Keep the export deterministic across browsers.
    skipFonts: false,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.rel = "noopener";
  link.click();
}

export async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  // Two short bursts for that "yes it shipped" feel.
  confetti({
    particleCount: 80,
    spread: 75,
    origin: { y: 0.6 },
    colors: ["#FF00AA", "#FF0033", "#ffffff", "#a855f7"],
  });
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 100,
      angle: 120,
      origin: { x: 0.1, y: 0.7 },
      colors: ["#FF00AA", "#ffffff"],
    });
    confetti({
      particleCount: 60,
      spread: 100,
      angle: 60,
      origin: { x: 0.9, y: 0.7 },
      colors: ["#FF0033", "#ffffff"],
    });
  }, 180);
}
