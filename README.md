# Fracture Studio

Fracture Studio is an argument operating system for writing, debate, speech delivery, research, citations, rebuttals, and revision missions.

Core promise: Find where your argument breaks before someone else does.

## Run locally

npm install
npm run dev

## Build and test

npm run lint
npm run test
npm run build

## API

The UI posts to /api/chat. In dev and preview, Vite serves the endpoint through server/chat.ts. Vercel uses api/chat.ts, Netlify uses netlify/functions/chat.ts, and Cloudflare Pages uses functions/api/chat.ts.

Actions supported: fracture, chat, citations, and rebuttals. If OpenRouter is not configured or fails, the endpoint returns a clean local-engine fallback instead of a raw API error.
