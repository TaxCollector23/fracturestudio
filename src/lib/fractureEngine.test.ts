import { describe, expect, it } from 'vitest';
import { analyzeArgument } from './fractureEngine';

describe('Fracture local scoring', () => {
  it('scores a coherent admissions essay as strong without requiring debate citations', () => {
    const essay = `I used to treat translation as a chore I did at pharmacy counters and school meetings for my parents. During junior year, that habit became a project when I noticed that several families in our apartment complex missed city notices because the forms arrived only in English.

I built a small volunteer group at school that translated housing, clinic, and library announcements into Spanish and Tamil. Every Sunday, we checked the city website, rewrote the notices in plain language, and posted them in the laundry room with a phone number families could text. The first time a neighbor used one of our notes to schedule a vaccine appointment, I understood that language access was not abstract service; it was infrastructure.

The project changed how I think about computer science. I still love the puzzle of making a script work, but I now care most about whether a tool reaches the people who need it. In college, I want to study human-centered computing so I can build systems that respect the communities they are meant to serve.`;

    const analysis = analyzeArgument(essay, { judgeMode: 'teacher' });

    expect(analysis.scores.overall).toBeGreaterThanOrEqual(75);
    expect(analysis.scores.evidence).toBeGreaterThanOrEqual(70);
    expect(analysis.scores.rebuttal).toBeLessThan(analysis.scores.evidence);
    expect(analysis.verdict.label).toMatch(/Survives|Shaky/);
  });

  it('places a decent but underdeveloped personal essay in the middle-high band', () => {
    const essay = `When I joined robotics, I was quiet and usually waited for someone else to make the first decision. I started by organizing screws and reading the build guide, but after our drivetrain failed before a scrimmage, I stayed late with two teammates to rebuild it.

That night taught me that leadership can begin with patience. I learned to ask better questions, explain what I had tested, and keep the group calm when the robot still did not move correctly. Robotics made me more confident because it gave me a place to practice responsibility.`;

    const analysis = analyzeArgument(essay, { judgeMode: 'teacher' });

    expect(analysis.scores.overall).toBeGreaterThanOrEqual(60);
    expect(analysis.scores.overall).toBeLessThan(78);
    expect(analysis.scores.evidence).toBeGreaterThanOrEqual(60);
  });

  it('keeps unsupported fragments low', () => {
    const analysis = analyzeArgument('I am a good leader because I always help people.');

    expect(analysis.scores.overall).toBeLessThan(45);
    expect(analysis.scores.evidence).toBeLessThan(45);
    expect(analysis.verdict.label).toBe('Collapsed');
  });

  it('keeps nonsense inputs near the floor', () => {
    const analysis = analyzeArgument('banana banana banana !!!');

    expect(analysis.scores.overall).toBeLessThanOrEqual(5);
    expect(analysis.scores.evidence).toBe(0);
    expect(analysis.verdict.label).toBe('Collapsed');
  });
});
