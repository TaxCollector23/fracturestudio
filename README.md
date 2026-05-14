# Fracture Studio

**What it is:** A small React studio for drafting arguments and running **server-side** analysis through [OpenRouter](https://openrouter.ai/). Nothing ships your API key to the browser. The UI includes **Critique** (adversarial, structured feedback), **Citations** (bibliography + in-text helpers from pasted sources), and **Rebuttals** (claim-mapped counters and “if they say X, you say Y” cards).

**Who it is for:** Writers, debaters, and students who want pressure on their reasoning before an audience does.

---

## Decide in ~60 seconds

| You want…                         | This repo gives you…                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Local drafting + real model calls | `npm run dev` with `.env.local` and `OPENROUTER_API_KEY`                              |
| Hosted static UI + same-origin API | Netlify, Vercel, or Cloudflare Pages configs included                                |
| Static-only host (GitHub Pages)   | Build with `VITE_CHAT_API_BASE` pointing at a deployment that exposes `/api/chat`   |

Screenshots are optional; the product is the workspace flow and honest error text when the API fails.

---

## Quick start (local)

```powershell
cd path\to\FractureStudio
npm install
```

Create `.env.local` in the repo root:

```env
OPENROUTER_API_KEY=sk-or-...
```

Optional (only if the UI is served from a different origin than the API—for example GitHub Pages talking to Netlify):

```env
VITE_CHAT_API_BASE=https://your-deployed-site.example
```

Run:

```powershell
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Routes: **/** (marketing), **/studio/access** → **/studio/dashboard** → **/studio/case** (workspace). Also **/docs**, **/pricing**, **/changelog**, **/privacy**, **/methodology**, **/manifesto**.

Validate the project:

```powershell
npm run check
npm run test
```

(`check` runs TypeScript + production build. `test` runs Vitest against `server/chat.test.ts`.)

Preview the production bundle locally (includes the local `/api/chat` middleware):

```powershell
npm run build
npm run preview
```

---

## Deploy readiness (Phases B–D)

Ship when all of the following are green:

1. `npm run check` and `npm run test` pass in CI or locally.
2. `OPENROUTER_API_KEY` is set on the **server** environment for your host (not only in `.env.local`).
3. You hit **Run** once on Critique in the deployed preview (or `npm run preview` locally) and see real model text or a **readable** JSON error (not a silent failure).
4. For **GitHub Pages** or any static-only host, `VITE_CHAT_API_BASE` is set at build time to an origin that already serves `POST /api/chat` with CORS.

**Phase B (engine quality):** Server-side prompts, payload caps, structured `code` on errors (`OPENROUTER_KEY_MISSING`, `EMPTY_COMPLETION`, `VALIDATION`, etc.), empty upstream completions normalized to HTTP 502 with a clear message. UI uses `ChatRequestError` + alert panel for failures.

**Phase C (product expansion):** Routed marketing + legal-style pages, studio deep links, Vitest coverage for the chat engine.

**Phase D (shell):** There was no `redesign-for-rangan` folder in-tree; the **primary shell** is now this router + layouts. When a redesign lands, follow `docs/MERGE_REDESIGN.md`.

---

## Environment variables

| Variable                 | Where        | Required | Purpose |
| ------------------------ | ------------ | -------- | ------- |
| `OPENROUTER_API_KEY`     | Server / CI | **Yes** on any host that runs `/api/chat` | OpenRouter bearer token. Never expose to the client. |
| `VITE_CHAT_API_BASE`     | Build-time   | No       | Full site origin (no trailing slash) for the deployment that serves `/api/chat`. Empty = same-origin `fetch('/api/chat')`. Use when the static app and API live on different domains (e.g. GitHub Pages → Netlify API). |

See `.env.example`.

---

## API contract (single route)

**URL:** `POST /api/chat`  
**Body (JSON):**

- **Critique (default)**  
  `{ "action": "critique", "messages": [ { "role": "user", "content": "..." } ] }`  
  Omit `"action"` to default to critique. Any client `system` messages are **removed**; the **system prompt is enforced on the server**.

- **Citations**  
  `{ "action": "citations", "citationStyle": "APA" | "MLA" | string, "sourcesText": "..." }`

- **Rebuttals**  
  `{ "action": "rebuttals", "opponentText": "...", "userCase": "..." }`

**Responses:** Same shape as OpenRouter’s chat completions on success (`choices[0].message.content`). Errors: JSON `{ "error": "human readable string", "code"?: "MACHINE_CODE" }` with appropriate HTTP status.

**CORS:** Handlers send `Access-Control-Allow-Origin: *` so a static site on another domain can call your hosted API if you set `VITE_CHAT_API_BASE`.

---

## Deploy

### Netlify (static + Functions)

Already wired in `netlify.toml`:

- Build: `npm run build`
- Publish: `dist`
- Functions: `netlify/functions` → `/.netlify/functions/chat`, rewritten from `/api/chat`

In the UI: **Site settings → Environment variables →** add `OPENROUTER_API_KEY`.

`public/_redirects` is copied into `dist` for SPA fallback alongside Netlify’s `[[redirects]]`.

### Vercel

- Root directory: repo root  
- Build: `npm run build`  
- Output: Vite default static output; serverless API: `api/chat.ts`  
- Env: `OPENROUTER_API_KEY`

`vercel.json` rewrites `/api/*` to serverless routes and sends other paths to `index.html`.

### Cloudflare Pages

1. Build command: `npm run build`  
2. Build output directory: `dist`  
3. Add **Pages → Functions** support by keeping `functions/api/chat.ts` in the repo.  
4. Set secret `OPENROUTER_API_KEY` for Production (and Preview if needed).

Optional local preview of the built site + functions:

```powershell
npm run build
npx wrangler pages dev dist
```

`wrangler.toml` sets `pages_build_output_dir = "dist"` for consistency with Wrangler projects.

### GitHub Pages (static only)

There is **no** serverless runtime on GitHub Pages. Do one of the following:

1. Deploy the **same** full stack to Netlify/Vercel/Cloudflare and use that URL only, **or**  
2. Deploy **static** Pages from this repo but host `/api/chat` on Netlify/Vercel/Cloudflare, then set the repository secret `VITE_CHAT_API_BASE` to that API site’s origin before build.

Workflow: `.github/workflows/github-pages.yml` runs `npm run build:github-pages` (build + `dist/404.html` copy for SPA routing). Enable **GitHub Pages** from GitHub Actions in the repo settings.

**Project pages** (`https://user.github.io/repo/`): if asset URLs break, set Vite `base: '/repo-name/'` in `vite.config.ts` (currently `base: './'` for portable static hosting).

---

## Troubleshooting

| Symptom | Likely cause | What to do |
| ------- | ------------- | ---------- |
| **401** from OpenRouter | Bad or revoked key | Rotate `OPENROUTER_API_KEY`; redeploy; check for stray spaces in env. |
| **404** on `/api/chat` | Static host without functions or wrong rewrite | Use Netlify/Vercel/CF as documented; for Pages-only, point `VITE_CHAT_API_BASE` at a host that implements `/api/chat`. |
| **500** `OPENROUTER_API_KEY is not configured` | Missing server env | Set the variable on the **server** (Netlify/Vercel/CF), not only in `.env.local` used at build time. |
| **502** `EMPTY_COMPLETION` | Upstream returned 200 but no assistant text | Retry; shorten input; confirm `OPENROUTER_MODEL` in `server/chat.ts` is available on OpenRouter. |
| **CORS** errors | Rare for same-origin; cross-origin without CORS | This repo adds permissive CORS on API responses; ensure you are hitting the correct URL. |
| Empty model text | Upstream returned no assistant message | Retry; check OpenRouter status; try a shorter input. |
| `Invalid JSON body` | Malformed POST body | Send `Content-Type: application/json` and valid JSON. |

---

## Repo map (~10 lines)

1. `src/` — React UI, `react-router-dom` routes in `src/router.tsx`, pages under `src/pages/`, `SiteNav`, `MarketingLayout`.  
2. `server/chat.ts` — Shared OpenRouter client, **system prompts**, `processChatPost`, CORS helpers.  
3. `vite.config.ts` — Vite + **local dev/preview** middleware for `POST /api/chat`.  
4. `api/chat.ts` — **Vercel** serverless handler.  
5. `netlify/functions/chat.ts` — **Netlify** function handler.  
6. `functions/api/chat.ts` — **Cloudflare Pages** function for `/api/chat`.  
7. `public/` — Static assets copied to `dist` (`_redirects` for SPA hosts).  
8. `scripts/copy-spa-fallback.cjs` — Writes `dist/404.html` for GitHub Pages.  
9. `netlify.toml` / `vercel.json` / `wrangler.toml` — Host-specific routing and build dirs.  
10. `.github/workflows/github-pages.yml` — Optional static deploy (runs `npm run test` then `build:github-pages`).  
11. `docs/MERGE_REDESIGN.md` — Checklist when importing an external redesign package.

---

## Suggested next improvements (not implemented here)

- **Tests:** Playwright smoke for “Run” + mocked `POST /api/chat`, or MSW in Vitest.  
- **Rate limiting / auth:** If you expose a public API, add a gateway or token so OpenRouter is not abused.  
- **`redesign-for-rangan`:** Not included in this tree. Use `docs/MERGE_REDESIGN.md` after you add the package.  
- **Lint/format:** ESLint + Prettier in CI when you are ready for the extra dependency.

---

## License

Private / your choice—`package.json` has `"private": true`.
