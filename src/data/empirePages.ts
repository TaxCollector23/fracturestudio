export type EmpireVisualTone = 'zinc' | 'emerald' | 'sky' | 'amber' | 'rose' | 'indigo';

export type EmpireSectionLayout =
  | 'feature-grid'
  | 'steps'
  | 'split'
  | 'metric-grid'
  | 'timeline'
  | 'case-grid'
  | 'document';

export type EmpireCta = {
  label: string;
  to: string;
  tone?: 'primary' | 'secondary';
};

export type EmpireMetric = {
  label: string;
  value: string;
  body: string;
};

export type EmpireVisualMeta = {
  tone: EmpireVisualTone;
  motif: string;
  artifact: string;
  density: 'quiet' | 'dense' | 'editorial';
};

export type EmpireItem = {
  title: string;
  body: string;
  meta?: string;
};

export type EmpireSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  layout: EmpireSectionLayout;
  visual: EmpireVisualMeta;
  items?: EmpireItem[];
  metrics?: EmpireMetric[];
  bullets?: string[];
  callout?: string;
};

export type EmpireHero = {
  eyebrow: string;
  title: string;
  lead: string;
  proof: string;
  visual: EmpireVisualMeta;
  metrics?: EmpireMetric[];
  primaryCta?: EmpireCta;
  secondaryCta?: EmpireCta;
};

export type EmpirePage = {
  slug: string;
  category: string;
  navTitle: string;
  title: string;
  summary: string;
  hero: EmpireHero;
  sections: EmpireSection[];
  relatedSlugs: string[];
};

type ModelPageInput = {
  slug: string;
  name: string;
  lead: string;
  bestFor: string[];
  fractureUse: string[];
  repairs: string[];
  caution: string;
};

function item(title: string, body: string, meta?: string): EmpireItem {
  return { title, body, meta };
}

function metric(label: string, value: string, body: string): EmpireMetric {
  return { label, value, body };
}

function modelPage(input: ModelPageInput): EmpirePage {
  return {
    slug: `models/${input.slug}`,
    category: 'Model',
    navTitle: input.name,
    title: `${input.name} argument model`,
    summary: input.lead,
    hero: {
      eyebrow: 'Model page',
      title: `${input.name}, used as a working lens.`,
      lead: input.lead,
      proof: input.caution,
      visual: {
        tone: 'indigo',
        motif: 'Model lens',
        artifact: `${input.name} checklist`,
        density: 'dense',
      },
      metrics: [
        metric('Best use', 'Lens', input.bestFor[0]),
        metric('Studio output', 'Mission', input.repairs[0]),
        metric('Risk check', 'Limit', input.caution),
      ],
      primaryCta: { label: 'Run the studio', to: '/studio/access', tone: 'primary' },
      secondaryCta: { label: 'See scoring', to: '/scoring', tone: 'secondary' },
    },
    sections: [
      {
        id: 'best-for',
        eyebrow: 'Best for',
        title: `When ${input.name} helps most`,
        body: 'Use the model when the draft needs a specific kind of pressure, not when it needs generic encouragement.',
        layout: 'feature-grid',
        visual: {
          tone: 'sky',
          motif: 'Use-case grid',
          artifact: 'Fit map',
          density: 'dense',
        },
        items: input.bestFor.map((body, index) => item(`Use case ${index + 1}`, body)),
      },
      {
        id: 'studio-pass',
        eyebrow: 'Inside Fracture',
        title: 'How the studio applies the lens',
        body: 'Fracture turns the model into concrete checks a writer can act on during revision.',
        layout: 'steps',
        visual: {
          tone: 'emerald',
          motif: 'Pass sequence',
          artifact: 'Revision rail',
          density: 'dense',
        },
        items: input.fractureUse.map((body, index) => item(`Check ${index + 1}`, body)),
      },
      {
        id: 'repair-work',
        eyebrow: 'Revision work',
        title: 'What to repair after the pass',
        body: 'The point is not to name a theory. The point is to leave with a sharper next draft.',
        layout: 'document',
        visual: {
          tone: 'amber',
          motif: 'Repair packet',
          artifact: 'Next-draft notes',
          density: 'quiet',
        },
        items: input.repairs.map((body, index) => item(`Repair ${index + 1}`, body)),
        callout: input.caution,
      },
    ],
    relatedSlugs: ['method', 'scoring', 'examples'],
  };
}

