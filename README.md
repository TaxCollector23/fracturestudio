# Fracture Studio

**Argument Analysis Engine** — structured AI feedback for essays, briefs, speeches, and debate cases.

## Pages

| Page | File | Description |
|------|------|-------------|
| Landing | `public/index.html` | Hero, why us vs generic AI, features, how-it-works, testimonials |
| Studio | `public/studio.html` | Run a structured audit, inspect the argument map, verify sources, generate rapid rebuttals, and use Fracture Chat |
| Mission | `public/mission.html` | Our principles, transparency, the full system prompt |
| Settings | `public/settings.html` | Firebase sign-in, password reset, preferences, and saved work |
| Admin | `public/admin.html` | Private Firebase profile list for signed-in users |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Environment
This ZIP already includes the `.env` values restored from the uploaded project for local testing.

# 3. Start the server
npm start
# → http://localhost:8000
```

## Security Architecture

- **API key is server-side only.** `OPENROUTER_API_KEY` lives in `.env`, loaded by `dotenv`. It is never sent to the browser, never in any HTML/JS file, never in any response.
- All AI calls are proxied through server routes. The browser never receives the OpenRouter key.
- `/api/analyze` streams live report-generation events and returns a normalized JSON audit.
- `/api/chat` streams detailed plain-text Fracture Chat coaching with follow-up conversation context.
- `/api/rebuttal` streams rapid debate responses through the fast model.
- `/api/verify-sources` searches public pages, compares retrieved page text to draft claims, and builds a strong-match-only MLA 9th or APA 7th bibliography without fabricating entries.
- `/api/report-pdf` exports a formatted PDF report with the diagnosis, priority fixes, source-verification summary, bibliography, and submitted draft.
- Firebase Authentication sends free password-reset emails without a separate mail server.
- `/api/admin-users` reads Firebase profiles only after the server validates the admin password.
- Input is size-limited (50kb body, 40,000 char essay max) to prevent abuse.
- Static files are served from `public/` — no framework, no build step, no client-side secrets.

## Project Structure

```
fracture-studio/
├── src/
│   ├── server.js          # Express server and local route wiring
│   ├── prompts.js         # Centralized analysis, chat, and rebuttal prompts
│   ├── analyze-handler.js # Shared local/Vercel analysis stream
│   ├── text-stream-handler.js # Shared Fracture Chat and Speed Rebuttal stream
│   ├── source-verify.js   # Public-web claim/source triage and Works Cited builder
│   └── admin-users.js     # Server-only Firebase Admin profile lookup
├── public/
│   ├── index.html         # Landing page
│   ├── studio.html        # Analysis studio
│   ├── mission.html       # Mission & principles
│   ├── settings.html      # Account settings + forgot-password action
│   ├── admin.html         # Private account profile viewer
│   ├── style.css          # All styles (shared + per-page)
│   ├── shared.js          # Theme toggle, shared utilities
│   └── app.js             # Studio analysis logic
├── .env.example           # Environment variable template
├── .gitignore
└── package.json
```

## Analysis Output

Every audit generates a structured JSON report with:

- **Overall score** (1–100) + 4-dimensional breakdown (each /25)
- **Verdict** — one paragraph: persuasiveness, biggest strength, most urgent weakness
- **Coaching note** — single highest-leverage improvement action
- **Claim-by-claim analysis** — STRONG/MODERATE/WEAK ratings with named flaws and fixes
- **Assumption audit** — hidden premises with HIGH/MEDIUM/LOW load-bearing ratings
- **Logical fallacies** — named, quoted verbatim, explained, rewritten
- **Steelmanned counter-arguments** — strongest opposition + damage assessment
- **Rhetorical analysis** — hook, flow, best/worst sentence with rewrite
- **Rewrite suggestions** — complete sentences, not instructions


## Local start

Windows PowerShell may block `npm.ps1`. Use one of these instead:

```powershell
npm.cmd install
npm.cmd start
```

Or double-click `START-HERE-WINDOWS.cmd`. The local server defaults to `http://localhost:8000`.

This local package restores the `.env` values that existed in the uploaded ZIP. It also keeps Firebase browser auth wired. The uploaded ZIP did not contain a Firebase Admin service-account JSON, so the server-side admin user lookup still needs that credential if it was not already configured on your machine.
