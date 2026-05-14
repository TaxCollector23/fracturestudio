import type { Handler } from '@netlify/functions';
import { jsonCorsHeaders, processChatPost } from '../../server/chat';

export const handler: Handler = async (event) => {
  const cors = jsonCorsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: cors,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    let payload: unknown = {};
    if (event.body) {
      try {
        payload = JSON.parse(event.body) as unknown;
      } catch {
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: 'Invalid JSON body.', code: 'INVALID_JSON' }),
        };
      }
    }

    const origin = event.headers.origin || event.headers.referer;
    const result = await processChatPost(payload, origin);
    return {
      statusCode: result.status,
      body: JSON.stringify(result.body),
      headers: cors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reach OpenRouter.';
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
      headers: cors,
    };
  }
};
