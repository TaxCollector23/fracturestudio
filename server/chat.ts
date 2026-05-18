import { buildCitationReport, renderCitationReport } from '../src/lib/citationEngine';
import { analyzeArgument, renderFractureAnalysis, type JudgeMode } from '../src/lib/fractureEngine';
import { toPlainText } from '../src/lib/plainText';
import { generateRebuttalReport } from '../src/lib/rebuttalEngine';
import https from 'node:https';

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };
export type ChatResult = { status: number; body: unknown };
export type ParsedJsonBody = { ok: true; payload: unknown } | { ok: false; status: number; body: { error: string; code: string } };

type OpenRouterShape = { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } | string };
type RuntimeEnv = {
  NODE_ENV?: string;
  OPENROUTER_ALLOW_INSECURE_TLS?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_SPEED_MODEL?: string;
  OPENROUTER_MODEL?: string;
};
type MinimalHttpResponse = { ok: boolean; status: number; text: () => Promise<string> };
const defaultModel = 'openai/gpt-oss-120b';
const defaultSpeedModel = 'meta-llama/llama-3.1-8b-instruct';
const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

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
function completion(content: string) { return { choices: [{ message: { content: toPlainText(content) } }] }; }
function obj(payload: unknown): Record<string, unknown> | null { return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null; }
function str(payload: Record<string, unknown>, ...keys: string[]): string { for (const key of keys) { const value = payload[key]; if (typeof value === 'string') return value; } return ''; }
function actionFor(payload: Record<string, unknown>): string { return (str(payload, 'action') || (parseMessages(payload.messages) ? 'chat' : 'fracture')).toLowerCase(); }
function judgeModeFor(payload: Record<string, unknown>): JudgeMode {
  const mode = str(payload, 'mode', 'judgeMode').toLowerCase();
  return mode === 'teacher' || mode === 'debate' || mode === 'historian' || mode === 'professor' || mode === 'reader' ? mode : 'reader';
}
function localFallback(payload: Record<string, unknown>, reason = 'no remote model configured'): string {
  const action = actionFor(payload);
  const text = str(payload, 'text', 'draft', 'claimText', 'sourcesText');
  if (action === 'citations' || action === 'citation') return `Local Fracture engine used because ${reason}.\n\n${renderCitationReport(buildCitationReport({ style: str(payload, 'style', 'citationStyle') || 'APA', sourcesText: text, claimText: str(payload, 'claimText') || text }))}`;
  if (action === 'speed-rebuttal' || action === 'speed' || action === 'rapid') {
    return `Local Fracture engine used because ${reason}.\n\nReal Speed Mode Debate Assistant\n\n10-second answer\nTheir claim is not proven yet. Answer the warrant first, then weigh probability.\n\n30-second answer\nThey have a claim, but the warrant is doing all the work. Ask what evidence proves the mechanism, then explain that your side outweighs because it has a clearer path from claim to impact.\n\n2-minute rebuttal\nJudge, this response should collapse to the warrant. They have not proven that their evidence actually causes the impact they claim. Even if the claim is possible, possible is not enough to decide the round. We win the comparison because our side has a clearer mechanism, lower assumption risk, and better weighing on probability and timeframe.\n\nCrossfire question\nWhat evidence proves the claim instead of only making it sound plausible?\n\nWeighing line\nWe outweigh on probability and clarity because our warrant is more direct.\n\nRisk warning\nDo not answer speed with more assertion. Give one warrant and one weighing line.`;
  }
  if (action === 'rebuttals' || action === 'rebuttal') return `Local Fracture engine used because ${reason}.\n\n${generateRebuttalReport({ opponentText: str(payload, 'opponentText') || text, userCase: str(payload, 'userCase') || text, persona: 'logical' })}`;
  if (action === 'chat') {
    const messages = parseMessages(payload.messages) || [];
    const latest = [...messages].reverse().find((m) => m.role === 'user')?.content || text;
    return `Local Fracture engine used because ${reason}.\n\nFracture Chat answer: ${latest ? `focus on the exact claim in "${latest.slice(0, 180)}".` : 'paste a draft or ask a question first.'} Repair path: assertion, reasoning, evidence, impact. Add the warrant before polishing the wording.`;
  }
  return `Local Fracture engine used because ${reason}.\n\n${renderFractureAnalysis(analyzeArgument(text, { judgeMode: judgeModeFor(payload) }))}`;
}
function promptFor(payload: Record<string, unknown>): ChatMessage[] {
  const action = actionFor(payload);
  const text = str(payload, 'text', 'draft', 'claimText', 'sourcesText');
  const system = 'You are Fracture Chat, the flagship Fracture Studio argument model. Be direct, structured, and user-focused. Do not output JSON. Do not use markdown headings, markdown tables, bold markers, or emoji. Use plain text section labels and concise numbered lines.';
  if (action === 'chat') return [{ role: 'system', content: system }, ...stripClientSystemMessages(parseMessages(payload.messages) || [])];
  if (action === 'citations' || action === 'citation') return [{ role: 'system', content: system }, { role: 'user', content: `Generate a human-readable citation report in ${str(payload, 'style', 'citationStyle') || 'APA'}. Include bibliography, in-text examples, citation-needed tags, source-to-claim verifier notes, hallucination checks, and freshness warnings.\n\n${text}` }];
  if (action === 'speed-rebuttal' || action === 'speed' || action === 'rapid') return [{ role: 'system', content: system }, { role: 'user', content: `You are in Speed Mode for a live debate. Use the fastest useful output. Do not produce a long report. Produce exactly these plain text sections: 10-second answer, 30-second answer, 2-minute rebuttal, crossfire question, weighing line, risk warning.\n\nUser case:\n${text}\n\nOpponent text:\n${str(payload, 'opponentText') || text}` }];
  if (action === 'rebuttals' || action === 'rebuttal') return [{ role: 'system', content: system }, { role: 'user', content: `Build a debate rebuttal report with opponent attacks, responses, crossfire questions, and impact weighing.\n\nUser case:\n${text}\n\nOpponent text:\n${str(payload, 'opponentText') || text}` }];
  return [{ role: 'system', content: system }, { role: 'user', content: `Analyze this argument with Fracture Method Report v2. Use the Fracture 0-100 scale only. Do not switch to a 1-10 scale. Score how well the piece survives pressure for its genre: personal essays may use concrete lived experience and reflection as evidence, while debate/policy cases need external evidence and rebuttal readiness. Use this structure in plain text: verdict, score, why it got that score, top weaknesses, argument graph, model findings, opponent attacks, source problems, revision missions. Name what each model found, including Toulmin, Rogerian, Monroe, Stock Issues, and Burden of Proof.\n\n${text}` }];
}
function envValue(key: keyof RuntimeEnv): string | undefined {
  const env = (globalThis as { process?: { env?: RuntimeEnv } }).process?.env;
  const value = env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
async function callOpenRouter(payload: Record<string, unknown>, origin?: string, apiKey?: string): Promise<string | null> {
  const key = apiKey?.trim() || envValue('OPENROUTER_API_KEY');
  if (!key) return null;
  const model = payload.speedMode ? envValue('OPENROUTER_SPEED_MODEL') || defaultSpeedModel : envValue('OPENROUTER_MODEL') || defaultModel;
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': origin || 'http://localhost', 'X-Title': 'Fracture Studio' };
  const body = JSON.stringify({ model, messages: promptFor(payload), temperature: payload.speedMode ? 0.35 : 0.25, max_tokens: payload.speedMode ? 900 : 1800 });
  const response = await postOpenRouterJson(openRouterUrl, headers, body);
  const raw = await response.text();
  let data: unknown = {};
  try { data = JSON.parse(raw) as unknown; } catch { throw new Error(`OpenRouter returned non-JSON text with HTTP ${response.status}.`); }
  if (!response.ok) { const err = (data as OpenRouterShape).error; throw new Error(typeof err === 'string' ? err : err?.message || `OpenRouter HTTP ${response.status}`); }
  const assistant = extractAssistantText(data);
  if (!assistant) throw new Error('remote model returned no assistant text');
  return assistant;
}

async function postOpenRouterJson(url: string, headers: Record<string, string>, body: string): Promise<MinimalHttpResponse> {
  try {
    return await fetch(url, { method: 'POST', headers, body });
  } catch (error) {
    if (!shouldRetryWithoutLocalTlsVerification(error)) {
      throw error;
    }

    return postJsonWithNodeHttps(url, headers, body);
  }
}

function shouldRetryWithoutLocalTlsVerification(error: unknown): boolean {
  if (envValue('OPENROUTER_ALLOW_INSECURE_TLS') !== '1' && envValue('NODE_ENV') === 'production') {
    return false;
  }

  return /fetch failed|certificate|ssl|tls|unable to verify|self-signed|partialchain/i.test(describeError(error));
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause instanceof Error ? ` ${error.cause.message}` : '';
  return `${error.name} ${error.message}${cause}`;
}

function postJsonWithNodeHttps(urlString: string, headers: Record<string, string>, body: string): Promise<MinimalHttpResponse> {
  const target = new URL(urlString);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        port: target.port || 443,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode || 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => text,
          });
        });
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
