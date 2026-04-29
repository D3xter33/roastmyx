// src/lib/xPlaywrightFetcher.ts
// Server-only. Real headless-browser scraper for public X profile pages.
//
// Strategy:
//   1. Launch one shared Chromium instance per server process (cached across
//      requests + HMR so we don't pay 3-second startup per call).
//   2. Open https://x.com/<handle>, wait for the React DOM to render.
//   3. Extract everything in a single page.evaluate() — DOM selectors first,
//      OpenGraph meta tags as a fallback when X login-walls the timeline.
//   4. Block heavy resources (video, fonts, ads) to keep each scrape under
//      ~10 seconds.
//
// What we return matches the existing XProfile shape so the rest of the
// pipeline (Claude analyzer, /api/roast, UI) doesn't need to change.

import "server-only";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Route,
} from "playwright";
import type { XProfile } from "./types";

export class XScrapeError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "XScrapeError";
  }
}

// ---------- shared browser singleton ----------
//
// Hung onto globalThis so Next.js HMR doesn't relaunch Chromium on every code
// edit during dev. The browser auto-cleans on process exit.

interface BrowserHolder {
  promise: Promise<Browser> | null;
}
const g = globalThis as unknown as { __roastmyxBrowser?: BrowserHolder };
g.__roastmyxBrowser ??= { promise: null };

async function getBrowser(): Promise<Browser> {
  const holder = g.__roastmyxBrowser!;
  if (!holder.promise) {
    holder.promise = chromium
      .launch({
        headless: true,
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
          "--no-sandbox",
        ],
      })
      .then(async (browser) => {
        // Auto-clear when the browser dies, so the next call relaunches.
        browser.on("disconnected", () => {
          if (g.__roastmyxBrowser?.promise) {
            g.__roastmyxBrowser.promise = null;
          }
        });
        return browser;
      });
  }
  return holder.promise;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------- main entry ----------

