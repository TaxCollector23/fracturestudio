# Purple Codex UI snapshot

This directory contains the self-contained purple Fracture Studio build.

## Run locally

```powershell
npm install
npm start
```

The Node server serves the static interface and the API routes for analysis, source verification, and browser-safe Firebase configuration.

## Included

- Purple Fracture Studio landing page and Studio interface.
- Analysis and source-verification API routes.
- Firebase Authentication browser adapter for Google and email sign-in.
- Firestore security rules for private per-user saved work.
- Blog, mission, settings, and supporting pages.

## Excluded

- Local `.env` secrets.
- Local PocketBase data.
- Downloaded binaries.
- Log files and installed dependencies.
