// drills.js — the reusable practice drill system.
//
// A common, declarative architecture: each drill is plain data (instructions,
// difficulty, time limit, event relevance, trained skills, optional AI prompt),
// so new drills can be added without touching the practice page. Completion is
// stored per user (Firestore when signed in, localStorage otherwise) and feeds
// the progression logic on the practice page and dashboard.

export const DIFFICULTIES = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
  { id: "competitive", label: "Competitive" }
];

export const DRILLS = [
  {
    id: "claim-warrant-impact",
    title: "Claim → Warrant → Impact",
    tagline: "Build a complete argument chain from a bare assertion.",
    skills: ["argumentation"],
    events: ["argument", "essay", "research-paper", "model-un"],
    difficulty: "beginner",
    minutes: 7,
    instructions: [
      "Pick any assertion you believe (a claim you might make in a round or essay).",
      "Write the CLAIM in one sentence — narrow enough that someone could disagree.",
      "Write the WARRANT — one sentence explaining WHY the claim is true, naming the mechanism.",
      "Write the IMPACT — one sentence on why it matters and to whom.",
      "Now attack your own chain: which step would an opponent call first?"
    ],
    aiPrompt: "Give me 3 bare assertions on different topics I can practice building claim-warrant-impact chains for. One sentence each, no extra commentary.",
    selfScore: { max: 10, low: "Chain is incomplete", mid: "Chain holds with a weak link", high: "Chain survives its own attack" }
  },
  {
    id: "one-two-three",
    title: "One-two-three organization",
    tagline: "Reduce any position to three clear points in 60 seconds.",
    skills: ["organization"],
    events: ["argument", "speech", "essay", "model-un"],
    difficulty: "beginner",
    minutes: 5,
    instructions: [
      "Take any topic and state your position in one sentence.",
      "Generate exactly three main points that each carry a different reason.",
      "Give each point a one-word label (e.g. Health, Cost, Fairness).",
      "Order them strongest-first, then speak the whole structure aloud in under a minute."
    ],
    aiPrompt: "Give me a debate resolution or speech topic, then challenge me to organize a response into exactly three labeled points.",
    selfScore: { max: 10, low: "Points overlap or drift", mid: "Three distinct points", high: "Three distinct, ordered, labeled points" }
  },
  {
    id: "signpost-sprint",
    title: "Signpost sprint",
    tagline: "Make your transitions impossible to miss.",
    skills: ["clarity", "organization"],
    events: ["speech", "argument", "model-un"],
    difficulty: "beginner",
    minutes: 5,
    instructions: [
      "Take a paragraph you've written or a point you plan to make.",
      "Rewrite its opening as an explicit signpost: 'My second point is…', 'The cost concern is…'.",
      "Rewrite the transition out of it: 'That's why the third piece matters…'.",
      "Say it aloud twice — once slow, once at competition speed."
    ],
    selfScore: { max: 10, low: "No signposting", mid: "One clear signpost", high: "Every transition signed" }
  },
  {
    id: "evidence-or-opinion",
    title: "Evidence or opinion?",
    tagline: "Train yourself to hear the difference instantly.",
    skills: ["evidence"],
    events: ["argument", "essay", "research-paper", "model-un"],
    difficulty: "beginner",
    minutes: 5,
    instructions: [
      "Write or find 6 claims about a topic you're preparing.",
      "Label each: EVIDENCE (named source, verifiable fact) or OPINION (assertion, 'studies show' with no source).",
      "For each OPINION, write the exact kind of source that would upgrade it.",
      "Repeat with your own case — how many of your lines are actually evidence?"
    ],
    aiPrompt: "Give me 6 statements about [topic] — mix of evidence-backed claims and unsupported opinions — and I'll sort them. Don't label them.",
    selfScore: { max: 10, low: "Can't sort reliably", mid: "Sorts most", high: "Sorts all and names the missing source" }
  },
  {
    id: "rebuttal-blitz",
    title: "Rebuttal blitz",
    tagline: "Respond to three attacks in under ten minutes.",
    skills: ["rebuttal"],
    events: ["argument", "speech"],
    difficulty: "intermediate",
    minutes: 10,
    instructions: [
      "Generate or receive three opponent attacks on your case.",
      "For each: write the 4-step response — Signal, Response, Support, Impact.",
      "Keep each response under 45 seconds when spoken.",
      "Rank the attacks by damage and practice the top one until smooth."
    ],
    aiPrompt: "Play a skilled opponent. Give me the three strongest attacks on my case below, each one a complete sentence a debater would actually say. Then I'll respond.",
    selfScore: { max: 10, low: "Responses drop steps", mid: "Complete 4-step responses", high: "Ranked, timed, and smooth" }
  },
  {
    id: "crossfire-round",
    title: "Crossfire round",
    tagline: "Practice fielding judge and opponent questions on your feet.",
    skills: ["cross-ex"],
    events: ["argument"],
    difficulty: "intermediate",
    minutes: 8,
    instructions: [
      "Generate a set of crossfire questions aimed at your case.",
      "Answer each out loud in under 20 seconds — claim, warrant, impact in one breath.",
      "For each question you stumble on, write the answer down and repeat it.",
      "End by asking your opponent one question about THEIR burden."
    ],
    aiPrompt: "I'm preparing for crossfire. Give me 5 sharp questions a judge or opponent would ask about my case — the kind that force me to defend my warrant. One line each.",
    selfScore: { max: 10, low: "Stumbles or dodges", mid: "Answers hold", high: "Answers are crisp and turn the question" }
  },
  {
    id: "impromptu-60",
    title: "Impromptu minute",
    tagline: "One random prompt, 60 seconds of prep, one minute of speaking.",
    skills: ["confidence", "pacing"],
    events: ["speech", "argument"],
    difficulty: "intermediate",
    minutes: 5,
    instructions: [
      "Get a random prompt (generate one, or use a quote / current event).",
      "Spend 60 seconds outlining: claim, two points, impact.",
      "Speak for exactly one minute with a timer visible.",
      "Score yourself on structure held, pace, and how many times you said 'um'."
    ],
    aiPrompt: "Give me a single impromptu speaking prompt — a quote or provocative statement. Just the prompt, nothing else.",
    selfScore: { max: 10, low: "Lost structure, dead air", mid: "Held structure, rough pace", high: "Clean structure, steady pace, on time" }
  },
  {
    id: "extemp-15",
    title: "Extemp 15",
    tagline: "Full extemporaneous prep under a real time limit.",
    skills: ["preparation", "time-management"],
    events: ["speech", "argument"],
    difficulty: "advanced",
    minutes: 15,
    instructions: [
      "Get a news-style question ('Will X happen?', 'Why did Y occur?').",
      "Spend 7 minutes gathering points you can actually defend.",
      "Spend 5 minutes writing a 3-part outline with sources named.",
      "Deliver a 3-minute answer in the last 3 minutes — timer enforced."
    ],
    aiPrompt: "Give me an extemporaneous speaking question in the style of an extemp draw — a current-events question starting with Will/Why/Should. Just the question.",
    selfScore: { max: 10, low: "Ran out of time or dropped points", mid: "Full answer, thin sources", high: "On time with defensible sourcing" }
  },
  {
    id: "open-close",
    title: "Opening & closing",
    tagline: "Craft the two moments judges remember.",
    skills: ["persuasion", "clarity"],
    events: ["speech", "argument", "model-un"],
    difficulty: "intermediate",
    minutes: 10,
    instructions: [
      "Write your current opening hook and closing line.",
      "Rewrite the hook three ways: a question, a story beat, a startling fact.",
      "Rewrite the closing so it names the specific action or judgment you want.",
      "Read both aloud; keep the versions that survive your own ear."
    ],
    aiPrompt: "My speech's topic is below. Give me 3 alternative opening hooks and 3 alternative closing lines — each a complete sentence I could actually say.",
    selfScore: { max: 10, low: "Generic bookends", mid: "One memorable bookend", high: "Both bookends land" }
  },
  {
    id: "timed-case-defense",
    title: "Timed case defense",
    tagline: "Defend your full case against an aggressive opponent on the clock.",
    skills: ["rebuttal", "time-management"],
    events: ["argument"],
    difficulty: "competitive",
    minutes: 12,
    instructions: [
      "This is a simulation: the opponent attacks your case hard, on a clock.",
      "Generate the opponent's opening attack, then respond in under 90 seconds.",
      "Let the opponent follow up; defend again in 60 seconds.",
      "Close with a weighing line that puts your impact on top."
    ],
    aiPrompt: "Act as an aggressive, technically sharp opponent. Attack my case below as hard as you can — one full attack paragraph. I'll defend against it.",
    selfScore: { max: 10, low: "Dropped a response", mid: "Held the case", high: "Turned the attack into a weighing win" }
  }
];

