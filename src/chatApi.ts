/** Base URL of the deployed site that hosts /api/chat (no trailing slash). Empty = same-origin. */
export function getChatApiUrl(): string {
  const raw = (import.meta.env.VITE_CHAT_API_BASE as string | undefined)?.trim();
  if (!raw) {
    return '/api/chat';
  }
  const base = raw.replace(/\/+$/, '');
  if (!base) {
    return '/api/chat';
  }
  if (base.endsWith('/api/chat')) {
    return base;
  }
  return `${base}/api/chat`;
}
