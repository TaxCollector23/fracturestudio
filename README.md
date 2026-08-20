# Fracture Studio

Fracture Studio is an argument auditing tool built for anyone who writes to persuade. Paste in a speech, debate case, Model UN position paper, college essay, research paper, or any piece of writing, and the Fracture Engine returns a full analysis in under a minute.

Live at [fracturestudio.vercel.app](https://fracture-studio-v6-eta.vercel.app)

---

## What it does

You paste your writing. Fracture reads it, figures out what you are actually trying to argue, and tells you where it holds up and where it falls apart. The report covers the logical structure, the strength of individual claims, hidden assumptions the reader might reject, counterarguments a skilled opponent would raise, and a ranked list of fixes ordered by how much each one would improve the piece.

It also runs a source check — pulling public web results for the factual claims in your draft and flagging which ones have support, which ones are vague, and which ones need a citation before they can carry weight.

After the audit, you can ask follow-up questions in Fracture Chat, or generate a rebuttal plan if you are preparing for a live debate or presentation.

---

## Analysis modes

**Argument / Debate**
For debate cases, policy briefs, persuasive claims, and position papers. Grades claim-warrant-evidence-impact structure, burden of proof, hidden assumptions, and how well the argument would hold up under direct pressure.

**Speech / Presentation**
For pieces meant to be heard. Focuses on how clearly the argument lands for an audience — hook, signposting, pacing, memorable lines, and where a listener might tune out or push back.

**Essay / General Writing**
For academic and analytical writing. Covers thesis clarity, paragraph structure, transitions, tone, evidence integration, and how each section earns its place.

**Rubric Grading**
Paste in a rubric alongside your draft and Fracture grades criterion by criterion, estimates likely scores, and tells you exactly what would move each category up.

---

## Depth levels

**Surface** — a fast pass focused on the two or three things that matter most. Good for a quick check before submission.

**Medium** — the default. A full audit with claim analysis, assumption audit, counterarguments, source check, and a complete revision path.

**Extreme** — the deepest read. Eight or more priority fixes, a full dependency graph showing how claims connect, expanded attack tree, and additional argument angles to research.

---

## Pages

**Dashboard** — the “what should I do next” hub for signed-in users. Shows your latest score and trend, weakest and strongest skills, active goals with a rebuilt-every-visit 5-day training plan, explainable recommendations (each with a *why*), recent saved work, and quick actions. Guests get the same workspace with local-only storage.

**Studio** — where you run the audit. Paste your draft, choose a mode and depth, and read the report. Includes the argument map, source verification panel, Fracture Chat, and rebuttal builder. Drafts autosave locally so a refresh or a sign-in round-trip never loses your work, and you can rate each report (correct / partially correct / incorrect / not useful) or flag a specific problem.

**Practice** — the drill library: ten timed drills covering rebuttal, cross-examination, organization, evidence, argumentation, delivery, and prep. Each drill has instructions, a difficulty level, event relevance, a timer, optional AI-generated practice material, and a self-score that feeds back into your recommendations. Difficulty is recommended from your saved audit scores.

**Rebuttals** — opponent preparation with structured practice modes: coach, aggressive opponent, technical opponent, judge questioning, or a beginner walkthrough. The plan is built against the mode you pick.

**Past Work** — saved audits you can return to, each with a structured at-a-glance summary (top strengths / weaknesses) and a one-click “Continue in Studio”. Requires a free account.

**About** — explains how Fracture reads and scores writing, what each part of an argument is checked for, and links to the full documentation.

**Settings** — account preferences, role/event/focus profile, citation style (MLA or APA), feedback depth and tone defaults.

### Skill tracking & progress

Fracture derives a long-term performance profile from your saved audits — no generic AI memory. Each report is scored against a speech/debate skill taxonomy (argumentation, organization, clarity, rebuttal, evidence, persuasion, cross-examination, delivery, confidence, preparation, pacing, time management), and the dashboard aggregates those scores into trends: weakest and strongest categories, recently-improved skills, persistent weaknesses, and your most-practiced events. Skills that an audit has no signal for are never forced.

### Command palette & feedback

Press **⌘K / Ctrl+K** anywhere (or the Search button in the nav) for a command palette that jumps to pages, starts a new audit or goal, and searches your saved work, drills, and goals. A floating **Feedback** button opens a lightweight bug / confusing-feature / feature-request / incorrect-feedback reporter with captured context — the same channel the per-report rating widget feeds.

---

## Documentation

User and developer documentation lives at [the Fracture Studio docs](https://fracturestudio.mintlify.app), also reachable from the About page.

---

## Deploy your own

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- A [Vercel](https://vercel.com) account (free tier works)
- An [OpenRouter](https://openrouter.ai) API key
- (Optional) A [Firebase](https://console.firebase.google.com) project for authentication and saved work

### 1. Clone the repo

```bash
git clone https://github.com/TaxCollector23/fracturestudio.git
cd fracturestudio
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter API key |
| `OPENROUTER_MODEL` | Yes | Default analysis model (e.g. `openai/gpt-oss-120b`) |
| `PUBLIC_FIREBASE_API_KEY` | No | Firebase web config — needed for auth & saved work |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | No | Firebase auth domain |
| `PUBLIC_FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No | Firebase service account JSON (for admin page) |
| `FRACTURE_ADMIN_PASSWORD` | No | Password for the private admin page |

### 3. Deploy to Vercel

**Option A — Vercel CLI (recommended)**

```bash
npm i -g vercel
vercel login
vercel --prod
```

When prompted, select or create a project. The CLI auto-detects the correct settings from `vercel.json`.

**Option B — Git integration**

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import the GitHub repository.
4. Vercel picks up `vercel.json` automatically — no framework preset needed.
5. Add the same environment variables from step 2 in the Vercel dashboard under **Settings > Environment Variables**.
6. Deploy.

### 4. Local development

```bash
npm install
cp .env.example .env   # fill in your keys
cd app && npm install
```

Run both processes from the repo root:

```bash
# Terminal 1 — API backend + serverless routes (port 8000)
npm start

# Terminal 2 — React frontend with hot reload (port 4567)
cd app && npm run dev
```

Open **http://localhost:4567**. The Vite dev server proxies `/api/*` to the
backend on port 8000.

### Tests

Core logic (audit normalization, scoring invariants, claim extraction, and
frontend helpers) is covered by Vitest:

```bash
npm test            # run once
npm run test:watch  # watch mode
```

### Backend layout

`api/*.js` are thin adapters for Vercel serverless; the real logic lives in
`src/` and is shared with the Express dev server. Shared request limits and
error helpers live in `src/request-utils.js`; structured logging in
`src/logger.js`. Keep character limits and the `{ error }` response shape
consistent across all endpoints.

See `.local-dev/` for platform-specific setup scripts and notes.

---

## Project structure

```
├── api/                 # Vercel serverless functions (API routes)
├── app/                 # Vite + React frontend (built to app/dist)
│   ├── src/
│   ├── index.html
│   └── package.json
├── public/              # Static assets and legacy pages
├── src/                 # Shared server logic (used by api/ and local dev)
├── .env.example         # Environment variable template
├── vercel.json          # Vercel deployment config
└── package.json         # Root dependencies (firebase-admin, pdfkit, dotenv)
```

## License

Private — all rights reserved.
