# Fracture Studio Final

Argument-audit web app with an Express server-side proxy for OpenRouter. The browser never receives the API key.

## Required environment variables

```env
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=openai/gpt-oss-120b:free
SITE_URL=https://your-render-url.onrender.com
```

Optional:

```env
OPENROUTER_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
```

## Local run

```bash
npm ci
npm start
```

Then open:

```txt
http://localhost:3000
```

## Render deploy

Use **New → Web Service**, not Static Site.

Recommended settings:

```txt
Root Directory: leave blank if package.json is at repo root
Build Command: npm ci
Start Command: npm start
```

Add these Render environment variables:

```txt
NODE_VERSION=20
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-oss-120b:free
SITE_URL=https://your-service-name.onrender.com
```

If your GitHub repo has this project inside a subfolder, set **Root Directory** to that subfolder. Render must run from the folder that contains `package.json`.

## Why the previous Render deploy likely failed

The uploaded zip originally contained a nested project folder. If that folder was committed to GitHub as a subfolder, Render ran `yarn` at the repository root instead of the app root. That produces a successful-looking install but `yarn start` fails because the real `package.json` is not in the working directory.

This version is intended to be uploaded with `package.json`, `src/`, `public/`, and `api/` at the repository root.

## Structure

```txt
package.json
render.yaml
src/server.js
public/index.html
public/studio.html
public/mission.html
public/style.css
public/shared.js
public/app.js
api/analyze.js
```
