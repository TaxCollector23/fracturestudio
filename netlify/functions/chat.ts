import type { Handler } from '@netlify/functions';
import { parseMessages, requestOpenRouter } from '../../server/chat';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}') as { messages?: unknown };
    const messages = parseMessages(payload.messages);

    if (!messages) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body must include a non-empty messages array.' }),
      };
    }

    const result = await requestOpenRouter(messages, event.headers.origin || event.headers.referer);
    return {
      statusCode: result.status,
      body: JSON.stringify(result.body),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reach OpenRouter.';
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};
