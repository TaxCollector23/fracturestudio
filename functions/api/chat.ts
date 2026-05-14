/**
 * Cloudflare Pages Function — POST /api/chat
 * Configure OPENROUTER_API_KEY in Pages → Settings → Environment variables.
 */
import { jsonCorsHeaders, processChatPost } from '../../server/chat';

type CfContext = {
  request: Request;
  env: { OPENROUTER_API_KEY?: string };
};

export async function onRequest(context: CfContext): Promise<Response> {
  const cors = jsonCorsHeaders();

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: cors,
    });
  }

  try {
    let payload: unknown = {};
    try {
      payload = (await context.request.json()) as unknown;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.', code: 'INVALID_JSON' }), {
        status: 400,
        headers: cors,
      });
    }
    const origin = context.request.headers.get('Origin') || undefined;
    const key = context.env.OPENROUTER_API_KEY;
    const result = await processChatPost(payload, origin, key);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: cors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat handler failed.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: cors,
    });
  }
}
