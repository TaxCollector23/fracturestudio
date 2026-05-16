import {
  Activity,
  ClipboardCheck,
  HelpCircle,
  Library,
  Mic,
  Quote,
  Search,
  type LucideIcon,
} from 'lucide-react';

export type ToolLabSlug =
  | 'analyze'
  | 'speech-lab'
  | 'audience-questions'
  | 'evidence-lab'
  | 'citations'
  | 'rubric-checker'
  | 'search';

export type ToolLabInput = {
  id: string;
  label: string;
  helper: string;
  placeholder: string;
  kind: 'text' | 'textarea';
  rows?: number;
  required?: boolean;
};

export type ToolLabSelectControl = {
  id: string;
  label: string;
  description: string;
  type: 'select';
  defaultValue: string;
  options: Array<{
    label: string;
    value: string;
    description: string;
  }>;
};

export type ToolLabToggleControl = {
  id: string;
  label: string;
  description: string;
  type: 'toggle';
  defaultChecked: boolean;
};

export type ToolLabRangeControl = {
  id: string;
  label: string;
  description: string;
  type: 'range';
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export type ToolLabControl = ToolLabSelectControl | ToolLabToggleControl | ToolLabRangeControl;

export type ToolLabMetric = {
  label: string;
  target: string;
  description: string;
};

export type ToolLabOutputSection = {
  title: string;
  description: string;
  bullets: string[];
};

export type ToolLabTheme = {
  icon: string;
  border: string;
  wash: string;
};

export type ToolLabDefinition = {
  slug: ToolLabSlug;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  primaryAction: string;
  secondaryAction: string;
  statusLabel: string;
  theme: ToolLabTheme;
  inputs: ToolLabInput[];
  controls: ToolLabControl[];
  metrics: ToolLabMetric[];
  runChecklist: string[];
  emptyState: {
    title: string;
    body: string;
  };
  outputSections: ToolLabOutputSection[];
};

export const toolLabs: ToolLabDefinition[] = [
  {
    slug: 'analyze',
    label: 'Analyze',
    eyebrow: 'Argument diagnostics',
    title: 'Analyze the structure before you revise the prose.',
    description:
      'Pressure-test a draft for thesis precision, warrant exposure, claim support, contradiction risk, and the next revision move.',
    icon: Activity,
    primaryAction: 'Prepare analysis packet',
    secondaryAction: 'Save diagnostic brief',
    statusLabel: 'Logic lab',
    theme: {
      icon: 'text-emerald-300',
      border: 'border-emerald-900/60',
      wash: 'bg-emerald-950/20',
    },
    inputs: [
      {
        id: 'draft',
        label: 'Draft or argument excerpt',
        helper: 'Paste enough text to expose the thesis, main claims, and evidence pattern.',
        placeholder:
          'Example: My central claim is... The first reason is... The strongest evidence is... The counterargument I expect is...',
        kind: 'textarea',
        rows: 10,
        required: true,
      },
      {
        id: 'assignment',
        label: 'Prompt, resolution, or assignment',
        helper: 'Add the task the argument must satisfy so the lab can judge relevance.',
        placeholder: 'Example: Evaluate whether local governments should require climate risk disclosures for new housing projects.',
        kind: 'textarea',
        rows: 4,
      },
      {
        id: 'knownWeakness',
        label: 'Known weak spot',
        helper: 'Name the part you already distrust so the run can inspect it first.',
        placeholder: 'Example: I am not sure my second warrant proves causation rather than correlation.',
        kind: 'text',
      },
    ],
    controls: [
      {
        id: 'lens',
        label: 'Analysis lens',
        description: 'Choose the decision-maker the draft must survive.',
        type: 'select',
        defaultValue: 'skeptical-reader',
        options: [
          {
            label: 'Skeptical reader',
            value: 'skeptical-reader',
            description: 'Prioritizes clarity, unstated assumptions, and burden of proof.',
          },
          {
            label: 'Debate judge',
            value: 'debate-judge',
            description: 'Prioritizes claim clash, impact weighing, and dropped responses.',
          },
          {
            label: 'Instructor',
            value: 'instructor',
            description: 'Prioritizes assignment fit, organization, and source integration.',
          },
        ],
      },
      {
        id: 'strictness',
        label: 'Strictness',
        description: 'Higher strictness flags smaller gaps and weaker transitions.',
        type: 'range',
        defaultValue: 7,
        min: 1,
        max: 10,
        step: 1,
      },
      {
        id: 'includeGraph',
        label: 'Include claim graph',
        description: 'Ask the runner to return nodes, edges, and unsupported links.',
        type: 'toggle',
        defaultChecked: true,
      },
    ],
    metrics: [
      {
        label: 'Claim precision',
        target: 'Every major claim is falsifiable',
        description: 'Looks for broad claims that need a measurable scope or condition.',
      },
      {
        label: 'Warrant exposure',
        target: 'No hidden logical leap',
        description: 'Checks whether evidence actually proves the claim it is attached to.',
      },
      {
        label: 'Revision priority',
        target: 'Top 3 fixes ranked',
        description: 'Ranks fixes by how much they improve the argument, not by sentence order.',
      },
    ],
    runChecklist: [
      'Identify the thesis, primary claims, warrants, evidence, and counterclaims.',
      'Mark the most fragile inference and the exact sentence causing it.',
      'Separate local prose fixes from structural argument repairs.',
      'Return a revision order that a writer can execute in one pass.',
    ],
    emptyState: {
      title: 'No diagnostic run yet',
      body: 'Complete the draft field to create a runnable packet. The page will not invent scores before the analysis engine is connected.',
    },
    outputSections: [
      {
        title: 'Collapse point',
        description: 'The single place where the argument is most likely to fail.',
        bullets: ['Sentence or claim reference', 'Why the logic fails there', 'Repair move before style edits'],
      },
      {
        title: 'Claim graph',
        description: 'A compact map of claims, evidence, warrants, objections, and missing links.',
        bullets: ['Node list', 'Support and attack edges', 'Unsupported or circular connections'],
      },
      {
        title: 'Revision missions',
        description: 'Concrete edits ordered by argument value.',
        bullets: ['High-impact rewrite first', 'Evidence upgrade second', 'Polish tasks last'],
      },
    ],
  },
  {
    slug: 'speech-lab',
    label: 'Speech Lab',
    eyebrow: 'Delivery and timing',
    title: 'Turn a draft into a speech that can be heard, followed, and remembered.',
    description:
      'Shape a spoken argument around timing, cadence, transitions, evidence compression, and a clear final action.',
    icon: Mic,
    primaryAction: 'Prepare speech packet',
    secondaryAction: 'Export speaking outline',
    statusLabel: 'Delivery lab',
    theme: {
      icon: 'text-sky-300',
      border: 'border-sky-900/60',
      wash: 'bg-sky-950/20',
    },
    inputs: [
      {
        id: 'speechDraft',
        label: 'Speech draft',
        helper: 'Paste the spoken version, not just the essay version.',
        placeholder:
          'Example: Today I want to show why... First, the problem is... The evidence matters because... Here is what should happen next...',
        kind: 'textarea',
        rows: 10,
        required: true,
      },
      {
        id: 'speakerGoal',
        label: 'Speaker goal',
        helper: 'State what the audience should think, feel, or do afterward.',
        placeholder: 'Example: Move undecided city council members toward supporting a pilot program.',
        kind: 'text',
        required: true,
      },
      {
        id: 'deliveryConstraints',
        label: 'Room and format constraints',
        helper: 'Add format, time, slides, microphone, or Q&A limits.',
        placeholder: 'Example: 6 minutes, no slides, followed by two judge questions.',
        kind: 'textarea',
        rows: 4,
      },
    ],
    controls: [
      {
        id: 'mode',
        label: 'Speech mode',
        description: 'Select the rhetorical frame the outline should optimize for.',
        type: 'select',
        defaultValue: 'persuasive',
        options: [
          {
            label: 'Persuasive',
            value: 'persuasive',
            description: 'Builds toward a clear action or belief change.',
          },
          {
            label: 'Informative',
            value: 'informative',
            description: 'Prioritizes comprehension, structure, and recall.',
          },
          {
            label: 'Debate constructive',
            value: 'debate-constructive',
            description: 'Prioritizes signposting, impacts, and preemptive responses.',
          },
        ],
      },
      {
        id: 'minutes',
        label: 'Target length',
        description: 'A realistic speaking plan assumes roughly 125 to 150 words per minute.',
        type: 'range',
        defaultValue: 5,
        min: 1,
        max: 12,
        step: 1,
        unit: 'min',
      },
      {
        id: 'includeCues',
        label: 'Include delivery cues',
        description: 'Add pause, emphasis, breath, and transition markers to the packet.',
        type: 'toggle',
        defaultChecked: true,
      },
    ],
    metrics: [
      {
        label: 'Timing fit',
        target: 'Within target window',
        description: 'Checks likely spoken length against the selected time limit.',
      },
      {
        label: 'Cadence',
        target: 'One idea per beat',
        description: 'Finds dense sentences that need a pause, example, or split.',
      },
      {
        label: 'Call to action',
        target: 'Memorable final move',
        description: 'Confirms the close names what the audience should do next.',
      },
    ],
    runChecklist: [
      'Count the draft against the target speaking window.',
      'Detect dense passages that need shorter spoken phrasing.',
      'Mark hook, preview, transitions, evidence beats, and close.',
      'Produce a cue-ready outline without changing the claim burden.',
    ],
    emptyState: {
      title: 'No speaking outline yet',
      body: 'Add the speech draft and speaker goal to prepare a timing-aware run packet. The output area stays empty until a real runner returns a speech plan.',
    },
    outputSections: [
      {
        title: 'Timed flow',
        description: 'A section-by-section speaking outline with target seconds.',
        bullets: ['Hook and thesis', 'Claim blocks', 'Evidence compression', 'Closing action'],
      },
      {
        title: 'Delivery risks',
        description: 'Places where the audience may lose the thread.',
        bullets: ['Overlong sentences', 'Abrupt topic shifts', 'Unsignposted evidence'],
      },
      {
        title: 'Cue script',
        description: 'Optional notes for pauses, emphasis, and transitions.',
        bullets: ['Pause markers', 'Stress words', 'Recovery line after interruption'],
      },
    ],
  },
  {
    slug: 'audience-questions',
    label: 'Audience Questions',
    eyebrow: 'Question prediction',
    title: 'Prepare for the questions your audience is most likely to ask.',
    description:
      'Generate targeted audience, judge, stakeholder, and skeptic questions so the speaker can answer without drifting.',
    icon: HelpCircle,
    primaryAction: 'Prepare question packet',
    secondaryAction: 'Create answer drill',
    statusLabel: 'Q&A lab',
    theme: {
      icon: 'text-violet-300',
      border: 'border-violet-900/60',
      wash: 'bg-violet-950/20',
    },
    inputs: [
      {
        id: 'caseSummary',
        label: 'Case summary',
        helper: 'Give the thesis, core reasons, and evidence base the audience will hear.',
        placeholder:
          'Example: The speech argues that the district should adopt later school start times because attendance, mental health, and safety improve...',
        kind: 'textarea',
        rows: 8,
        required: true,
      },
      {
        id: 'audienceProfile',
        label: 'Audience profile',
        helper: 'Name who is asking questions and what they care about.',
        placeholder: 'Example: Parents split between academic performance concerns and transportation logistics.',
        kind: 'textarea',
        rows: 4,
        required: true,
      },
      {
        id: 'sensitiveAreas',
        label: 'Sensitive areas',
        helper: 'Add claims, tradeoffs, or facts that may draw pushback.',
        placeholder: 'Example: Cost estimates, bus schedules, and whether studies apply to our district.',
        kind: 'textarea',
        rows: 4,
      },
    ],
    controls: [
      {
        id: 'stance',
        label: 'Audience stance',
        description: 'Choose the default posture for predicted questions.',
        type: 'select',
        defaultValue: 'mixed',
        options: [
          {
            label: 'Mixed',
            value: 'mixed',
            description: 'Balances clarification, skepticism, and practical concerns.',
          },
          {
            label: 'Hostile',
            value: 'hostile',
            description: 'Pushes burden of proof, costs, contradictions, and concessions.',
          },
          {
            label: 'Curious',
            value: 'curious',
            description: 'Asks for examples, definitions, implications, and next steps.',
          },
        ],
      },
      {
        id: 'difficulty',
        label: 'Question difficulty',
        description: 'Higher difficulty asks more layered follow-ups.',
        type: 'range',
        defaultValue: 6,
        min: 1,
        max: 10,
        step: 1,
      },
      {
        id: 'includeFollowUps',
        label: 'Include follow-up chains',
        description: 'Create second and third questions if the first answer is weak.',
        type: 'toggle',
        defaultChecked: true,
      },
    ],
    metrics: [
      {
        label: 'Coverage',
        target: 'Every major claim receives a question',
        description: 'Checks that Q&A pressure is spread across the whole case.',
      },
      {
        label: 'Hostility mix',
        target: 'Clarifying and adversarial questions separated',
        description: 'Prevents the speaker from practicing only friendly prompts.',
      },
      {
        label: 'Answer readiness',
        target: 'Question paired with answer strategy',
        description: 'Prepares answer moves without scripting brittle paragraphs.',
      },
    ],
    runChecklist: [
      'Extract claims, assumptions, tradeoffs, and likely audience values.',
      'Generate clarification, challenge, evidence, cost, and implementation questions.',
      'Pair each question with a concise answer strategy.',
      'Mark follow-ups that expose unsupported or evasive answers.',
    ],
    emptyState: {
      title: 'No Q&A set yet',
      body: 'Add the case summary and audience profile to prepare a question run. The lab will not fabricate audience questions before those inputs exist.',
    },
    outputSections: [
      {
        title: 'Predicted questions',
        description: 'A ranked list of likely audience questions.',
        bullets: ['Clarifying prompts', 'Skeptical challenges', 'Evidence and implementation questions'],
      },
      {
        title: 'Answer strategy',
        description: 'How to respond without over-answering or conceding the wrong point.',
        bullets: ['Direct answer', 'Evidence anchor', 'Bridge back to thesis'],
      },
      {
        title: 'Follow-up chains',
        description: 'Question sequences that test whether the answer holds.',
        bullets: ['Second-order pushback', 'Concession traps', 'Closing recovery line'],
      },
    ],
  },
  {
    slug: 'evidence-lab',
    label: 'Evidence Lab',
    eyebrow: 'Source pressure',
    title: 'Find the evidence gaps before a reader does.',
    description:
      'Map claims to sources, locate unsupported warrants, flag stale evidence, and queue specific research upgrades.',
    icon: Library,
    primaryAction: 'Prepare evidence packet',
    secondaryAction: 'Queue source upgrades',
    statusLabel: 'Evidence lab',
    theme: {
      icon: 'text-amber-300',
      border: 'border-amber-900/60',
      wash: 'bg-amber-950/20',
    },
    inputs: [
      {
        id: 'claims',
        label: 'Claims to support',
        helper: 'List one claim per line so coverage can be checked cleanly.',
        placeholder:
          'Example:\nLater start times improve attendance.\nBus routing changes are manageable.\nThe policy reduces chronic sleep deprivation.',
        kind: 'textarea',
        rows: 8,
        required: true,
      },
      {
        id: 'sources',
        label: 'Current sources',
        helper: 'Paste citations, URLs, titles, notes, or source summaries.',
        placeholder:
          'Example: Wahlstrom et al. 2014 study on school start times; CDC sleep guidance; district transportation budget memo...',
        kind: 'textarea',
        rows: 8,
      },
      {
        id: 'mustProve',
        label: 'Hardest thing to prove',
        helper: 'Tell the lab which claim needs the strongest standard.',
        placeholder: 'Example: That benefits still appear in districts with long bus routes.',
        kind: 'text',
      },
    ],
    controls: [
      {
        id: 'standard',
        label: 'Evidence standard',
        description: 'Select the proof threshold for marking a claim supported.',
        type: 'select',
        defaultValue: 'academic',
        options: [
          {
            label: 'Academic',
            value: 'academic',
            description: 'Requires credible sources, method clarity, and precise claim fit.',
          },
          {
            label: 'Debate round',
            value: 'debate-round',
            description: 'Prioritizes recency, author qualification, and impact relevance.',
          },
          {
            label: 'Policy memo',
            value: 'policy-memo',
            description: 'Prioritizes implementation data, cost, and local applicability.',
          },
        ],
      },
      {
        id: 'freshness',
        label: 'Freshness window',
        description: 'Sources older than this window should receive extra scrutiny.',
        type: 'range',
        defaultValue: 5,
        min: 1,
        max: 15,
        step: 1,
        unit: 'yr',
      },
      {
        id: 'showWeakest',
        label: 'Surface weakest links first',
        description: 'Prioritize missing, stale, or low-fit evidence over bibliography cleanup.',
        type: 'toggle',
        defaultChecked: true,
      },
    ],
    metrics: [
      {
        label: 'Claim coverage',
        target: 'One credible source per major claim',
        description: 'Identifies claims that still rest on assertion or anecdote.',
      },
      {
        label: 'Source fit',
        target: 'Evidence proves the exact claim',
        description: 'Catches sources that are credible but attached to the wrong burden.',
      },
      {
        label: 'Freshness risk',
        target: 'Stale evidence justified or replaced',
        description: 'Flags dates that matter for fast-changing topics.',
      },
    ],
    runChecklist: [
      'Split the argument into source-bound claims.',
      'Match every source to the claim it can actually prove.',
      'Flag stale, overgeneralized, missing, or low-authority evidence.',
      'Return a research queue with exact source types to find next.',
    ],
    emptyState: {
      title: 'No evidence report yet',
      body: 'Add claims and any available source notes to prepare an evidence review. Blank claims cannot be responsibly scored.',
    },
    outputSections: [
      {
        title: 'Coverage matrix',
        description: 'Claim-by-claim support state.',
        bullets: ['Supported claims', 'Under-supported claims', 'Claims with no evidence'],
      },
      {
        title: 'Credibility flags',
        description: 'Source risks that affect trust.',
        bullets: ['Missing author or date', 'Weak authority signal', 'Stale or nonlocal evidence'],
      },
      {
        title: 'Upgrade queue',
        description: 'Research tasks ordered by argument value.',
        bullets: ['Find a methodologically stronger source', 'Replace a stale statistic', 'Add a counterexample check'],
      },
    ],
  },
  {
    slug: 'citations',
    label: 'Citations',
    eyebrow: 'Bibliography integrity',
    title: 'Build citations that are complete, traceable, and tied to claims.',
    description:
      'Clean source metadata, choose a citation style, detect missing fields, and keep each citation attached to the claim it supports.',
    icon: Quote,
    primaryAction: 'Prepare citation packet',
    secondaryAction: 'Export bibliography',
    statusLabel: 'Citation lab',
    theme: {
      icon: 'text-rose-300',
      border: 'border-rose-900/60',
      wash: 'bg-rose-950/20',
    },
    inputs: [
      {
        id: 'sourceRecords',
        label: 'Source records',
        helper: 'Paste one source per block with as much metadata as you have.',
        placeholder:
          'Example:\nTitle: Adolescent Sleep and School Start Times\nAuthors: Wahlstrom, Dretzke, Gordon...\nYear: 2014\nURL or DOI: ...',
        kind: 'textarea',
        rows: 10,
        required: true,
      },
      {
        id: 'claimBindings',
        label: 'Claim bindings',
        helper: 'Connect source records to the claims they support.',
        placeholder: 'Example: Wahlstrom 2014 supports the attendance and sleep-duration claims, not the transportation-cost claim.',
        kind: 'textarea',
        rows: 5,
      },
      {
        id: 'styleNotes',
        label: 'Instructor or venue notes',
        helper: 'Add citation preferences that override the standard style guide.',
        placeholder: 'Example: Use APA 7, include DOI when available, annotate sources in two sentences.',
        kind: 'text',
      },
    ],
    controls: [
      {
        id: 'style',
        label: 'Citation style',
        description: 'Select the output style to prepare.',
        type: 'select',
        defaultValue: 'apa',
        options: [
          {
            label: 'APA 7',
            value: 'apa',
            description: 'Author-date style for social science and research writing.',
          },
          {
            label: 'MLA 9',
            value: 'mla',
            description: 'Works Cited style for humanities and classroom essays.',
          },
          {
            label: 'Chicago Notes',
            value: 'chicago-notes',
            description: 'Footnote-oriented style for history and long-form writing.',
          },
        ],
      },
      {
        id: 'metadataStrictness',
        label: 'Metadata strictness',
        description: 'Higher strictness rejects sources with incomplete author, date, publisher, DOI, or URL fields.',
        type: 'range',
        defaultValue: 8,
        min: 1,
        max: 10,
        step: 1,
      },
      {
        id: 'includeInText',
        label: 'Include in-text citation prompts',
        description: 'Prepare parenthetical or footnote prompts next to claim bindings.',
        type: 'toggle',
        defaultChecked: true,
      },
    ],
    metrics: [
      {
        label: 'Metadata completeness',
        target: 'Required fields present',
        description: 'Checks whether each source has the fields its style needs.',
      },
      {
        label: 'Format readiness',
        target: 'Style-specific order and punctuation',
        description: 'Separates missing data from formatting cleanup.',
      },
      {
        label: 'Claim binding',
        target: 'Citation is attached to a specific claim',
        description: 'Avoids bibliography entries that never support the argument.',
      },
    ],
    runChecklist: [
      'Parse source records into structured citation fields.',
      'Identify missing fields required by the selected style.',
      'Create bibliography entries only from available metadata.',
      'Generate citation prompts beside the claims they support.',
    ],
    emptyState: {
      title: 'No bibliography packet yet',
      body: 'Paste source records to prepare citation cleanup. The lab will not invent authors, dates, publishers, URLs, or DOIs.',
    },
    outputSections: [
      {
        title: 'Clean bibliography',
        description: 'Formatted entries with missing fields clearly marked.',
        bullets: ['APA, MLA, or Chicago format', 'Unknown fields left explicit', 'No invented metadata'],
      },
      {
        title: 'Citation risks',
        description: 'Problems that could cost credibility or points.',
        bullets: ['Missing author/date', 'Unclear publisher', 'URL or DOI needs verification'],
      },
      {
        title: 'In-text prompts',
        description: 'Where each source should appear in the draft.',
        bullets: ['Claim reference', 'Suggested parenthetical or note', 'Quote/paraphrase reminder'],
      },
    ],
  },
  {
    slug: 'rubric-checker',
    label: 'Rubric Checker',
    eyebrow: 'Criteria alignment',
    title: 'Compare the draft against the actual scoring criteria.',
    description:
      'Translate rubric language into checkable criteria, find point-risk gaps, and rank revisions by likely score impact.',
    icon: ClipboardCheck,
    primaryAction: 'Prepare rubric packet',
    secondaryAction: 'Create revision plan',
    statusLabel: 'Rubric lab',
    theme: {
      icon: 'text-lime-300',
      border: 'border-lime-900/60',
      wash: 'bg-lime-950/20',
    },
    inputs: [
      {
        id: 'rubric',
        label: 'Rubric or scoring criteria',
        helper: 'Paste the actual rubric text, point categories, or judge paradigm.',
        placeholder:
          'Example: Thesis 20 pts, evidence 25 pts, organization 20 pts, counterargument 15 pts, mechanics 20 pts...',
        kind: 'textarea',
        rows: 8,
        required: true,
      },
      {
        id: 'draft',
        label: 'Draft to check',
        helper: 'Paste the draft or the section you want scored against the rubric.',
        placeholder: 'Example: Paste introduction, body paragraphs, conclusion, or the complete case.',
        kind: 'textarea',
        rows: 10,
        required: true,
      },
      {
        id: 'teacherNotes',
        label: 'Instructor or judge notes',
        helper: 'Add feedback history or preferences that should affect the read.',
        placeholder: 'Example: Instructor wants more counterargument and less summary; judge dislikes vague impacts.',
        kind: 'textarea',
        rows: 4,
      },
    ],
    controls: [
      {
        id: 'scoringMode',
        label: 'Scoring mode',
        description: 'Choose how conservative the checker should be with points.',
        type: 'select',
        defaultValue: 'point-risk',
        options: [
          {
            label: 'Point-risk',
            value: 'point-risk',
            description: 'Finds where points are most likely to be lost.',
          },
          {
            label: 'Mastery',
            value: 'mastery',
            description: 'Checks whether criteria are fully demonstrated, not just mentioned.',
          },
          {
            label: 'Judge ballot',
            value: 'judge-ballot',
            description: 'Frames feedback as a decision-maker explaining the result.',
          },
        ],
      },
      {
        id: 'targetScore',
        label: 'Target score',
        description: 'The checker ranks fixes needed to reach this target.',
        type: 'range',
        defaultValue: 90,
        min: 60,
        max: 100,
        step: 5,
        unit: '%',
      },
      {
        id: 'nearMisses',
        label: 'Surface near-misses',
        description: 'Show places where the draft gestures at a criterion but does not yet earn it.',
        type: 'toggle',
        defaultChecked: true,
      },
    ],
    metrics: [
      {
        label: 'Criteria coverage',
        target: 'Each rubric row mapped to evidence',
        description: 'Checks whether every criterion appears in the draft.',
      },
      {
        label: 'Point risk',
        target: 'Highest-value gaps first',
        description: 'Ranks revision work by likely scoring impact.',
      },
      {
        label: 'Near-miss clarity',
        target: 'Partial credit risks named',
        description: 'Distinguishes between absent criteria and underdeveloped criteria.',
      },
    ],
    runChecklist: [
      'Parse the rubric into checkable criteria and point weights.',
      'Map draft evidence to each criterion.',
      'Identify missing, partial, and strong alignments.',
      'Return a revision plan ordered by target-score impact.',
    ],
    emptyState: {
      title: 'No rubric read yet',
      body: 'Paste both rubric and draft to prepare a valid alignment run. A rubric score without both inputs would be misleading.',
    },
    outputSections: [
      {
        title: 'Criteria matrix',
        description: 'Every rubric row matched against draft evidence.',
        bullets: ['Met criteria', 'Partial criteria', 'Missing criteria'],
      },
      {
        title: 'Point-risk notes',
        description: 'Where the draft is most likely to lose credit.',
        bullets: ['High-value category risk', 'Near-miss explanation', 'Evidence needed to earn the point'],
      },
      {
        title: 'Revision ladder',
        description: 'A prioritized path toward the selected target score.',
        bullets: ['First repair', 'Second repair', 'Polish after structure is fixed'],
      },
    ],
  },
  {
    slug: 'search',
    label: 'Search',
    eyebrow: 'Research query builder',
    title: 'Design searches that return sources you can actually use.',
    description:
      'Turn a research need into precise queries, source filters, verification steps, and evidence targets before live search runs.',
    icon: Search,
    primaryAction: 'Prepare search packet',
    secondaryAction: 'Save query plan',
    statusLabel: 'Search lab',
    theme: {
      icon: 'text-cyan-300',
      border: 'border-cyan-900/60',
      wash: 'bg-cyan-950/20',
    },
    inputs: [
      {
        id: 'researchQuestion',
        label: 'Research question',
        helper: 'Ask the question the evidence must answer, not just broad keywords.',
        placeholder: 'Example: Do later school start times improve attendance in suburban districts with long bus routes?',
        kind: 'textarea',
        rows: 5,
        required: true,
      },
      {
        id: 'mustInclude',
        label: 'Must include or exclude',
        helper: 'Add required terms, exclusions, date limits, jurisdictions, or populations.',
        placeholder: 'Example: include longitudinal studies; exclude opinion editorials; prefer US districts after 2018.',
        kind: 'textarea',
        rows: 4,
      },
      {
        id: 'evidenceNeed',
        label: 'Evidence need',
        helper: 'Name the type of source that would change the argument.',
        placeholder: 'Example: A recent district-level implementation study with attendance and transportation outcomes.',
        kind: 'text',
      },
    ],
    controls: [
      {
        id: 'sourceType',
        label: 'Source type',
        description: 'Choose the source family the query plan should favor.',
        type: 'select',
        defaultValue: 'scholarly-policy',
        options: [
          {
            label: 'Scholarly and policy',
            value: 'scholarly-policy',
            description: 'Balances peer-reviewed research with implementation reports.',
          },
          {
            label: 'News and current events',
            value: 'news-current',
            description: 'Prioritizes recency, reporting provenance, and corroboration.',
          },
          {
            label: 'Primary documents',
            value: 'primary-documents',
            description: 'Looks for laws, budgets, transcripts, datasets, and official records.',
          },
        ],
      },
      {
        id: 'recency',
        label: 'Recency window',
        description: 'The query plan should prefer sources inside this window when the topic is current.',
        type: 'range',
        defaultValue: 6,
        min: 1,
        max: 20,
        step: 1,
        unit: 'yr',
      },
      {
        id: 'requireVerification',
        label: 'Require verification path',
        description: 'Include a second-source or primary-source check for each result type.',
        type: 'toggle',
        defaultChecked: true,
      },
    ],
    metrics: [
      {
        label: 'Query precision',
        target: 'Search terms map to the evidence need',
        description: 'Keeps the search from drifting into broad background reading.',
      },
      {
        label: 'Source diversity',
        target: 'At least two source families',
        description: 'Prevents the packet from relying on one kind of authority.',
      },
      {
        label: 'Verification path',
        target: 'Every result type has a trust check',
        description: 'Names how to confirm claims before adding them to the draft.',
      },
    ],
    runChecklist: [
      'Translate the research question into targeted search strings.',
      'Add must-include terms, exclusions, and source-family filters.',
      'Define what counts as usable evidence before results arrive.',
      'Return verification steps for claims, statistics, and quoted material.',
    ],
    emptyState: {
      title: 'No search packet yet',
      body: 'Add a research question to prepare a query plan. This page does not perform live search until a search runner is wired in.',
    },
    outputSections: [
      {
        title: 'Query set',
        description: 'Search strings built for the selected source family.',
        bullets: ['Broad query', 'Narrow query', 'Counterexample query'],
      },
      {
        title: 'Source targets',
        description: 'What kind of result should be accepted or rejected.',
        bullets: ['Primary source target', 'Scholarly or expert target', 'Current context target'],
      },
      {
        title: 'Verification plan',
        description: 'How each useful result should be checked before citation.',
        bullets: ['Trace to original', 'Confirm date and author', 'Corroborate contested facts'],
      },
    ],
  },
];

export const toolLabSlugs = toolLabs.map((lab) => lab.slug);

export function getToolLab(slug: string | undefined): ToolLabDefinition | undefined {
  return toolLabs.find((lab) => lab.slug === slug);
}
