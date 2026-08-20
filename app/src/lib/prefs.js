const KEY = "fracture_prefs";

export const DEFAULT_PREFS = {
  analysisFormat: "argument", // argument | speech | essay | college-essay | research-paper | rubric | model-un
  depthLevel: "medium",       // surface | medium | extreme
  citationStyle: "mla",       // mla | apa
  feedbackTone: "direct",
  // Profile (set during onboarding, editable in Settings):
  role: "student",            // speaker | debater | coach | judge | student
  event: "",                  // primary event id (see EVENTS)
  focus: "",                  // what they're working toward
  onboardingDone: false
};

// Who the user is — personalizes the dashboard, recommendations, and nav copy.
export const ROLES = [
  { id: "debater", label: "Debater", hint: "Policy, LD, Public Forum, Congress — prepare for rounds." },
  { id: "speaker", label: "Speaker", hint: "Speech, interpretation, impromptu, extemp — perform and deliver." },
  { id: "coach", label: "Coach", hint: "Run your own prep and track progress; team tools are coming." },
  { id: "judge", label: "Judge", hint: "Understand scoring and rubrics; calibration tools are coming." },
  { id: "student", label: "Student", hint: "Essays, research papers, and general argument writing." }
];

// Events map to the analysis format that best serves them.
export const EVENTS = [
  { id: "debate", label: "Debate (Policy / LD / Public Forum)", format: "argument" },
  { id: "congress", label: "Congress / Model UN", format: "model-un" },
  { id: "speech", label: "Speech & interpretation", format: "speech" },
  { id: "impromptu", label: "Impromptu / Extemp", format: "speech" },
  { id: "essay", label: "Essays & research", format: "essay" }
];

export const FOCUSES = [
  { id: "improve-score", label: "Raise my average score" },
  { id: "tournament", label: "Prepare for an upcoming tournament" },
  { id: "regular", label: "Practice regularly and stay sharp" },
  { id: "coach", label: "Coach or grade others" }
];

export const eventById = (id) => EVENTS.find((e) => e.id === id) || null;
export const roleById = (id) => ROLES.find((r) => r.id === id) || ROLES[4];

export const FORMATS = [
  { id: "argument", label: "Argument / Debate", hint: "Grade claim, warrant, evidence, and impact structure. Finds the collapse point and opponent attacks." },
  { id: "speech", label: "Speech / Presentation", hint: "Hook, signposting, delivery markup, memorability, and audience clarity for spoken pieces." },
  { id: "essay", label: "Essay / Writing", hint: "Thesis, paragraph structure, transitions, evidence integration, and tone." },
  { id: "college-essay", label: "College Essay", hint: "Close reading, academic voice, and thesis pressure-testing under a professor's scrutiny." },
  { id: "research-paper", label: "Research Paper", hint: "Research question, section architecture, citation coverage, and source quality." },
  { id: "rubric", label: "Rubric Grading", hint: "Paste your rubric and Fracture grades each criterion and maps a point-recovery plan." },
  { id: "model-un", label: "Model UN", hint: "Position papers, resolution clauses, country-accuracy, and caucus strategy." }
];

export const DEPTHS = [
  { id: "surface", label: "Surface", hint: "Fast 3-fix clarity check", blurb: "A quick pre-submission pass — the top problems and a direct repair for each." },
  { id: "medium", label: "Medium", hint: "Full report, balanced", blurb: "The default. A complete audit with claims, assumptions, counterarguments, sources, and a revision path." },
  { id: "extreme", label: "Extreme", hint: "Deep forensic audit", blurb: "A tournament-grade teardown — every assumption, 5-7 opponent attacks, impact weighing, and missing arguments." }
];

export function formatById(id) {
  return FORMATS.find((f) => f.id === id) || FORMATS[0];
}

export function depthById(id) {
  return DEPTHS.find((d) => d.id === id) || DEPTHS[1];
}

export function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch (_) { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}