export async function fetchXProfile(rawHandle: string): Promise<XProfile> {
  const handle = rawHandle.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    throw new XScrapeError(`invalid handle: ${rawHandle}`);
  }

  const browser = await getBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1280, height: 1600 },
      locale: "en-US",
      timezoneId: "America/New_York",
      // X tracks bots by webdriver flags; we already disabled the
      // AutomationControlled blink feature in launch args.
    });

    // Block fonts/media/css to speed up — we don't need to render the page,
    // we just need the DOM. Images are *allowed* because some banner/pfp URLs
    // are only resolved after the <img> tag actually loads them.
    await context.route("**/*", (route: Route) => {
      const t = route.request().resourceType();
      if (t === "font" || t === "media" || t === "stylesheet") {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(25_000);

    const url = `https://x.com/${encodeURIComponent(handle)}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Best-effort: wait for either the user header (logged-out happy path)
    // OR the OG metadata (login wall fallback).
    await Promise.race([
      page
        .waitForSelector('[data-testid="UserName"]', { timeout: 12_000 })
        .catch(() => null),
      page
        .waitForSelector('meta[property="og:title"]', { timeout: 12_000 })
        .catch(() => null),
    ]);

    // Give tweets a moment to render if the timeline is visible.
    await page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 6_000 })
      .catch(() => null);

    const scraped = await page.evaluate(() => {
      // ----- Helpers (live in the browser context) -----
      const $ = <T extends Element>(sel: string, root: ParentNode = document) =>
        root.querySelector<T>(sel);
      const $$ = <T extends Element>(sel: string, root: ParentNode = document) =>
        Array.from(root.querySelectorAll<T>(sel));

      const meta = (key: string): string => {
        const el =
          $<HTMLMetaElement>(`meta[property="${key}"]`) ??
          $<HTMLMetaElement>(`meta[name="${key}"]`);
        return el?.content?.trim() ?? "";
      };

      const text = (el: Element | null): string =>
        (el?.textContent ?? "").replace(/\s+/g, " ").trim();

      // ----- displayName + username -----
      // <div data-testid="UserName"> renders as nested spans:
      //   <span>{displayName}</span><span>@{handle}</span>
      // textContent gives them concatenated with no separator (e.g.
      // "zaika@zaika_hl"). We split on the LAST '@' so display names
      // containing literal '@' don't confuse us.
      let displayName = "";
      let username = "";
      const userNameEl = $<HTMLElement>('[data-testid="UserName"]');
      if (userNameEl) {
        const fullText = text(userNameEl);
        const atIdx = fullText.lastIndexOf("@");
        if (atIdx > 0) {
          displayName = fullText.slice(0, atIdx).trim();
          // The handle ends at the first whitespace or middle-dot separator.
          username = fullText
            .slice(atIdx + 1)
            .split(/[\s·]/)[0]
            ?.trim() ?? "";
        } else if (atIdx === 0) {
          // displayName is empty, only @handle visible
          username = fullText.slice(1).split(/[\s·]/)[0]?.trim() ?? "";
        } else {
          displayName = fullText.trim();
        }
      }

      // OpenGraph fallback — survives login wall.
      // og:title is "Display Name (@handle) / X"
      if (!displayName || !username) {
        const ogTitle = meta("og:title");
        const m = ogTitle.match(/^(.*?)\s*\(@([^)]+)\)/);
        if (m) {
          if (!displayName) displayName = m[1]!.trim();
          if (!username) username = m[2]!.trim();
        }
      }

      // ----- bio -----
      let bio = text($('[data-testid="UserDescription"]'));
      if (!bio) bio = meta("og:description") || meta("description");

      // ----- profile image -----
      // The pfp <img> sits inside the avatar container. Prefer the rendered
      // <img>, fall back to og:image. We strip _normal to upgrade resolution.
      let profileImage = "";
      const pfpImg = $<HTMLImageElement>(
        'a[href$="/photo"] img, [data-testid^="UserAvatar-Container"] img'
      );
      if (pfpImg?.src) profileImage = pfpImg.src;
      if (!profileImage) profileImage = meta("og:image");
      profileImage = profileImage.replace(/_normal(\.[a-z]+)$/i, "$1");

      // ----- banner image -----
      // Banners render as <img> inside the /header_photo link, OR as a
      // background-image on a div. Try both.
      let bannerImage = "";
      const bannerImg = $<HTMLImageElement>('a[href$="/header_photo"] img');
      if (bannerImg?.src) {
        bannerImage = bannerImg.src;
      } else {
        // Hunt for the first pbs.twimg.com profile_banners URL on the page.
        const html = document.documentElement.outerHTML;
        const m = html.match(
          /https:\/\/pbs\.twimg\.com\/profile_banners\/[^\s"'<>]+/
        );
        if (m) bannerImage = m[0];
      }
      if (bannerImage && !/\/\d+x\d+$/.test(bannerImage)) {
        bannerImage = `${bannerImage}/1500x500`;
      }

      // ----- followers / following -----
      // The counts live in <a href="/<handle>/followers"><span>N</span> ...</a>.
      // Twitter abbreviates ("12.3M"); we'll parse on the server.
      const parseNearbyCount = (suffix: string): string => {
        const link = $<HTMLAnchorElement>(`a[href$="${suffix}"]`);
        if (!link) return "";
        // Numbers are usually in the first span with no aria-hidden parents.
        const num = $<HTMLElement>("span > span", link) ?? link;
        return text(num).split(" ")[0] ?? "";
      };
      const followersRaw =
        parseNearbyCount("/verified_followers") ||
        parseNearbyCount("/followers");
      const followingRaw = parseNearbyCount("/following");

      // ----- recent tweets -----
      // Each tweet is an <article data-testid="tweet">. Inside, the body
      // text is in [data-testid="tweetText"]. We dedupe and skip retweets
      // (those have a "<user> reposted" header above the tweet).
      const tweetEls = $$<HTMLElement>('article[data-testid="tweet"]');
      const seen = new Set<string>();
      const recentTweets: string[] = [];
      for (const t of tweetEls) {
        // Skip reposts — they're not the user's own voice.
        const socialContext = $('[data-testid="socialContext"]', t);
        if (socialContext) continue;

        // Skip replies — first child of article that says "Replying to ..."
        const replyingTo = Array.from(
          t.querySelectorAll<HTMLElement>("div, span")
        ).some((el) => /^Replying to /i.test((el.textContent ?? "").trim()));
        if (replyingTo) continue;

        const body = $<HTMLElement>('[data-testid="tweetText"]', t);
        const txt = text(body);
        if (!txt || seen.has(txt)) continue;
        seen.add(txt);
        recentTweets.push(txt);
        if (recentTweets.length >= 8) break;
      }

      return {
        displayName,
        username,
        bio,
        profileImage,
        bannerImage,
        followersRaw,
        followingRaw,
        recentTweets,
      };
    });

    if (!scraped.username) {
      throw new XScrapeError(
        "couldn't find a username on the page — handle may not exist or X is login-walling"
      );
    }

    return {
      handle: scraped.username.toLowerCase(),
      displayName: scraped.displayName || handle,
      bio: scraped.bio,
      pfpUrl: scraped.profileImage,
      bannerUrl: scraped.bannerImage,
      followers: parseAbbreviated(scraped.followersRaw),
      following: parseAbbreviated(scraped.followingRaw),
      joined: "",
      recentTweets: scraped.recentTweets,
    };
  } catch (e) {
    if (e instanceof XScrapeError) throw e;
    throw new XScrapeError(
      e instanceof Error ? e.message : "unknown scrape error",
      e
    );
  } finally {
    await context?.close().catch(() => {});
  }
}

// ---------- helpers ----------

// "12.3M" -> 12300000, "1,234" -> 1234, "" -> 0
function parseAbbreviated(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/,/g, "").trim().toLowerCase();
  const m = cleaned.match(/^([\d.]+)\s*([kmb])?/);
  if (!m) return 0;
  const n = parseFloat(m[1]!);
  if (Number.isNaN(n)) return 0;
  const mult: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
  return Math.round(n * (mult[m[2] ?? ""] ?? 1));
}
