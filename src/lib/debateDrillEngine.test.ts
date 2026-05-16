import { describe, expect, it } from 'vitest';
import { analyzeArgument } from './fractureEngine';
import {
  assessSpeechRisk,
  buildCrossfireFollowUpChains,
  buildJudgeBallotSummary,
  buildSpeakerFlowOutline,
  compareImpactWeighing,
  createTimedRebuttalDrillSession,
  generateOpponentPersona,
  weighImpact,
} from './debateDrillEngine';

const userCase = `Schools should restrict phone use during core classes because constant notifications reduce attention.
According to a 2024 district survey, teachers reported fewer interruptions after phone pouches were adopted.
The policy still allows emergency access through the office, so the benefit is focused attention without total disconnection.
This matters because learning loss compounds over time and is difficult to reverse once students fall behind.`;

const opponentText = `Phone bans always punish responsible students and cause more conflict.
Schools should teach self-control instead of requiring pouches because students need digital independence.`;

describe('debateDrillEngine', () => {
  it('creates deterministic timed rebuttal sessions with a complete timeline', () => {
    const input = { opponentText, userCase, persona: 'skeptical' as const, totalSeconds: 180, maxRounds: 2 };
    const first = createTimedRebuttalDrillSession(input);
    const second = createTimedRebuttalDrillSession(input);

    expect(first).toEqual(second);
    expect(first.rounds).toHaveLength(2);
    expect(first.totalSeconds).toBe(180);
    expect(first.timeline.at(-1)?.endsAtSecond).toBe(180);
    expect(first.rounds[0].successCriteria.join(' ')).toContain('warrant');
  });

  it('generates archetypal opponent personas without copying requested real people', () => {
    const persona = generateOpponentPersona({
      userCase,
      requestedInspiration: 'Ada Lovelace',
      seed: 'phone-policy',
    });
    const serialized = JSON.stringify(persona);

    expect(persona.id).toMatch(/^persona-/);
    expect(persona.mimicryGuardrails.join(' ')).toContain('Archetype only');
    expect(serialized).not.toContain('Ada Lovelace');
  });

  it('flags risky speeches and gives concrete coaching moves', () => {
    const risk = assessSpeechRisk({
      speechText: 'We will always solve every classroom problem. Their side is ridiculous and has no chance.',
      targetSeconds: 45,
    });

    expect(risk.overallRisk).toBeGreaterThan(40);
    expect(risk.signals.some((signal) => signal.category === 'overclaim' && signal.score > 0)).toBe(true);
    expect(risk.rehearsalFocus.length).toBe(3);
  });

  it('weighs and compares impacts across standard debate calculus factors', () => {
    const proImpact = weighImpact({
      side: 'Pro',
      label: 'learning loss',
      magnitude: 'major',
      probability: 'likely',
      timeframe: 'near-term',
      reversibility: 'hard to reverse',
    });
    const conImpact = weighImpact({
      side: 'Con',
      label: 'student inconvenience',
      magnitude: 'minor',
      probability: 'likely',
      timeframe: 'immediate',
      reversibility: 'temporary',
    });
    const comparison = compareImpactWeighing([conImpact, proImpact]);

    expect(proImpact.score).toBeGreaterThan(conImpact.score);
    expect(comparison.winner).toBe('Pro');
    expect(proImpact.weighingSentence).toContain('learning loss');
  });

  it('builds crossfire follow-up chains from analysis and rebuttal pressure', () => {
    const chains = buildCrossfireFollowUpChains({
      topicText: opponentText,
      depth: 3,
      maxChains: 1,
    });

    expect(chains).toHaveLength(1);
    expect(chains[0].rootQuestion).toContain('?');
    expect(chains[0].followUps).toHaveLength(3);
    expect(chains[0].closingPin).toContain('judge');
  });

  it('summarizes a judge ballot and speaker flow outline', () => {
    const analysis = analyzeArgument(userCase, { judgeMode: 'debate' });
    const ballot = buildJudgeBallotSummary({
      sideLabel: 'Pro',
      opponentLabel: 'Con',
      userCase,
      opponentText,
      analysis,
      impacts: [
        {
          side: 'Pro',
          label: 'learning loss',
          magnitude: 'major',
          probability: 'likely',
          timeframe: 'near-term',
          reversibility: 'hard to reverse',
        },
      ],
    });
    const outline = buildSpeakerFlowOutline({
      analysis,
      totalSeconds: 180,
      includeCrossfirePrep: true,
      impacts: [
        {
          side: 'Pro',
          label: 'learning loss',
          magnitude: 'major',
          probability: 'likely',
          timeframe: 'near-term',
          reversibility: 'hard to reverse',
        },
      ],
    });

    expect(ballot.votingIssues).toHaveLength(3);
    expect(ballot.speakerPoints).toBeGreaterThanOrEqual(20);
    expect(outline.sections.reduce((sum, section) => sum + section.targetSeconds, 0)).toBe(180);
    expect(outline.sections.some((section) => section.kind === 'weighing')).toBe(true);
    expect(outline.flowLine.some((entry) => entry.includes('magnitude'))).toBe(true);
  });
});
