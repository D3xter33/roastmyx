// src/lib/xFetcher.ts
// Server-only. Fetches a real X profile + recent tweets via the public
// syndication.twitter.com SSR endpoint. No auth required.
//
// The endpoint returns a Next.js-rendered HTML page with a __NEXT_DATA__ JSON
// blob that contains the full profile and ~100 recent tweets. We parse it,
// filter to original (non-reply, non-retweet) text, upgrade pfp + banner URLs
// to high-res, and return a clean XProfile.
//
// This breaks if X removes the endpoint. When that happens, swap the fetch
// implementation only — the XProfile shape is stable.

import "server-only";
import type { XProfile } from "./types";

const ENDPOINT = "https://syndication.twitter.com/srv/timeline-profile/screen-name/";

export class XFetchError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "XFetchError";
  }
}

export async function fetchXProfile(rawHandle: string): Promise<XProfile> {
  const handle = rawHandle.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    throw new XFetchError(`invalid handle: ${rawHandle}`);
  }

  const url = `${ENDPOINT}${encodeURIComponent(handle)}?showResponses=false&dnt=true`;
  const res = await fetch(url, {
    headers: {
      // Browser UA — syndication serves a different (smaller) payload to bots.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new XFetchError(`syndication returned ${res.status}`);
  }
  const html = await res.text();
  if (html.length < 5000) {
    throw new XFetchError("syndication returned an empty / blocked page");
  }

  return parseSyndicationHtml(html, handle);
}

// ---------------------------------------------------------------------------

interface NextData {
  props?: {
    pageProps?: {
      timeline?: { entries?: TimelineEntry[] };
      contextProvider?: unknown;
    };
  };
}

interface TimelineEntry {
  type?: string;
  content?: {
    tweet?: RawTweet;
  };
}

interface RawTweet {
  id_str?: string;
  full_text?: string;
  text?: string;
  in_reply_to_screen_name?: string | null;
  in_reply_to_status_id_str?: string | null;
  retweeted_status?: unknown;
  user?: RawUser;
  entities?: { urls?: { url: string; expanded_url: string }[] };
}

interface RawUser {
  screen_name?: string;
  name?: string;
  description?: string;
  profile_image_url_https?: string;
  profile_banner_url?: string;
  followers_count?: number;
  friends_count?: number;
  created_at?: string;
  verified?: boolean;
  is_blue_verified?: boolean;
  entities?: {
    description?: { urls?: { url: string; expanded_url: string }[] };
  };
}

function parseSyndicationHtml(html: string, handle: string): XProfile {
  const blob = extractNextDataBlob(html);
  if (!blob) throw new XFetchError("could not locate __NEXT_DATA__ in response");

  let data: NextData;
  try {
    data = JSON.parse(blob) as NextData;
  } catch (e) {
    throw new XFetchError("could not parse __NEXT_DATA__ JSON", e);
  }

  const entries = data.props?.pageProps?.timeline?.entries ?? [];
  const tweetObjs: RawTweet[] = [];
  let user: RawUser | undefined;

  for (const entry of entries) {
    const t = entry?.content?.tweet;
    if (!t) continue;
    if (!user && t.user) user = t.user;
    tweetObjs.push(t);
  }

  if (!user) throw new XFetchError("no profile data found for this handle");

  // Original tweets only — drop replies and retweets so we read the account's
  // own voice, not what they amplify.
  const own = tweetObjs.filter(
    (t) =>
      t.user?.screen_name?.toLowerCase() === handle &&
      !t.retweeted_status &&
      !t.in_reply_to_screen_name &&
      !t.in_reply_to_status_id_str
  );

  const recentTweets = own
    .slice(0, 12)
    .map((t) => expandUrls(t.full_text ?? t.text ?? "", t.entities?.urls))
    .filter(Boolean);

  return {
    handle: user.screen_name?.toLowerCase() ?? handle,
    displayName: user.name ?? handle,
    bio: expandUrls(user.description ?? "", user.entities?.description?.urls),
    pfpUrl: upgradePfpUrl(user.profile_image_url_https ?? ""),
    bannerUrl: upgradeBannerUrl(user.profile_banner_url ?? ""),
    followers: user.followers_count ?? 0,
    following: user.friends_count ?? 0,
    joined: user.created_at ?? "",
    recentTweets,
  };
}

function extractNextDataBlob(html: string): string | null {
  // The blob is JSON, so braces are balanced. Walk the string after the
  // opening tag and find the matching close — regex is unsafe for nested JSON.
  const marker = 'id="__NEXT_DATA__"';
  const tagStart = html.indexOf(marker);
  if (tagStart === -1) return null;

  const jsonStart = html.indexOf(">", tagStart);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = jsonStart + 1; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(jsonStart + 1, i + 1);
    }
  }
  return null;
}

// X serves a 48x48 thumbnail by default. Strip _normal to get the original.
function upgradePfpUrl(url: string): string {
  if (!url) return url;
  return url.replace(/_normal(\.[a-z]+)$/i, "$1");
}

// Banner URLs come without size suffix; append /1500x500 for high-res.
function upgradeBannerUrl(url: string): string {
  if (!url) return url;
  if (/\/\d+x\d+$/.test(url)) return url;
  return `${url}/1500x500`;
}

// Tweet bodies replace links with t.co shorteners. Substitute back the
// original URL so the model sees what the user actually shared.
function expandUrls(
  text: string,
  urls?: { url: string; expanded_url: string }[]
): string {
  if (!urls?.length) return text;
  let out = text;
  for (const { url, expanded_url } of urls) {
    out = out.split(url).join(expanded_url);
  }
  return out;
}
