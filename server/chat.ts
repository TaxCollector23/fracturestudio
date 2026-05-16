import { buildCitationReport, renderCitationReport } from '../src/lib/citationEngine';
import { analyzeArgument, renderFractureAnalysis } from '../src/lib/fractureEngine';
import { generateRebuttalReport } from '../src/lib/rebuttalEngine';

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };
export type ChatResult = { status: number; body: unknown };
export type ParsedJsonBody = { ok: true; payload: unknown } | { ok: false; status: number; body: { error: string; code: string } };

type OpenRouterShape = { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } | string };
const defaultModel = 'openai/gpt-oss-120b';
const defaultSpeedModel = 'meta-llama/llama-3.1-8b-instruct';

export function jsonCorsHeaders(): Record<string, string> {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
}
export function methodNotAllowedErrorBody() { return { error: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' }; }
export function chatHandlerErrorBody() { return { error: 'Chat handler failed. Try again or use the local Fracture engine.', code: 'HANDLER_ERROR' }; }
export function parseJsonBodyText(raw: string): ParsedJsonBody {
  if (!raw.trim()) return { ok: true, payload: {} };
  try { return { ok: true, payload: JSON.parse(raw) as unknown }; } catch { return { ok: false, status: 400, body: { error: 'Invalid JSON body.', code: 'INVALID_JSON' } }; }
}
export function extractAssistantText(data: unknown): string | null {
  const content = (data as OpenRouterShape)?.choices?.[0]?.message?.content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
}
export function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const messages = value.map((item) => {
    const role = (item as ChatMessage)?.role;
    const content = (item as ChatMessage)?.content;
    return (role === 'system' || role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim() ? { role, content: content.trim() } : null;
  }).filter(Boolean) as ChatMessage[];
  return messages.length ? messages : null;
}
export function stripClientSystemMessages(messages: ChatMessage[]): ChatMessage[] { return messages.filter((m) => m.role !== 'system'); }
function completion(content: string) { return { choices: [{ message: { content } }] }; }
function obj(payload: unknown): Record<string, unknown> | null { return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null; }
function str(payload: Record<string, unknown>, ...keys: string[]): string { for (const key of keys) { const value = payload[key]; if (typeof value === 'string') return value; } return ''; }
function actionFor(payload: Record<string, unknown>): string { return (str(payload, 'action') || (parseMessages(payload.messages) ? 'chat' : 'fracture')).toLowerCase(); }
function localFallback(payload: Record<string, unknown>, reason = 'no remote model configured'): string {
  const action = actionFor(payload);
  const text = str(payload, 'text', 'draft', 'claimText', 'sourcesText');
  if (action === 'citations' || action === 'citation') return `Local Fracture engine used because ${reason}.\n\n${renderCitationReport(buildCitationReport({ style: str(payload, 'style', 'citationStyle') || 'APA', sourcesText: text, claimText: str(payload, 'claimText') || text }))}`;
  if (action === 'rebuttals' || action === 'rebuttal') return `Local Fracture engine used because ${reason}.\n\n${generateRebuttalReport({ opponentText: str(payload, 'opponentText') || text, userCase: str(payload, 'userCase') || text, persona: 'logical' })}`;
  if (action === 'chat') {
    const messages = parseMessages(payload.messages) || [];
    const latest = [...messages].reverse().find((m) => m.role === 'user')?.content || text;
    return `Local Fracture engine used because ${reason}.\n\nFracture Chat answer: ${latest ? `focus on the exact claim in "${latest.slice(0, 180)}".` : 'paste a draft or ask a question first.'} Repair path: assertion, reasoning, evidence, impact. Add the warrant before polishing the wording.`;
  }
  return `Local Fracture engine used because ${reason}.\n\n${renderFractureAnalysis(analyzeArgument(text, { judgeMode: 'debate' }))}`;
}
function promptFor(payload: Record<string, unknown>): ChatMessage[] {
  const action = actionFor(payload);
  const text = str(payload, 'text', 'draft', 'claimText', 'sourcesText');
  const system = 'You are Fracture Chat, the flagship Fracture Studio argument model. Be direct, structured, and user-focused. Do not output JSON. Use markdown headings and bullets.';
  if (action === 'chat') return [{ role: 'system', content: system }, ...stripClientSystemMessages(parseMessages(payload.messages) || [])];
  if (action === 'citations' || action === 'citation') return [{ role: 'system', content: system }, { role: 'user', content: `Generate a human-readable citation report in ${str(payload, 'style', 'citationStyle') || 'APA'}. Include bibliography, in-text examples, citation-needed tags, source-to-claim verifier notes, hallucination checks, and freshness warnings.\n\n${text}` }];
  if (action === 'rebuttals' || action === 'rebuttal') return [{ role: 'system', content: system }, { role: 'user', content: `Build a debate rebuttal report with opponent attacks, responses, crossfire questions, and impact weighing.\n\nUser case:\n${text}\n\nOpponent text:\n${str(payload, 'opponentText') || text}` }];
  return [{ role: 'system', content: system }, { role: 'user', content: `Analyze this argument with the Fracture Method. Include verdict, scores, claim map, hidden assumptions, warrant gaps, collapse point, crossfire, model lenses, and revision missions.\n\n${text}` }];
}
async function callOpenRouter(payload: Record<string, unknown>, origin?: string, apiKey?: string): Promise<string | null> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = payload.speedMode ? process.env.OPENROUTER_SPEED_MODEL || defaultSpeedModel : process.env.OPENROUTER_MODEL || defaultModel;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': origin || 'http://localhost', 'X-Title': 'Fracture Studio' }, body: JSON.stringify({ model, messages: promptFor(payload), temperature: payload.speedMode ? 0.35 : 0.25, max_tokens: payload.speedMode ? 900 : 1800 }) });
  const raw = await response.text();
  let data: unknown = {};
  try { data = JSON.parse(raw) as unknown; } catch { throw new Error(`OpenRouter returned non-JSON text with HTTP ${response.status}.`); }
  if (!response.ok) { const err = (data as OpenRouterShape).error; throw new Error(typeof err === 'string' ? err : err?.message || `OpenRouter HTTP ${response.status}`); }
  const assistant = extractAssistantText(data);
  if (!assistant) throw new Error('remote model returned no assistant text');
  return assistant;
}
function validate(payload: Record<string, unknown>): ChatResult | null {
  const action = actionFor(payload);
  if ((action === 'citations' || action === 'citation') && !str(payload, 'text', 'sourcesText', 'claimText').trim()) return { status: 400, body: { error: 'Add source text, URLs, DOI values, or claim text before running citations.', code: 'VALIDATION' } };
  if ((action === 'fracture' || action === 'analyze') && !str(payload, 'text', 'draft').trim()) return { status: 400, body: { error: 'Paste a draft before running Fracture.', code: 'VALIDATION' } };
  return null;
}
export async function processChatPost(payload: unknown, origin?: string, apiKey?: string): Promise<ChatResult> {
  const body = obj(payload);
  if (!body) return { status: 400, body: { error: 'Request body must be a JSON object.', code: 'INVALID_BODY' } };
  const validation = validate(body);
  if (validation) return validation;
  try {
    const remote = await callOpenRouter(body, origin, apiKey);
    return { status: 200, body: completion(remote || localFallback(body, 'no remote model configured')) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'remote model failed';
    return { status: 200, body: completion(localFallback(body, reason)) };
  }
}
