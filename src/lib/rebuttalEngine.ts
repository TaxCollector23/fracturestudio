import { analyzeArgument } from './fractureEngine';

export type OpponentPersona = 'logical' | 'aggressive' | 'emotional' | 'evidence-heavy' | 'skeptical' | 'debate-champion';

export type RebuttalCard = {
  claim: string;
  opponentMove: string;
  response: string;
  crossfireQuestion: string;
  risk: string;
};

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function trim(value: string, max = 170): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3).trim()}...`;
}

function claimSentences(text: string): string[] {
  const candidates = splitSentences(text).filter((sentence) =>
    /\b(should|must|because|therefore|proves|causes|harms|improves|fails|solves|best|worst|always|never)\b/i.test(sentence),
  );
  return (candidates.length > 0 ? candidates : splitSentences(text)).slice(0, 7);
}

function personaMove(persona: OpponentPersona, claim: string): string {
  if (persona === 'aggressive') {
    return `They will press the weakest wording in "${trim(claim, 90)}" and demand a yes-or-no concession.`;
  }
  if (persona === 'emotional') {
    return `They will frame "${trim(claim, 90)}" as detached from the people affected.`;
  }
  if (persona === 'evidence-heavy') {
    return `They will ask whether the evidence behind "${trim(claim, 90)}" is recent, representative, and comparative.`;
  }
  if (persona === 'skeptical') {
    return `They will treat "${trim(claim, 90)}" as possible but unproven until you rule out alternatives.`;
  }
  if (persona === 'debate-champion') {
    return `They will collapse the round to weighing: magnitude, probability, timeframe, and reversibility.`;
  }
  return `They will attack the warrant behind "${trim(claim, 90)}" rather than the claim alone.`;
}

function responseFor(claim: string, userCase: string): string {
  const caseHasEvidence = /\d|study|research|according|source|data|report|because|therefore/i.test(userCase);
  if (/always|never|everyone|no one|guarantee/i.test(claim)) {
    return 'Concede the absolute wording is too broad, then defend a narrower version with the strongest example or source.';
  }
  if (/cause|caused|lead|result|because/i.test(claim)) {
    return caseHasEvidence
      ? 'Separate correlation from causation, then point to the mechanism and any comparison that rules out alternate causes.'
      : 'Do not overclaim causation. Reframe as a plausible relationship until you add comparative evidence.';
  }
  if (/should|must|policy|ban|require/i.test(claim)) {
    return 'Answer with need, feasibility, enforcement, and net benefit. If one is missing, make that the next revision target.';
  }
  return caseHasEvidence
    ? 'Anchor the answer in your best evidence, then explain why it matters more than their objection.'
    : 'Add evidence before using this response in a live debate; right now it is mostly assertion.';
}

function crossfireFor(claim: string): string {
  if (/cause|caused|lead|result|because/i.test(claim)) {
    return 'What evidence proves this caused the outcome instead of happening before it?';
  }
  if (/always|never|everyone|no one|guarantee/i.test(claim)) {
    return 'Can you name one exception, and if so, why should the judge accept the absolute claim?';
  }
  if (/should|must|policy|ban|require/i.test(claim)) {
    return 'What specific harm exists now, and how does your proposal solve it better than the status quo?';
  }
  return 'What would you need to prove for this claim to be more than a plausible opinion?';
}

export function buildRebuttalCards(input: {
  opponentText: string;
  userCase: string;
  persona?: OpponentPersona;
}): RebuttalCard[] {
  const persona = input.persona ?? 'logical';
  return claimSentences(input.opponentText).map((claim) => ({
    claim: trim(claim),
    opponentMove: personaMove(persona, claim),
    response: responseFor(claim, input.userCase),
    crossfireQuestion: crossfireFor(claim),
    risk: /always|never|cause|because|therefore/i.test(claim)
      ? 'High if you answer with another assertion instead of evidence or a qualifier.'
      : 'Medium: the response needs weighing so it does not sound like a side issue.',
  }));
}

function bullets(items: string[], empty: string): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`;
}

export function generateRebuttalReport(input: {
  opponentText: string;
  userCase: string;
  persona?: OpponentPersona;
}): string {
  const cards = buildRebuttalCards(input);
  const opponentAnalysis = analyzeArgument(input.opponentText, { judgeMode: 'debate' });
  const userAnalysis = analyzeArgument(input.userCase, { judgeMode: 'debate' });
  const claimMap = cards
    .map((card, index) => `${index + 1}. ${card.claim}\n   Rebuttal: ${card.response}`)
    .join('\n');
  const ifTheySay = cards
    .map((card) => `- If they say: ${card.opponentMove}\n  You say: ${card.response}`)
    .join('\n');
  const crossfire = cards.map((card) => card.crossfireQuestion);
  const risks = cards.map((card) => card.risk);

  return `## Claim Map and Rebuttals
${claimMap || 'Add opponent text to generate claim-mapped rebuttals.'}

## If They Say X, You Say Y
${ifTheySay || '- Add an opponent claim and your case.'}

## Crossfire Questions
${bullets(crossfire, 'No crossfire questions generated.')}

## Opponent Vulnerabilities
${bullets(opponentAnalysis.unsupportedClaims.slice(0, 5).map((claim) => `${claim.id}: ${claim.vulnerability}`), 'No major opponent vulnerability detected from the supplied text.')}

## Risks and Overreach in Your Counter
${bullets(risks, 'No counter risks generated.')}
- Your case readiness: ${userAnalysis.verdict.label} (${userAnalysis.scores.overall}/100). Biggest repair: ${userAnalysis.missions[0]}`;
}
