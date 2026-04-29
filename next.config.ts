import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // 'standalone' produces a self-contained .next/standalone directory with only
  // the runtime files needed to serve the app — perfect for slim Docker images.
  // Without this, the production image has to ship the entire node_modules tree.
  output: "standalone",
  // Playwright bundles a Chromium binary + native node modules; Next must not
  // try to webpack/turbopack them.
  serverExternalPackages: ["playwright", "playwright-core"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
};

export default config;
