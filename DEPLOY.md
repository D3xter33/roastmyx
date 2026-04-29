# Deploying RoastMyX

The app uses Playwright + Chromium server-side, which rules out most serverless
platforms (Vercel default, Cloudflare Workers, Netlify Functions). Use a
container-friendly host instead. Three good options:

| platform | one-line pitch | cost |
|---|---|---|
| **Railway** | "Push to GitHub, click deploy, get a URL." Easiest. | ~$5/mo |
| **Fly.io** | "Run `fly launch` in your terminal, follow prompts." | ~$3/mo |
| **Render** | "Connect GitHub repo, get a public URL." Free tier sleeps after inactivity. | $0–$7 |

All three pick up the `Dockerfile` automatically — no extra config needed.

---

## Option A — Railway (recommended)

### 1. Push the project to GitHub

```bash
cd /Users/romanzaika/projects/RoastmyX
git init
git add .
git commit -m "initial roastmyx commit"
gh repo create roastmyx --private --source=. --remote=origin --push
```

(If you don't have `gh`, create the repo on github.com manually, then
`git remote add origin <url>` and `git push`.)

### 2. Connect Railway

1. Go to [https://railway.app](https://railway.app), sign in with GitHub.
2. Click **"New Project"** → **"Deploy from GitHub repo"** → pick `roastmyx`.
3. Railway sees the `Dockerfile`, starts building. First build takes ~6 minutes.
4. When the build finishes, click **Settings → Networking → Generate Domain**.
   You'll get a URL like `https://roastmyx-production.up.railway.app`.

### 3. Done

That's it. There are no environment variables to set (we don't use any third-party
APIs in the local-analyzer build). The app should respond at the generated URL
within a minute of the build finishing.

If a roast call hangs at 30+ seconds, Railway's container sometimes gets X
rate-limited the same way local dev does — just wait a few minutes and retry.

---

## Option B — Fly.io

```bash
brew install flyctl
cd /Users/romanzaika/projects/RoastmyX
fly launch
# Answer:
#   App name: roastmyx (or whatever)
#   Region: pick the closest one
#   PostgreSQL: no
#   Redis: no
#   Deploy now: yes
```

`fly launch` reads the Dockerfile, generates a `fly.toml`, and deploys. After
~5 minutes you get a URL like `https://roastmyx.fly.dev`.

To redeploy after code changes: `fly deploy`.

---

## Option C — Render

1. Push the repo to GitHub (same as the Railway step 1).
2. Go to [https://render.com](https://render.com) → **New → Web Service**.
3. Connect the repo. Render auto-detects the Dockerfile.
4. Pick the **Free** plan or **Starter** ($7/mo, doesn't sleep).
5. Click **Create Web Service**. ~5 minutes later you have a URL.

---

## Verify the deployment

Once you have a URL, smoke-test the API directly:

```bash
curl -s -X POST https://YOUR-URL.example.com/api/roast \
  -H "Content-Type: application/json" \
  -d '{"handle":"naval"}' | jq '.truth.archetype, .truth.verdictPercent'
```

Expected response: `"philosopher-king"` and a number in the 50–60 range.

If you see a 502 with `"couldn't read @naval"`, X has rate-limited the
deployment IP. Wait 5–10 minutes — it's IP-based, not account-based, and clears
on its own.

---

## Cost / scaling notes

- **Memory**: Chromium needs ~512 MB RAM. The base 512 MB tier on Railway/Fly
  is borderline; bump to 1 GB if you see OOM crashes. On Fly:
  `fly scale memory 1024`.
- **Cold starts**: A Chromium launch takes ~3 seconds. Repeat requests reuse
  the same browser instance (we cache it on `globalThis`), so subsequent
  scrapes are ~1 second. Cold starts after platform sleep can take ~10s.
- **X rate limits**: A single deployment IP will hit X's syndication wall after
  ~10–20 rapid requests. For real traffic you'll want either (a) a residential
  proxy in front of the scrape, or (b) horizontal scaling across multiple IPs.
  For a viral demo, the single-IP version is fine until your first traffic spike.

---

## Custom domain

All three platforms support custom domains — point a CNAME at the
platform-provided hostname and add the domain in the platform's UI:

- Railway: **Settings → Networking → Custom Domain**
- Fly: `fly certs add roastmyx.com`
- Render: **Settings → Custom Domains**

You'll get an automatic Let's Encrypt cert.
