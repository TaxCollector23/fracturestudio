import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { processChatPost } from './server/chat';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

function createLocalApiPlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url || '';
    if (!url.startsWith('/api/chat')) {
      next();
      return;
    }

    void (async () => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }

      try {
        const rawBody = await readBody(req);
        let payload: unknown = {};
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody) as unknown;
          } catch {
            sendJson(res, 400, { error: 'Invalid JSON body.', code: 'INVALID_JSON' });
            return;
          }
        }

        const origin = req.headers.origin || `http://${req.headers.host || 'localhost'}`;
        const result = await processChatPost(payload, origin);
        sendJson(res, result.status, result.body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Local API proxy failed.';
        sendJson(res, 500, { error: message });
      }
    })();
  };

  return {
    name: 'fracture-local-api',
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (!process.env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
  }

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), createLocalApiPlugin()],
  };
});