const corePages: EmpirePage[] = [
  {
    slug: 'method',
    category: 'Method',
    navTitle: 'Method',
    title: 'The Fracture Method',
    summary:
      'A disciplined pressure pass for writers who need their argument to survive readers, judges, clients, and critics.',
    hero: {
      eyebrow: 'Fracture method',
      title: 'Make the argument answer for itself before anyone else does.',
      lead:
        'Fracture Studio treats a draft like a live case. It maps what the piece is asking a reader to believe, tests the load-bearing claims, and turns weakness into a short repair plan.',
      proof:
        'The method is built for serious writing moments: debate cases, essays, policy memos, founder narratives, research briefs, and public-facing arguments where confidence has to be earned.',
      visual: {
        tone: 'emerald',
        motif: 'Claim pressure map',
        artifact: 'Fracture report',
        density: 'editorial',
      },
      metrics: [
        metric('Pass shape', '3 acts', 'Map the case, stress the weak points, repair what matters.'),
        metric('Revision output', 'Missions', 'Every critique ends with a usable next move.'),
        metric('Primary standard', 'Survival', 'A strong draft should still stand after informed opposition.'),
      ],
      primaryCta: { label: 'Open studio', to: '/studio/access', tone: 'primary' },
      secondaryCta: { label: 'How it works', to: '/how-it-works', tone: 'secondary' },
    },
    sections: [
      {
        id: 'pressure-before-polish',
        eyebrow: 'Principle',
        title: 'Pressure comes before polish.',
        body:
          'A beautiful paragraph can still hide a broken inference. Fracture starts with structure so style does not disguise a fragile case.',
        layout: 'feature-grid',
        visual: {
          tone: 'zinc',
          motif: 'Structural scan',
          artifact: 'Argument skeleton',
          density: 'quiet',
        },
        items: [
          item('Claim load', 'Which claims carry the conclusion, and which sentences are decorative?'),
          item('Evidence fit', 'Does the cited material prove the exact thing the draft needs it to prove?'),
          item('Warrant clarity', 'What assumption connects the evidence to the claim, and will the reader grant it?'),
          item('Opposition readiness', 'What would a serious critic attack first, and can the draft answer?'),
        ],
      },
      {
        id: 'three-act-pass',
        eyebrow: 'Workflow',
        title: 'A three-act pass for every serious draft.',
        body:
          'The studio avoids vague feedback by moving from diagnosis to prioritization to repair. Writers should leave knowing what to do next.',
        layout: 'steps',
        visual: {
          tone: 'emerald',
          motif: 'Map, stress, repair',
          artifact: 'Pass timeline',
          density: 'dense',
        },
        items: [
          item('Map', 'Identify thesis, claims, warrants, assumptions, evidence, and dependency chains.'),
          item('Stress', 'Run opposition, source, logic, rubric, and reader-confusion checks against the map.'),
          item('Repair', 'Rank the most consequential weaknesses and convert them into revision missions.'),
          item('Rehearse', 'Practice the hard questions before the argument meets an actual audience.'),
        ],
      },
      {
        id: 'what-users-get',
        eyebrow: 'Output',
        title: 'The output is built for action.',
        body:
          'Fracture does not stop at a score. It gives writers a practical packet they can keep beside the draft while revising.',
        layout: 'metric-grid',
        visual: {
          tone: 'sky',
          motif: 'Report packet',
          artifact: 'Revision dashboard',
          density: 'dense',
        },
        metrics: [
          metric('Logic heatmap', 'Ranked', 'The weakest paragraphs and claims rise to the top.'),
          metric('Source ledger', 'Bound', 'Evidence is tied to the claim it is supposed to support.'),
          metric('Opposition drill', 'Live', 'The draft gets the questions a prepared critic would ask.'),
          metric('Final missions', 'Short', 'A focused list replaces a wall of comments.'),
        ],
      },
    ],
    relatedSlugs: ['how-it-works', 'scoring', 'limitations'],
  },
  {
    slug: 'how-it-works',
    category: 'Product',
    navTitle: 'How it works',
    title: 'How Fracture Studio Works',
    summary: 'A practical walkthrough of the studio workflow from raw draft to exportable revision packet.',
    hero: {
      eyebrow: 'Workflow',
      title: 'Bring a draft. Leave with the next draft already visible.',
      lead:
        'The studio moves in a tight loop: draft, fracture, ground evidence, rehearse opposition, and export the repair plan. Each step has a job.',
      proof:
        'Use it when the stakes are high enough that normal comments are too vague, but the deadline is too close for endless rethinking.',
      visual: {
        tone: 'sky',
        motif: 'Studio loop',
        artifact: 'Five-step workspace',
        density: 'dense',
      },
      metrics: [
        metric('Input', 'Draft', 'Paste a case, memo, essay, speech, or strategic narrative.'),
        metric('Analysis', 'Pass', 'Run local structure checks and optional model enhancement.'),
        metric('Output', 'Packet', 'Export the repair plan and rehearsal notes.'),
      ],
      primaryCta: { label: 'Start a case', to: '/studio/case', tone: 'primary' },
      secondaryCta: { label: 'Read examples', to: '/examples', tone: 'secondary' },
    },
    sections: [
      {
        id: 'studio-loop',
        eyebrow: 'Sequence',
        title: 'The working loop is simple on purpose.',
        body:
          'Writers should not need to become prompt engineers. The studio gives each phase a focused surface and keeps the work moving.',
        layout: 'steps',
        visual: {
          tone: 'emerald',
          motif: 'Draft loop',
          artifact: 'Workspace rail',
          density: 'dense',
        },
        items: [
          item('Paste or draft', 'Start with the material you actually need to defend. Messy is fine.'),
          item('Run Fracture', 'Generate the claim map, score, assumptions, collapse point, and revision missions.'),
          item('Ground sources', 'Add sources, bind them to claims, and see where support is thin or mismatched.'),
          item('Drill opposition', 'Paste opponent material or generate likely objections for crossfire practice.'),
          item('Export repairs', 'Carry the final packet back into the draft, team review, or debate prep.'),
        ],
      },
      {
        id: 'inside-report',
        eyebrow: 'Report anatomy',
        title: 'Every report separates diagnosis from instruction.',
        body:
          'The diagnosis shows what is happening in the argument. The instruction tells you what to do with that information.',
        layout: 'feature-grid',
        visual: {
          tone: 'zinc',
          motif: 'Report anatomy',
          artifact: 'Annotated brief',
          density: 'quiet',
        },
        items: [
          item('Scorecard', 'A fast read on clarity, support, warrant strength, opposition readiness, and revision leverage.'),
          item('Claim map', 'The argument broken into thesis, claims, evidence, assumptions, and dependencies.'),
          item('Heatmap', 'The paragraphs most likely to lose reader trust or collapse under pressure.'),
          item('Mission list', 'A small set of changes that improve the argument fastest.'),
        ],
      },
      {
        id: 'human-control',
        eyebrow: 'Control',
        title: 'The writer stays in command.',
        body:
          'Fracture can sharpen judgment, but it cannot own the claim. The user decides what the argument means, what evidence counts, and what tradeoffs are acceptable.',
        layout: 'split',
        visual: {
          tone: 'amber',
          motif: 'Human review',
          artifact: 'Decision ledger',
          density: 'editorial',
        },
        bullets: [
          'Treat scores as triage, not identity.',
          'Verify every source before publication.',
          'Rewrite in your own voice after the pass.',
          'Keep contested values visible instead of pretending they disappeared.',
        ],
        callout: 'The strongest use of Fracture is not obedience. It is better judgment under pressure.',
      },
    ],
    relatedSlugs: ['method', 'docs', 'examples'],
  },
  {
    slug: 'docs',
    category: 'Docs',
    navTitle: 'Docs',
    title: 'Fracture Studio Docs',
    summary: 'Operational docs for using the studio, shipping the app, and keeping analysis predictable.',
    hero: {
      eyebrow: 'Documentation',
      title: 'Use the studio seriously, then deploy it cleanly.',
      lead:
        'The docs are for two audiences: writers who need a dependable workflow and builders who need the app to behave across local, hosted, and static environments.',
      proof:
        'Start with the workflow, then check environment setup, model configuration, exports, and the testing commands before shipping changes.',
      visual: {
        tone: 'zinc',
        motif: 'Docs index',
        artifact: 'Operator manual',
        density: 'quiet',
      },
      metrics: [
        metric('Writer path', '5 steps', 'Draft, fracture, cite, rehearse, export.'),
        metric('Builder path', '3 checks', 'Install, configure, test.'),
        metric('Hosting path', 'Adapters', 'Same-origin API support for common deploy targets.'),
      ],
      primaryCta: { label: 'Open workspace', to: '/studio/case', tone: 'primary' },
      secondaryCta: { label: 'See limitations', to: '/limitations', tone: 'secondary' },
    },
    sections: [
      {
        id: 'writer-quickstart',
        eyebrow: 'Quickstart',
        title: 'Writer workflow',
        body:
          'Most users should begin by running a complete pass on one real draft, then use the repair packet to revise before running the second pass.',
        layout: 'steps',
        visual: {
          tone: 'emerald',
          motif: 'Writer path',
          artifact: 'Quickstart rail',
          density: 'dense',
        },
        items: [
          item('Start with the real draft', 'Paste the text you need to improve, not a sanitized sample.'),
          item('Run the full pass', 'Read the score, claim map, assumptions, collapse point, and missions together.'),
          item('Bind sources to claims', 'Make evidence prove the exact claim it is attached to.'),
          item('Run rebuttal drills', 'Practice the questions your audience is most likely to ask.'),
          item('Revise and repeat', 'Run a second pass only after meaningful changes are in the draft.'),
        ],
      },
      {
        id: 'builder-quickstart',
        eyebrow: 'Build notes',
        title: 'Builder workflow',
        body:
          'The app should remain useful without remote enhancement and more capable when a configured model endpoint is available.',
        layout: 'document',
        visual: {
          tone: 'sky',
          motif: 'Build checklist',
          artifact: 'Deployment notes',
          density: 'dense',
        },
        items: [
          item('Install', 'Run npm install and keep package-lock changes intentional.'),
          item('Develop', 'Run npm run dev for Vite plus the same-origin chat middleware used by the studio.'),
          item('Configure', 'Set OPENROUTER_API_KEY only on hosts that should use remote model enhancement.'),
          item('Verify', 'Run npm run check, npm run test, and npm run lint before release.'),
        ],
      },
      {
        id: 'operating-rules',
        eyebrow: 'Operating rules',
        title: 'Rules that keep the system honest',
        body:
          'Good docs are not only instructions. They set expectations so users know what the tool can and cannot guarantee.',
        layout: 'feature-grid',
        visual: {
          tone: 'amber',
          motif: 'Quality rules',
          artifact: 'Reliability checklist',
          density: 'quiet',
        },
        items: [
          item('Local first', 'Core analysis should still produce a complete report without a remote model response.'),
          item('Source skeptical', 'Citations are leads for verification, not permission to stop reading.'),
          item('Exportable work', 'A user should be able to leave with concrete revision text and decisions.'),
          item('Plain failure states', 'If an API is missing or down, the app should say so clearly and keep working.'),
        ],
      },
    ],
    relatedSlugs: ['how-it-works', 'limitations', 'roadmap'],
  },
  {
    slug: 'scoring',
    category: 'Evaluation',
    navTitle: 'Scoring',
    title: 'How Fracture Scores Arguments',
    summary:
      'A transparent scoring model that treats numbers as triage signals, not as a substitute for writer judgment.',
    hero: {
      eyebrow: 'Scoring',
      title: 'A score should tell you where to work, not flatter the draft.',
      lead:
        'Fracture scores arguments by looking at the claims that hold the piece together: clarity, evidence fit, warrant strength, opposition readiness, and revision leverage.',
      proof:
        'The number is useful because it points to the next move. A low score can be good news when it catches the failure early.',
      visual: {
        tone: 'rose',
        motif: 'Scorecard',
        artifact: 'Quality gate',
        density: 'dense',
      },
      metrics: [
        metric('Clarity', '20%', 'Can the reader identify the thesis and route of proof?'),
        metric('Support', '25%', 'Does evidence substantiate the exact claim under load?'),
        metric('Opposition', '20%', 'Can the draft answer the strongest likely objection?'),
      ],
      primaryCta: { label: 'Run a score', to: '/studio/case', tone: 'primary' },
      secondaryCta: { label: 'Read limitations', to: '/limitations', tone: 'secondary' },
    },
    sections: [
      {
        id: 'dimensions',
        eyebrow: 'Dimensions',
        title: 'The score is a bundle of judgments.',
        body:
          'Each dimension measures a different failure mode. A draft can sound confident and still fail on evidence, warrant, or opposition readiness.',
        layout: 'metric-grid',
        visual: {
          tone: 'sky',
          motif: 'Dimension grid',
          artifact: 'Score breakdown',
          density: 'dense',
        },
        metrics: [
          metric('Thesis clarity', '0-100', 'The central claim is explicit, contestable, and not buried.'),
          metric('Claim support', '0-100', 'Evidence is relevant, adequate, and connected to the claim.'),
          metric('Warrant strength', '0-100', 'The bridge from evidence to claim is visible and defensible.'),
          metric('Counterargument', '0-100', 'The draft anticipates real objections instead of weak caricatures.'),
          metric('Impact logic', '0-100', 'The stakes follow from the argument rather than being asserted at the end.'),
          metric('Revision leverage', '0-100', 'The next changes are clear enough to execute.'),
        ],
      },
      {
        id: 'bands',
        eyebrow: 'Bands',
        title: 'How to read the score range',
        body:
          'The band matters more than the exact point. Use it to decide how aggressive the next revision should be.',
        layout: 'timeline',
        visual: {
          tone: 'rose',
          motif: 'Score bands',
          artifact: 'Triage ladder',
          density: 'dense',
        },
        items: [
          item('0-39', 'Rebuild the core claim. The draft may be missing a defensible route of proof.', 'Reframe'),
          item('40-59', 'Repair the load-bearing warrants and replace vague evidence with precise support.', 'Stabilize'),
          item('60-79', 'Strengthen counterargument, tighten evidence fit, and remove weak transitions.', 'Sharpen'),
          item('80-100', 'Stress-test for edge cases, audience values, and source quality before publishing.', 'Rehearse'),
        ],
      },
      {
        id: 'score-rules',
        eyebrow: 'Use it well',
        title: 'Scoring rules for serious users',
        body:
          'The score is a tool for disciplined revision. It is not a grade on the writer, and it is not a promise that the audience will agree.',
        layout: 'split',
        visual: {
          tone: 'amber',
          motif: 'Scoring guardrails',
          artifact: 'Decision rules',
          density: 'quiet',
        },
        bullets: [
          'Treat score movement as evidence of revision quality, not as a game.',
          'Read the dimension notes before chasing a higher total.',
          'A controversial argument can score well if it is clear, supported, and opposition-aware.',
          'A safe argument can score poorly if it relies on empty consensus.',
        ],
        callout: 'A good score means the argument is prepared. It does not mean the argument is true.',
      },
    ],
    relatedSlugs: ['method', 'limitations', 'models/toulmin'],
  },
  {
    slug: 'limitations',
    category: 'Trust',
    navTitle: 'Limitations',
    title: 'What Fracture Cannot Do',
    summary:
      'A direct account of the product boundaries, verification responsibilities, and judgment calls that remain human.',
    hero: {
      eyebrow: 'Limitations',
      title: 'Useful pressure is not the same thing as certainty.',
      lead:
        'Fracture Studio can reveal structural weakness, suggest stronger revisions, and rehearse opposition. It cannot guarantee truth, originality, legal safety, or audience agreement.',
      proof:
        'The tool is strongest when users treat it as a rigorous critic beside the draft, not as an authority above the draft.',
      visual: {
        tone: 'amber',
        motif: 'Boundary map',
        artifact: 'Trust checklist',
        density: 'editorial',
      },
      metrics: [
        metric('Truth', 'Verify', 'Claims and sources still need external validation.'),
        metric('Judgment', 'Human', 'Values and tradeoffs belong to the writer.'),
        metric('Risk', 'Contextual', 'Legal, medical, financial, and safety claims need expert review.'),
      ],
      primaryCta: { label: 'Read scoring', to: '/scoring', tone: 'primary' },
      secondaryCta: { label: 'Open docs', to: '/docs', tone: 'secondary' },
    },
    sections: [
      {
        id: 'cannot-know',
        eyebrow: 'Boundaries',
        title: 'What the system cannot know on its own',
        body:
          'A model can inspect the text it is given, but the world outside that text remains a verification problem.',
        layout: 'feature-grid',
        visual: {
          tone: 'amber',
          motif: 'Known unknowns',
          artifact: 'Boundary grid',
          density: 'quiet',
        },
        items: [
          item('Private facts', 'It cannot know private context, unpublished evidence, or unstated constraints.'),
          item('Current events', 'Time-sensitive facts can change and should be checked against current sources.'),
          item('Domain obligations', 'Specialized advice may require a licensed expert or institutional process.'),
          item('Audience values', 'It can infer possible values, but only the writer knows the real audience.'),
        ],
      },
      {
        id: 'source-risk',
        eyebrow: 'Evidence',
        title: 'Citation help still requires source discipline.',
        body:
          'Fracture can flag unsupported claims and organize a source ledger, but citation quality depends on the user reading and verifying the material.',
        layout: 'document',
        visual: {
          tone: 'rose',
          motif: 'Citation caution',
          artifact: 'Source ledger',
          density: 'dense',
        },
        items: [
          item('Check existence', 'Confirm the source exists, is accessible, and says what the draft claims it says.'),
          item('Check fit', 'Make sure the cited evidence proves the specific sentence it supports.'),
          item('Check freshness', 'Look for newer data when claims depend on current policy, science, prices, or law.'),
          item('Check bias', 'Account for institutional incentives, sample limits, funding, and missing counterevidence.'),
        ],
      },
      {
        id: 'responsible-use',
        eyebrow: 'Responsible use',
        title: 'The user owns the final argument.',
        body:
          'The best output still needs a writer who can decide what is fair, accurate, strategic, and worth saying.',
        layout: 'split',
        visual: {
          tone: 'zinc',
          motif: 'Final review',
          artifact: 'Human signoff',
          density: 'editorial',
        },
        bullets: [
          'Do not publish generated claims without verification.',
          'Do not use Fracture as a substitute for legal, medical, financial, or safety review.',
          'Do not let a high score override ethical or factual concerns.',
          'Do use the critique to ask better questions of the draft.',
        ],
        callout: 'Fracture should make the writer more accountable, not less.',
      },
    ],
    relatedSlugs: ['docs', 'scoring', 'about'],
  },
  {
    slug: 'about',
    category: 'Build story',
    navTitle: 'About',
    title: 'About Fracture Studio',
    summary:
      'The story behind a writing tool built for pressure, judgment, and arguments that need more than surface polish.',
    hero: {
      eyebrow: 'About',
      title: 'Built for the moment when a draft has to withstand scrutiny.',
      lead:
        'Fracture Studio began from a simple frustration: most writing feedback arrives as taste, tone, or vague approval. Serious writers need a tougher kind of help.',
      proof:
        'The product is shaped around debate prep, research discipline, and revision craft because those are the places where weak reasoning becomes expensive.',
      visual: {
        tone: 'emerald',
        motif: 'Build story',
        artifact: 'Founding notes',
        density: 'editorial',
      },
      metrics: [
        metric('North star', 'Pressure', 'Expose weakness while the writer can still fix it.'),
        metric('Product habit', 'Action', 'Convert critique into revision missions.'),
        metric('Design value', 'Calm', 'Make hard feedback feel usable, not theatrical.'),
      ],
      primaryCta: { label: 'Read roadmap', to: '/roadmap', tone: 'primary' },
      secondaryCta: { label: 'See method', to: '/method', tone: 'secondary' },
    },
    sections: [
      {
        id: 'why-it-exists',
        eyebrow: 'Origin',
        title: 'The problem is not that writers lack words.',
        body:
          'The problem is that drafts can sound finished before the reasoning is ready. Fracture exists to slow that moment down and make the argument earn its confidence.',
        layout: 'feature-grid',
        visual: {
          tone: 'zinc',
          motif: 'Origin grid',
          artifact: 'Problem map',
          density: 'quiet',
        },
        items: [
          item('Debaters need pressure', 'A case should meet objections before the round begins.'),
          item('Students need clarity', 'An essay should know what it is proving before it chases style.'),
          item('Teams need alignment', 'A memo should show which claims are firm and which need more work.'),
          item('Founders need discipline', 'A pitch should answer the hard question before the room asks it.'),
        ],
      },
      {
        id: 'product-beliefs',
        eyebrow: 'Beliefs',
        title: 'The product has a few stubborn beliefs.',
        body:
          'These beliefs keep the studio focused on usefulness instead of novelty.',
        layout: 'document',
        visual: {
          tone: 'emerald',
          motif: 'Principle ledger',
          artifact: 'Product beliefs',
          density: 'dense',
        },
        items: [
          item('Feedback should be actionable', 'A critique that does not change the next draft is decoration.'),
          item('Sources should be bound to claims', 'Evidence belongs beside the sentence it supports.'),
          item('Opposition should be treated fairly', 'A weak strawman makes the writer less prepared.'),
          item('Local value matters', 'The studio should remain useful even before remote enhancement is configured.'),
        ],
      },
      {
        id: 'what-serious-means',
        eyebrow: 'Standard',
        title: 'Serious does not mean joyless.',
        body:
          'It means the tool respects the stakes. The interface can be quiet, but the analysis should be sharp enough to make the draft better.',
        layout: 'split',
        visual: {
          tone: 'sky',
          motif: 'Serious craft',
          artifact: 'Design notes',
          density: 'editorial',
        },
        bullets: [
          'Clear hierarchy over spectacle.',
          'Direct language over inflated productivity claims.',
          'Revision work over generic summaries.',
          'Confidence that comes from surviving pressure.',
        ],
        callout: 'The goal is not to make writers dependent. The goal is to make them harder to fool, including by their own first draft.',
      },
    ],
    relatedSlugs: ['method', 'roadmap', 'case-studies'],
  },
  {
    slug: 'roadmap',
    category: 'Roadmap',
    navTitle: 'Roadmap',
    title: 'Fracture Studio Roadmap',
    summary:
      'A product roadmap focused on deeper argument intelligence, cleaner collaboration, and better evidence workflows.',
    hero: {
      eyebrow: 'Roadmap',
      title: 'The next work is depth, trust, and team flow.',
      lead:
        'Fracture is moving toward richer argument graphs, stronger citation workflows, collaborative review, and export formats that fit the way serious teams already work.',
      proof:
        'The roadmap favors capabilities that make the next draft better, not ornamental AI features that add noise.',
      visual: {
        tone: 'sky',
        motif: 'Roadmap lanes',
        artifact: 'Build sequence',
        density: 'dense',
      },
      metrics: [
        metric('Now', 'Stable', 'Core fracture report, citations, rebuttals, and exports.'),
        metric('Next', 'Deeper', 'Richer evidence binding and argument graph views.'),
        metric('Later', 'Teams', 'Review workflows, shared libraries, and case memory.'),
      ],
      primaryCta: { label: 'Open studio', to: '/studio/access', tone: 'primary' },
      secondaryCta: { label: 'Read about', to: '/about', tone: 'secondary' },
    },
    sections: [
      {
        id: 'now',
        eyebrow: 'Now',
        title: 'Current focus: dependable single-writer workflow.',
        body:
          'The current product should help one writer pressure-test a draft without needing a team, a custom setup, or a perfect prompt.',
        layout: 'feature-grid',
        visual: {
          tone: 'emerald',
          motif: 'Current lane',
          artifact: 'Studio foundation',
          density: 'dense',
        },
        items: [
          item('Core report', 'Claim map, score, assumptions, collapse point, and revision missions.'),
          item('Evidence pass', 'Citation-needed flags, source ledger, and claim support checks.'),
          item('Rebuttal prep', 'Opposition simulation, crossfire questions, and response planning.'),
          item('Export packet', 'A portable summary of the repair work and strategic notes.'),
        ],
      },
      {
        id: 'next',
        eyebrow: 'Next',
        title: 'Next focus: richer proof and graph work.',
        body:
          'The next layer should make reasoning easier to inspect and evidence easier to trust.',
        layout: 'timeline',
        visual: {
          tone: 'sky',
          motif: 'Next lane',
          artifact: 'Graph roadmap',
          density: 'dense',
        },
        items: [
          item('Interactive argument graph', 'Move from report text to a navigable map of claims and dependencies.'),
          item('Source quality scoring', 'Flag source age, relevance, authority, and possible mismatch with claims.'),
          item('Revision diffs', 'Show how a draft improved between passes and where risk remains.'),
          item('Rubric presets', 'Map arguments against debate, classroom, policy, and pitch standards.'),
        ],
      },
      {
        id: 'later',
        eyebrow: 'Later',
        title: 'Later focus: team memory without bloat.',
        body:
          'Shared work should make teams more consistent while keeping the single-draft workflow fast.',
        layout: 'case-grid',
        visual: {
          tone: 'indigo',
          motif: 'Team lane',
          artifact: 'Collaboration map',
          density: 'editorial',
        },
        items: [
          item('Case libraries', 'Reusable claims, evidence cards, opponent blocks, and judge notes.'),
          item('Team review', 'Assign repair missions and track which weaknesses are resolved.'),
          item('Prep memory', 'Preserve prior rounds, comments, and source decisions for future cases.'),
        ],
      },
    ],
    relatedSlugs: ['about', 'docs', 'examples'],
  },
  {
    slug: 'examples',
    category: 'Examples',
    navTitle: 'Examples',
    title: 'Fracture Studio Examples',
    summary:
      'Concrete ways different writers can use the studio to pressure-test arguments before a real audience does.',
    hero: {
      eyebrow: 'Examples',
      title: 'Different drafts, same discipline: make the weak link visible.',
      lead:
        'Fracture is useful anywhere a piece of writing has to prove something. The surface changes, but the pressure questions stay familiar.',
      proof:
        'Use these examples as patterns for what to paste, what to inspect first, and what to revise after the report.',
      visual: {
        tone: 'emerald',
        motif: 'Use-case wall',
        artifact: 'Example library',
        density: 'dense',
      },
      metrics: [
        metric('Debate', 'Case', 'Find the collapse point before crossfire.'),
        metric('Essay', 'Thesis', 'Make support and warrants explicit.'),
        metric('Memo', 'Decision', 'Show tradeoffs and evidence quality.'),
      ],
      primaryCta: { label: 'Open workspace', to: '/studio/case', tone: 'primary' },
      secondaryCta: { label: 'Read case studies', to: '/case-studies', tone: 'secondary' },
    },
    sections: [
      {
        id: 'debate-case',
        eyebrow: 'Debate',
        title: 'Debate case preparation',
        body:
          'Paste the affirmative or negative case, then use the report to find unsupported impact chains and fragile solvency claims.',
        layout: 'document',
        visual: {
          tone: 'rose',
          motif: 'Debate file',
          artifact: 'Crossfire packet',
          density: 'dense',
        },
        items: [
          item('Input', 'Constructive speech, blocks, evidence cards, and likely opponent positions.'),
          item('Inspect first', 'Collapse point, source-to-claim fit, and crossfire questions.'),
          item('Revise next', 'Upgrade cards, clarify warrants, and prepare concise answers to predictable attacks.'),
        ],
      },
      {
        id: 'academic-essay',
        eyebrow: 'Academic',
        title: 'Academic essay revision',
        body:
          'Use Fracture after the first complete draft, when the thesis exists but the proof route may still be muddy.',
        layout: 'document',
        visual: {
          tone: 'sky',
          motif: 'Essay pass',
          artifact: 'Thesis ledger',
          density: 'quiet',
        },
        items: [
          item('Input', 'Full essay draft, assignment prompt, and any rubric language.'),
          item('Inspect first', 'Thesis clarity, paragraph dependency, and evidence explanation.'),
          item('Revise next', 'Rewrite topic sentences, add missing warrants, and cut claims the essay cannot prove.'),
        ],
      },
      {
        id: 'strategy-memo',
        eyebrow: 'Strategy',
        title: 'Policy or strategy memo',
        body:
          'A memo often fails when it hides tradeoffs. Fracture makes assumptions and decision logic easier to challenge.',
        layout: 'case-grid',
        visual: {
          tone: 'amber',
          motif: 'Decision memo',
          artifact: 'Tradeoff map',
          density: 'editorial',
        },
        items: [
          item('Input', 'Recommendation, evidence summary, stakeholder constraints, and risk notes.'),
          item('Inspect first', 'Assumptions, alternatives, evidence freshness, and impact logic.'),
          item('Revise next', 'Name the tradeoff, strengthen the decisive evidence, and pre-answer objections.'),
        ],
      },
      {
        id: 'founder-narrative',
        eyebrow: 'Pitch',
        title: 'Founder narrative or investor memo',
        body:
          'A pitch needs conviction without handwaving. The studio helps separate a strong thesis from a confident story.',
        layout: 'case-grid',
        visual: {
          tone: 'indigo',
          motif: 'Pitch deck notes',
          artifact: 'Investor question map',
          density: 'dense',
        },
        items: [
          item('Input', 'Narrative memo, market thesis, traction claims, and competitive positioning.'),
          item('Inspect first', 'Unproven assumptions, audience objections, and missing evidence.'),
          item('Revise next', 'Tighten the market claim, qualify uncertain claims, and prepare answer blocks.'),
        ],
      },
    ],
    relatedSlugs: ['case-studies', 'how-it-works', 'method'],
  },
  {
    slug: 'case-studies',
    category: 'Case studies',
    navTitle: 'Case Studies',
    title: 'Fracture Studio Case Studies',
    summary:
      'Scenario-based stories showing how different users turn Fracture reports into stronger real-world work.',
    hero: {
      eyebrow: 'Case studies',
      title: 'The useful story is the revision after the report.',
      lead:
        'These case studies show what changes when writers stop asking whether a draft sounds good and start asking whether it can survive pressure.',
      proof:
        'Each scenario follows the same arc: the starting risk, the Fracture finding, and the revision that changed the outcome.',
      visual: {
        tone: 'rose',
        motif: 'Outcome board',
        artifact: 'Revision stories',
        density: 'editorial',
      },
      metrics: [
        metric('Pattern', 'Risk', 'The draft hides a weakness.'),
        metric('Finding', 'Pressure', 'Fracture names the failure mode.'),
        metric('Outcome', 'Repair', 'The user revises the part that matters.'),
      ],
      primaryCta: { label: 'Try a draft', to: '/studio/access', tone: 'primary' },
      secondaryCta: { label: 'Browse examples', to: '/examples', tone: 'secondary' },
    },
    sections: [
      {
        id: 'student-debater',
        eyebrow: 'Debate',
        title: 'A student debater finds the collapse point early.',
        body:
          'The original case had strong evidence cards but a weak solvency warrant. The report showed that every impact depended on an assumption the speech never defended.',
        layout: 'case-grid',
        visual: {
          tone: 'rose',
          motif: 'Round prep',
          artifact: 'Collapse-point card',
          density: 'dense',
        },
        items: [
          item('Starting risk', 'The case sounded researched but could be beaten with one direct question.'),
          item('Fracture finding', 'The source proved harm, but not that the proposed action solved it.'),
          item('Revision', 'The student added a solvency warrant, swapped one card, and prepared a two-sentence answer.'),
        ],
      },
      {
        id: 'policy-team',
        eyebrow: 'Policy',
        title: 'A policy team makes tradeoffs explicit.',
        body:
          'A recommendation memo used confident language around uncertain data. Fracture flagged the unsupported certainty and surfaced the objections a skeptical stakeholder would raise.',
        layout: 'case-grid',
        visual: {
          tone: 'amber',
          motif: 'Stakeholder review',
          artifact: 'Tradeoff brief',
          density: 'editorial',
        },
        items: [
          item('Starting risk', 'The memo treated a contested forecast as settled fact.'),
          item('Fracture finding', 'The strongest objection was not moral disagreement, but evidence uncertainty.'),
          item('Revision', 'The team qualified the claim, added a scenario range, and named the decision tradeoff.'),
        ],
      },
      {
        id: 'founder',
        eyebrow: 'Startup',
        title: 'A founder separates narrative from proof.',
        body:
          'The pitch memo had a compelling story, but the market claim leaned on a broad trend instead of evidence for the specific wedge.',
        layout: 'case-grid',
        visual: {
          tone: 'sky',
          motif: 'Investor prep',
          artifact: 'Question map',
          density: 'dense',
        },
        items: [
          item('Starting risk', 'The strongest sentence was also the least supported.'),
          item('Fracture finding', 'The audience would ask for proof of urgency, not proof that the category existed.'),
          item('Revision', 'The founder narrowed the claim, added customer evidence, and prepared an objection block.'),
        ],
      },
    ],
    relatedSlugs: ['examples', 'about', 'method'],
  },
];

