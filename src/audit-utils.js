// audit-utils.js — Fracture Studio v6.0

export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export function isTooThinForAudit(essay) {
  return !essay || essay.trim().split(/\s+/).length < 25;
}

export function buildTooThinAudit(essay) {
  return {
    overall_score: 5,
    verdict: 'This draft is too short to audit. Fracture needs at least 25 words with a clear claim, evidence, and reasoning to run a meaningful analysis.',
    score_breakdown: { argument_strength: 1, assumption_audit: 1, logic: 1, rhetoric: 1, source_quality: 1 },
    thesis_check: { quote: '', is_arguable: false, burden_of_proof: 'Cannot be determined', assessment: 'No thesis found.', improvement: '' },
    claims: [],
    attackable_gaps: [],
    rebuttal_prep: { strongest_rebuttal: { attack: 'No argument to attack.', targets: 'N/A', how_to_answer: 'Add more content.', evidence_to_block_it: [] }, easiest_rebuttal: { attack: 'N/A', why_easy: 'N/A', how_to_answer: 'N/A' }, sneakiest_rebuttal: { attack: 'N/A', why_sneaky: 'N/A', how_to_answer: 'N/A' } },
    logical_fallacies: [],
    extra_arguments: [],
    impact_weighing: { does_argument_weigh: false, why_weighing_matters: '', magnitude: '', probability: '', timeframe: '', how_to_outweigh: '' },
    rhetorical_analysis: { opening_hook: 'No hook.', hook_strength: 'WEAK', logical_flow: 'Not enough content.', persuasion_assessment: 'Not enough content.', strongest_sentence: { quote: '', why: '' }, weakest_sentence: { quote: '', why: '', fix: '' } },
    priority_fixes: [{ problem: 'Add at least 100+ words with a clear thesis, supporting evidence, and a warrant connecting them.', quote: '', why_it_matters: 'Fracture cannot analyze reasoning that does not exist.', exact_fix: 'Start with: "I argue that [claim] because [reason], which is supported by [evidence]."', rewrite: '', score_impact: '+50 points' }]
  };
}

export function buildServiceFallbackAudit(essay, reason) {
  return {
    overall_score: null,
    verdict: `Fracture could not complete the analysis: ${reason}. Please check your API configuration and try again.`,
    score_breakdown: { argument_strength: null, assumption_audit: null, logic: null, rhetoric: null, source_quality: null },
    thesis_check: { quote: '', is_arguable: null, burden_of_proof: '', assessment: 'Service unavailable.', improvement: '' },
    claims: [],
    attackable_gaps: [],
    rebuttal_prep: { strongest_rebuttal: { attack: '', targets: '', how_to_answer: '', evidence_to_block_it: [] }, easiest_rebuttal: { attack: '', why_easy: '', how_to_answer: '' }, sneakiest_rebuttal: { attack: '', why_sneaky: '', how_to_answer: '' } },
    logical_fallacies: [],
    extra_arguments: [],
    impact_weighing: { does_argument_weigh: false, why_weighing_matters: '', magnitude: '', probability: '', timeframe: '', how_to_outweigh: '' },
    rhetorical_analysis: { opening_hook: '', hook_strength: 'WEAK', logical_flow: '', persuasion_assessment: '', strongest_sentence: { quote: '', why: '' }, weakest_sentence: { quote: '', why: '', fix: '' } },
    priority_fixes: []
  };
}

export function prepareAuditFromModelText(rawText, essay) {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleaned.indexOf('{');
  if (start === -1) return { audit: buildServiceFallbackAudit(essay, 'Model returned no JSON'), recovered: true };

  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) {
      const candidate = cleaned.slice(start, i + 1);
      try {
        const audit = JSON.parse(candidate);
        return { audit, recovered: false };
      } catch (_) {
        try {
          const repaired = candidate.replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
          const audit = JSON.parse(repaired);
          return { audit, recovered: true };
        } catch (_2) {
          return { audit: buildServiceFallbackAudit(essay, 'Could not parse model JSON'), recovered: true };
        }
      }
    }
  }
  return { audit: buildServiceFallbackAudit(essay, 'Incomplete JSON from model'), recovered: true };
}
