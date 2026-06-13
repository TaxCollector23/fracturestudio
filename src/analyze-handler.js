// analyze-handler.js — Fracture Studio v6.0

import { DEFAULT_MODEL, buildServiceFallbackAudit, buildTooThinAudit, isTooThinForAudit, prepareAuditFromModelText } from './audit-utils.js';
import { buildAuditMessages } from './prompts.js';
import { collectTextFromOpenRouter, openRouterStream } from './openrouter.js';
import { startSse, writeDone, writeSse } from './sse-utils.js';

const PROGRESS_MESSAGES = [
  'Preparing the audit', 'Checking your claims', 'Finding the thesis',
  'Mapping evidence to claims', 'Testing warrant strength', 'Looking for hidden assumptions',
  'Checking causation links', 'Finding the collapse point', 'Building counterarguments',
  'Stress-testing the logic', 'Scoring argument strength', 'Scoring evidence quality',
  'Scoring rhetorical control', 'Finding missing arguments', 'Preparing your Fracture report'
];

function writeProgress(res, progress, message) {
  writeSse(res, { fracture_progress: { progress, message } });
}

function buildReadableSections(audit) {
  const sections = [];
  const s = audit || {};
  const scores = s.score_breakdown || {};

  sections.push({
    title: 'Verdict',
    body: `Overall Score: ${s.overall_score ?? '—'}/100\n${s.verdict || 'Analysis complete.'}`
  });

  sections.push({
    title: 'Score Breakdown',
    body: [
      `Argument Strength: ${scores.argument_strength ?? '—'}/25`,
      `Assumption Safety: ${scores.assumption_audit ?? '—'}/25`,
      `Logic: ${scores.logic ?? '—'}/25`,
      `Rhetoric: ${scores.rhetoric ?? '—'}/25`,
      `Source Quality: ${scores.source_quality ?? '—'}/10`
    ].join('\n')
  });

  const thesis = s.thesis_check || {};
  if (thesis.quote || thesis.assessment) {
    sections.push({
      title: 'Thesis Check',
      body: [thesis.quote && `Thesis: "${thesis.quote}"`, thesis.assessment, thesis.improvement && `Improvement: ${thesis.improvement}`].filter(Boolean).join('\n')
    });
  }

  const claims = Array.isArray(s.claims) ? s.claims.slice(0, 4) : [];
  if (claims.length) {
    sections.push({
      title: 'Claims Analysis',
      body: claims.map((c, i) => `Claim ${i+1} [${c.rating || 'WEAK'}]: "${(c.quote || '').slice(0, 100)}..."\n→ ${c.diagnosis || ''}`).join('\n\n')
    });
  }

  const gaps = Array.isArray(s.attackable_gaps) ? s.attackable_gaps.slice(0, 3) : [];
  if (gaps.length) {
    sections.push({
      title: 'Attackable Gaps',
      body: gaps.map((g, i) => `Gap ${i+1}: ${g.gap || ''}\nWhy vulnerable: ${g.why_vulnerable || ''}`).join('\n\n')
    });
  }

  const extras = Array.isArray(s.extra_arguments) ? s.extra_arguments.slice(0, 3) : [];
  if (extras.length) {
    sections.push({
      title: 'Missing Arguments',
      body: extras.map((e, i) => `Extra Argument ${i+1}: ${e.argument || ''}\nWhy important: ${e.why_important || ''}`).join('\n\n')
    });
  }

  const fixes = Array.isArray(s.priority_fixes) ? s.priority_fixes.slice(0, 4) : [];
  if (fixes.length) {
    sections.push({
      title: 'Priority Fixes',
      body: fixes.map((f, i) => `Fix ${i+1}: ${f.problem || ''}\n${f.exact_fix ? `→ ${f.exact_fix}` : ''}`).join('\n\n')
    });
  }

  return sections.filter(s => s.body && s.body.trim());
}

async function finish(res, audit, recovered = false) {
  writeProgress(res, recovered ? 91 : 90, 'Preparing the readable report');
  writeSse(res, { fracture_report_start: true });
  const sections = buildReadableSections(audit);
  for (const section of sections) {
    writeSse(res, { fracture_report_delta: section });
    await new Promise(r => setTimeout(r, 15));
  }
  writeSse(res, { fracture_report_done: true });
  writeProgress(res, 96, 'Finalizing');
  writeSse(res, { fracture_audit: audit });
  writeSse(res, { fracture_normalized_json: JSON.stringify(audit, null, 2) });
  writeProgress(res, 100, 'Report ready');
  writeDone(res);
}

export async function handleAnalyze(req, res) {
  if (req.method && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const essay = typeof req.body?.essay === 'string' ? req.body.essay.trim() : '';
  if (!essay) return res.status(400).json({ error: 'Paste an argument before using Fracture.' });
  if (essay.length > 40000) return res.status(400).json({ error: 'Draft exceeds the 40,000 character limit.' });

  startSse(res);
  writeProgress(res, 4, PROGRESS_MESSAGES[0]);

  if (isTooThinForAudit(essay)) {
    writeProgress(res, 38, 'Checking for a complete argument');
    return await finish(res, buildTooThinAudit(essay));
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return await finish(res, buildServiceFallbackAudit(essay, 'OPENROUTER_API_KEY is not configured'), true);
  }

  let upstream;
  try {
    writeProgress(res, 10, 'Connecting to Fracture AI');
    upstream = await openRouterStream({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: buildAuditMessages(essay, req.body?.preferences),
      referer: 'https://fracturestudio.vercel.app'
    });
  } catch (err) {
    return await finish(res, buildServiceFallbackAudit(essay, `Failed to reach AI: ${err?.message || String(err)}`), true);
  }

  writeProgress(res, 18, 'Reading the live model stream');
  let rawText = '';
  let lastProgress = 18;
  let msgIndex = 2;
  try {
    rawText = await collectTextFromOpenRouter(upstream, (delta, length) => {
      writeSse(res, { fracture_model_delta: delta });
      const nextProgress = Math.min(80, 18 + Math.floor(length / 400));
      if (nextProgress >= lastProgress + 3) {
        lastProgress = nextProgress;
        msgIndex = (msgIndex + 1) % PROGRESS_MESSAGES.length;
        writeProgress(res, nextProgress, PROGRESS_MESSAGES[msgIndex]);
      }
    });
  } catch (err) {
    return await finish(res, buildServiceFallbackAudit(essay, err?.message || String(err)), true);
  }

  writeProgress(res, 86, 'Validating the report structure');
  const { audit, recovered } = prepareAuditFromModelText(rawText, essay);
  return await finish(res, audit, recovered);
}