const modelPages: EmpirePage[] = [
  modelPage({
    slug: 'toulmin',
    name: 'Toulmin',
    lead:
      'Toulmin is the workhorse model for finding the hidden bridge between evidence and claim. It is especially useful when a draft has sources but the reasoning still feels implied.',
    bestFor: [
      'Essays, debate cases, memos, and pitches where evidence needs a visible warrant.',
      'Drafts with strong facts but unclear reasoning between those facts and the conclusion.',
      'Revisions where the writer needs to qualify a claim without weakening the whole piece.',
    ],
    fractureUse: [
      'Extract the claim, grounds, warrant, backing, qualifier, and possible rebuttal.',
      'Flag claims whose warrant is missing, assumed, or too broad for the evidence.',
      'Turn weak warrants into revision missions with suggested qualification language.',
    ],
    repairs: [
      'Add the missing warrant in the paragraph where the reader needs it.',
      'Move backing closer to the claim it supports.',
      'Qualify claims whose evidence proves less than the sentence currently says.',
    ],
    caution: 'A Toulmin pass can make an argument cleaner, but it cannot decide whether the warrant is morally or empirically acceptable.',
  }),
  modelPage({
    slug: 'rogerian',
    name: 'Rogerian',
    lead:
      'Rogerian argument helps writers engage disagreement without caricature. It is useful when persuasion depends on making the opposing side feel accurately understood.',
    bestFor: [
      'Polarized topics where the reader may reject the draft if it opens with dismissal.',
      'Public essays, stakeholder memos, and speeches that need trust before pressure.',
      'Revisions where the counterargument section feels perfunctory or hostile.',
    ],
    fractureUse: [
      'Identify whether the opposing view is stated in terms its supporters would recognize.',
      'Check whether the draft finds a shared value before asking the reader to move.',
      'Flag rebuttals that sound clever but make the writer seem less trustworthy.',
    ],
    repairs: [
      'Rewrite the opposing position with more accuracy and less contempt.',
      'Name the shared value that makes disagreement worth resolving.',
      'Move from common ground to a narrower, defensible claim.',
    ],
    caution: 'Rogerian structure should not flatten real disagreement or pretend a harmful claim is harmless.',
  }),
  modelPage({
    slug: 'stock-issues',
    name: 'Stock Issues',
    lead:
      'Stock Issues pressure-test policy arguments by asking whether the draft proves harm, inherency, significance, solvency, and topicality.',
    bestFor: [
      'Policy debate cases and recommendation memos that need a complete burden of proof.',
      'Drafts that describe a problem well but underspecify why the proposed action solves it.',
      'Arguments where a missing issue can collapse the whole case.',
    ],
    fractureUse: [
      'Sort claims into harm, inherency, significance, solvency, and topicality buckets.',
      'Detect missing burdens and overdeveloped sections that hide thin proof elsewhere.',
      'Rank the issue most likely to be attacked by a judge, critic, or stakeholder.',
    ],
    repairs: [
      'Add the missing burden before polishing language.',
      'Strengthen solvency with evidence that matches the actual mechanism.',
      'Clarify topical fit or scope before the reader raises it.',
    ],
    caution: 'Stock Issues are excellent for policy proof, but not every moral, literary, or strategic argument should be forced into that frame.',
  }),
  modelPage({
    slug: 'pragma-dialectics',
    name: 'Pragma-Dialectics',
    lead:
      'Pragma-Dialectics treats argument as a disciplined exchange. It helps identify burden shifts, relevance problems, rule violations, and false closure.',
    bestFor: [
      'Debate prep, rebuttal writing, and contentious memos with multiple objections.',
      'Drafts that answer the wrong question or declare victory too early.',
      'Reviews where the writer needs to separate a fair burden from a distraction.',
    ],
    fractureUse: [
      'Check whether each move advances the dispute or dodges it.',
      'Flag burden shifts, irrelevant appeals, and answers that do not meet the objection.',
      'Identify where the argument claims closure before the issue is actually resolved.',
    ],
    repairs: [
      'Restate the active dispute before answering it.',
      'Put the burden of proof back on the claim that needs support.',
      'Replace evasive rebuttals with direct concessions, distinctions, or evidence.',
    ],
    caution: 'This lens improves argumentative fairness, but it does not guarantee that all parties share the same rules of debate.',
  }),
  modelPage({
    slug: 'syllogism',
    name: 'Syllogism',
    lead:
      'Syllogistic structure is useful when a draft needs clean deductive discipline: major premise, minor premise, conclusion.',
    bestFor: [
      'Arguments that rely on definitions, rules, eligibility, classification, or formal logic.',
      'Short sections where a conclusion should follow tightly from two premises.',
      'Drafts with confident conclusions but unstated or invalid premises.',
    ],
    fractureUse: [
      'Extract the major premise, minor premise, and conclusion when they are present.',
      'Flag missing premises and conclusions that do not follow from the stated premises.',
      'Show where a premise needs qualification or evidence.',
    ],
    repairs: [
      'State the missing premise instead of relying on reader inference.',
      'Rewrite the conclusion so it follows from the premises actually proven.',
      'Add evidence for the premise most likely to be disputed.',
    ],
    caution: 'Syllogisms clarify deductive form, but many real arguments also need empirical support and value judgment.',
  }),
  modelPage({
    slug: 'enthymeme',
    name: 'Enthymeme',
    lead:
      'The enthymeme lens finds the premise the audience is expected to supply. It is powerful because many persuasive drafts rely on unstated shared beliefs.',
    bestFor: [
      'Speeches, essays, ads, and opinion pieces that depend on audience assumptions.',
      'Drafts that feel persuasive to insiders but confusing or alienating to outsiders.',
      'Revisions where the writer needs to decide whether to state, prove, or abandon an assumption.',
    ],
    fractureUse: [
      'Infer the missing premise that connects evidence to conclusion.',
      'Estimate whether the target audience is likely to grant that premise.',
      'Flag assumptions that need proof because the audience may not share them.',
    ],
    repairs: [
      'Make the missing premise explicit when the audience may resist it.',
      'Add backing for the assumption if it carries the argument.',
      'Remove insider shorthand that makes the case depend on tribal agreement.',
    ],
    caution: 'An enthymeme can be rhetorically effective and still be ethically risky if it exploits an assumption the writer would not defend openly.',
  }),
  modelPage({
    slug: 'monroes-motivated-sequence',
    name: "Monroe's Motivated Sequence",
    lead:
      "Monroe's sequence helps persuasive writing move from attention to need, satisfaction, visualization, and action without losing the reader.",
    bestFor: [
      'Speeches, campaign pages, advocacy writing, and calls to action.',
      'Drafts with good information but weak emotional and practical progression.',
      'Revisions where the final ask arrives before the reader feels the need.',
    ],
    fractureUse: [
      'Map the draft against attention, need, satisfaction, visualization, and action.',
      'Flag missing emotional stakes or action steps that arrive without proof.',
      'Check whether the visualization follows from the solution rather than exaggerating it.',
    ],
    repairs: [
      'Move the need earlier if the reader does not yet care.',
      'Make the proposed action concrete and proportionate.',
      'Replace inflated future claims with a credible before-and-after picture.',
    ],
    caution: "Monroe's sequence is persuasive, so it should be used with extra care around exaggeration and emotional pressure.",
  }),
  modelPage({
    slug: 'dependency-model',
    name: 'Dependency Model',
    lead:
      'The Dependency Model shows which claims rely on which earlier claims. It is useful when one weak sentence quietly supports half the draft.',
    bestFor: [
      'Long essays, strategic memos, research briefs, and complex debate cases.',
      'Drafts where the reader can follow individual paragraphs but not the whole proof chain.',
      'Revisions where the writer needs to find the fastest path to structural improvement.',
    ],
    fractureUse: [
      'Build a dependency chain from thesis to claims to subclaims and evidence.',
      'Find claims with many downstream dependencies and weak support.',
      'Identify collapse points where one repair improves the whole argument.',
    ],
    repairs: [
      'Strengthen the highest-dependency claim before editing lower-impact sentences.',
      'Split claims that carry too much burden for one paragraph.',
      'Reorder sections so each dependency is established before it is used.',
    ],
    caution: 'Dependency maps reveal structural risk, but writers still need to decide which risks are acceptable for the audience and format.',
  }),
  modelPage({
    slug: 'casuistry',
    name: 'Casuistry',
    lead:
      'Casuistry uses case comparison, precedent, and distinguishing facts to reason through hard judgment calls without pretending every case is identical.',
    bestFor: [
      'Ethics, policy, law-adjacent reasoning, and institutional decision memos.',
      'Drafts that lean on precedent but do not explain why the precedent fits.',
      'Arguments where small factual differences change the recommended action.',
    ],
    fractureUse: [
      'Identify the precedent case, target case, and facts used to connect them.',
      'Flag differences the draft ignores or minimizes.',
      'Suggest distinctions that make the comparison fairer and more persuasive.',
    ],
    repairs: [
      'State the relevant similarities and differences explicitly.',
      'Avoid treating analogy as proof when the cases diverge on decisive facts.',
      'Add a limiting principle so the argument does not overgeneralize.',
    ],
    caution: 'Case comparison can clarify judgment, but it can also smuggle in bias if the selected precedent is unrepresentative.',
  }),
  modelPage({
    slug: 'evolutionary-conceptual-change',
    name: 'Evolutionary Conceptual Change',
    lead:
      'Evolutionary Conceptual Change helps writers move readers from an old mental model to a better one through dissatisfaction, intelligibility, plausibility, and usefulness.',
    bestFor: [
      'Thought leadership, teaching material, category narratives, and strategy memos.',
      'Drafts that ask readers to abandon an old frame, not just accept a new fact.',
      'Revisions where the argument explains the new idea but not why the old idea fails.',
    ],
    fractureUse: [
      'Identify the old model, the dissatisfaction with it, and the proposed replacement.',
      'Check whether the new model is understandable, plausible, and useful.',
      'Flag leaps where the reader is asked to switch frames without enough support.',
    ],
    repairs: [
      'Show the failure of the old model with a concrete example.',
      'Explain the new model in language the audience can use immediately.',
      'Demonstrate usefulness before asking for full belief.',
    ],
    caution: "Conceptual change takes patience. A clever new frame will fail if the draft rushes past the reader's current model.",
  }),
];

export const empirePages: EmpirePage[] = [...corePages, ...modelPages];

export const empireRouteSlugs = empirePages.map((page) => page.slug);

export const empirePageIndex = empirePages.reduce<Record<string, EmpirePage>>((index, page) => {
  index[page.slug] = page;
  return index;
}, {});

export function normalizeEmpirePageSlug(slug: string | undefined): string {
  return (slug ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function getEmpirePage(slug: string | undefined): EmpirePage | undefined {
  return empirePageIndex[normalizeEmpirePageSlug(slug)];
}
