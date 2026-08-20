const KEY = "fracture_prefs";

export const DEFAULT_PREFS = {
  analysisFormat: "argument", // argument | speech | essay | research-paper | rubric | model-un
  depthLevel: "medium",       // surface | medium | extreme
  citationStyle: "mla",       // mla | apa
  feedbackTone: "direct"
};

export const FORMATS = [
  { id: "argument", label: "Argument / Debate" },
  { id: "speech", label: "Speech / Presentation" },
  { id: "essay", label: "Essay / Writing" },
  { id: "research-paper", label: "Research Paper" },
  { id: "rubric", label: "Rubric Grading" },
  { id: "model-un", label: "Model UN" }
];

export const DEPTHS = [
  { id: "surface", label: "Surface", hint: "Fast 3-fix clarity check" },
  { id: "medium", label: "Medium", hint: "Full report, balanced" },
  { id: "extreme", label: "Extreme", hint: "Deep forensic audit" }
];

export function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch (_) { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}
