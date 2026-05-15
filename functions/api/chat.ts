/**
 * Cloudflare Pages Function — POST /api/chat
 * Configure OPENROUTER_API_KEY in Pages → Settings → Environment variables.
 */
import {
  chatHandlerErrorBody,
  jsonCorsHeaders,
  methodNotAllowedErrorBody,
  parseJsonBodyText,
  processChatPost,
} from '../../server/chat';

type CfContext = {
  request: Request;
  env?: { OPENROUTER_API_KEY?: string };
};

export async function onRequest(context: CfContext): Promise<Response> {
  const cors = jsonCorsHeaders();

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify(methodNotAllowedErrorBody()), {
      status: 405,
      headers: cors,
    });
  }

  try {
    const parsed = parseJsonBodyText(await context.request.text());
    if (parsed.ok === false) {
      return new Response(JSON.stringify(parsed.body), {
        status: parsed.status,
        headers: cors,
      });
    }
    const origin = context.request.headers.get('Origin') || context.request.headers.get('Referer') || undefined;
    const key = context.env?.OPENROUTER_API_KEY;
    const result = await processChatPost(parsed.payload, origin, key);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: cors,
    });
  } catch {
    return new Response(JSON.stringify(chatHandlerErrorBody()), {
      status: 500,
      headers: cors,
    });
  }
}