export const drillById = (id) => DRILLS.find((d) => d.id === id) || null;

export function drillsFor({ event, skill, difficulty, level, completed = [] } = {}) {
  const done = new Set(completed || []);
  return DRILLS
    .filter((d) => !event || d.events.includes(event))
    .filter((d) => !skill || d.skills.includes(skill))
    .filter((d) => !difficulty || d.difficulty === difficulty)
    .map((d) => ({ ...d, completed: done.has(d.id) }))
    .sort((a, b) => {
      // Completed drills sink; recommended level floats to the top.
      const aScore = (a.completed ? 100 : 0) + (a.difficulty === level ? 10 : 0) + difficultyRank(a.difficulty) * 0.01;
      const bScore = (b.completed ? 100 : 0) + (b.difficulty === level ? 10 : 0) + difficultyRank(b.difficulty) * 0.01;
      return aScore - bScore;
    });
}

function difficultyRank(d) {
  return DIFFICULTIES.findIndex((x) => x.id === d) + 1;
}

export const difficultyLabel = (id) => DIFFICULTIES.find((d) => d.id === id)?.label || id;

export const minutesLabel = (m) => (m < 60 ? `${m} min` : `${Math.round(m / 60)} hr`);

// ─── Completion storage ──────────────────────────────────────────────────────

const LOCAL_KEY = "fracture_drill_results";

export function loadLocalDrillResults() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); } catch (_) { return {}; }
}

export function saveLocalDrillResult(drillId, result) {
  const all = loadLocalDrillResults();
  all[drillId] = { ...(all[drillId] || {}), ...result, completedAt: Date.now() };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  return all[drillId];
}

export function completedDrillIdsFromLocal() {
  const all = loadLocalDrillResults();
  return Object.keys(all).filter((id) => all[id]?.score != null);
}
