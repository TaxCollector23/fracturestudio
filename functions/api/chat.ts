/**
 * Cloudflare Pages Function — POST /api/chat
 * Configure OPENROUTER_API_KEY in Pages → Settings → Environment variables.
 */
import { jsonCorsHeaders, processChatPost } from '../../server/chat';

type CfContext = {
  request: Request;
  env: { OPENROUTER_API_KEY?: string };
};

export async function onRequestPost(context: CfContext): Promise<Response> {
  const cors = jsonCorsHeaders();

  try {
    const payload = (await context.request.json()) as unknown;
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

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: jsonCorsHeaders() });
}
