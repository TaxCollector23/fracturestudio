# How to restore the v6 engine while keeping the current UI

This repo cleanly separates the **engine** (the Node analysis backend) from the
**UI** (the browser frontend). Use this guide to swap the engine back to the
version-6 zip without losing any of the design work.

## What counts as the UI (keep all of this)

Every UI/design change lives in the `public/` folder. Do **not** overwrite it.
The specific changes made on top of v6 are:

1. **Fonts** — the entire site uses **Geist** for all text (body, buttons,
   labels, and report output). Only headings remain bold. Defined by the
   `--sans`, `--serif`, and `--mono` CSS variables in
   `public/professional.css` and `public/style.css`, plus their Google Fonts
   `@import`.
2. **Light mode** — pure white background, pure black text (no grays), black
   as the primary accent, and a dark blue as the secondary accent. Defined in
   the `[data-theme="light"]` blocks of `public/professional.css` and
   `public/style.css`.
3. **Buttons** — studio buttons have a blue border, clean medium-weight text,
   no link underline, and a small hover lift. Defined in the `.btn-sm`,
   `.btn-secondary`, and `.btn-primary` rules in `public/professional.css`.
4. **Motion** — smooth hover transitions on cards, buttons, and links; cards
   lift and lighten their border on hover; live status dots pulse; report
   sections fade in. Appended at the end of `public/professional.css` and
   driven by the reveal logic in `public/shared.js`.

## What counts as the engine (restore this from the v6 zip)

The engine is the `src/` folder **except `src/server.js`**. That is:
`prompts.js`, `analyze-handler.js`, `source-verify.js`, `audit-utils.js`,
`openrouter.js`, `text-stream-handler.js`, `sse-utils.js`, `report-pdf.js`,
`admin-users.js`, and `public-config.js`.

Keep the current `src/server.js` — it holds the absolute-path `.env` loader and
the page routing (About page, docs redirect) that the UI relies on. The v6
zip's `server.js` would undo both.

## Restore procedure

1. Unzip the v6 file to a temporary folder.
2. Copy every `*.js` file from the zip's `src/` into this repo's `src/`
   **except `server.js`** (leave the existing `server.js` in place).
3. Open `src/audit-utils.js` and **delete this line if present**:
   ```js
   export { AUDIT_SYSTEM_PROMPT as SYSTEM_PROMPT } from "./prompts.js";
   ```
   The v6 `prompts.js` does not export `AUDIT_SYSTEM_PROMPT`, so this line
   crashes the module on load. Removing it is required.
4. Leave the entire `public/` folder untouched.
5. Verify the engine loads and the server boots:
   ```bash
   node -e "import('./src/audit-utils.js').then(()=>console.log('engine OK'))"
   npm start
   ```
6. Commit and deploy.

Note: the v6 engine uses the free model `openai/gpt-oss-120b:free` by default.
To make analysis stronger without code changes, set the `OPENROUTER_MODEL`
environment variable to a more capable model.
