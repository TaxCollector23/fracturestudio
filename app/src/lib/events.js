// events.js — flexible event definitions for the competition layer.
//
// An event is plain data: a name, a format id, a participant type
// (individual | team), optional fixed sides, a timing structure (ordered
// slots: speeches, prep, crossfire), and a rubric id. Nothing is hardcoded
// into pages — new formats are new entries in EVENT_FORMATS, and tournaments
// can define custom events that override slots and rubric entirely.

// A slot is one timed segment of a round:
//   kind: speech | prep | crossfire | custom
//   label: shown in the control center
//   seconds: default duration
//   speaker: optional index into the participant order (0-based) for speeches
export function slot(kind, label, seconds, extra = {}) {
  return { kind, label, seconds, ...extra };
}

export const SIDES = {
  "public-forum": [
    { id: "pro", label: "Pro" },
    { id: "con", label: "Con" }
  ],
  "ld": [
    { id: "aff", label: "Aff" },
    { id: "neg", label: "Neg" }
  ],
  "policy": [
    { id: "aff", label: "Affirmative" },
    { id: "neg", label: "Negative" }
  ]
};

export const PARTICIPANT_TYPES = [
  { id: "individual", label: "Individual competitors" },
  { id: "team", label: "Teams of two" }
];

// ─── Timing structures ──────────────────────────────────────────────────────
// Public Forum: 4 constructives + 4 rebuttals, prep + 3 crossfires.
const PF_SLOTS = [
  slot("speech", "Pro constructive 1", 240, { speaker: 0 }),
  slot("speech", "Con constructive 1", 240, { speaker: 1 }),
  slot("crossfire", "Crossfire 1", 180),
  slot("speech", "Pro constructive 2", 240, { speaker: 0 }),
  slot("speech", "Con constructive 2", 240, { speaker: 1 }),
  slot("crossfire", "Crossfire 2", 180),
  slot("prep", "Pro prep", 120),
  slot("speech", "Pro rebuttal", 180, { speaker: 0 }),
  slot("prep", "Con prep", 120),
  slot("speech", "Con rebuttal", 180, { speaker: 1 }),
  slot("crossfire", "Grand crossfire", 180)
];

// Lincoln-Douglas: standard 6 speech structure with prep between speeches.
const LD_SLOTS = [
  slot("speech", "Affirmative constructive (AC)", 360, { speaker: 0 }),
  slot("speech", "Negative constructive (NC)", 360, { speaker: 1 }),
  slot("prep", "Aff prep", 120),
  slot("speech", "Affirmative rebuttal (1AR)", 240, { speaker: 0 }),
  slot("prep", "Neg prep", 120),
  slot("speech", "Negative rebuttal (NR)", 300, { speaker: 1 }),
  slot("prep", "Aff prep", 120),
  slot("speech", "Affirmative rebuttal (2AR)", 180, { speaker: 0 })
];

// Policy: 8 constructives + 4 rebuttals with 2 prep blocks per team.
const POLICY_SLOTS = [
  slot("speech", "1AC", 480, { speaker: 0 }),
  slot("speech", "1NC", 480, { speaker: 1 }),
  slot("speech", "2AC", 480, { speaker: 0 }),
  slot("speech", "2NC", 480, { speaker: 1 }),
  slot("speech", "1NR", 300, { speaker: 1 }),
  slot("speech", "1AR", 300, { speaker: 0 }),
  slot("speech", "2NR", 300, { speaker: 1 }),
  slot("speech", "2AR", 300, { speaker: 0 }),
  slot("prep", "Aff prep", 480),
  slot("prep", "Neg prep", 480)
];

// Speech events: one continuous speech, prep before it.
const SPEECH_SLOTS = (speechSeconds) => [
  slot("prep", "Prep", 180),
  slot("speech", "Speech", speechSeconds)
];

export const EVENT_FORMATS = {
  "public-forum": {
    id: "public-forum",
    name: "Public Forum",
    participantType: "team",
    sides: SIDES["public-forum"],
    slots: PF_SLOTS,
    rubricId: "public-forum",
    description: "Two teams of two debate a resolution; judges pick a winning side."
  },
  "ld": {
    id: "ld",
    name: "Lincoln-Douglas",
    participantType: "individual",
    sides: SIDES["ld"],
    slots: LD_SLOTS,
    rubricId: "ld",
    description: "One-on-one value debate; judges pick a winning side."
  },
  "policy": {
    id: "policy",
    name: "Policy Debate",
    participantType: "team",
    sides: SIDES["policy"],
    slots: POLICY_SLOTS,
    rubricId: "policy",
    description: "Two teams of two debate a plan; judges pick a winning side."
  },
  "congress": {
    id: "congress",
    name: "Congressional Debate",
    participantType: "individual",
    sides: [],
    slots: [
      slot("speech", "Speech", 180),
      slot("custom", "Questioning", 60),
      slot("custom", "Precedence & recency", 30)
    ],
    rubricId: "congress",
    description: "Legislative chamber; judges rank speakers each session."
  },
  "oratory": {
    id: "oratory",
    name: "Original Oratory",
    participantType: "individual",
    sides: [],
    slots: SPEECH_SLOTS(600),
    rubricId: "oratory",
    description: "A prepared persuasive speech, performed; judges rank speakers."
  },
  "extemp": {
    id: "extemp",
    name: "Extemporaneous Speaking",
    participantType: "individual",
    sides: [],
    slots: SPEECH_SLOTS(420),
    rubricId: "extemp",
    description: "A drawn question answered from a researched speech; judges rank."
  },
  "impromptu": {
    id: "impromptu",
    name: "Impromptu",
    participantType: "individual",
    sides: [],
    slots: SPEECH_SLOTS(300),
    rubricId: "impromptu",
    description: "A prompt drawn on the spot; judges rank speakers."
  },
  "custom": {
    id: "custom",
    name: "Custom event",
    participantType: "individual",
    sides: [],
    slots: [
      slot("speech", "Speech", 300),
      slot("prep", "Prep", 60)
    ],
    rubricId: "custom",
    description: "Define your own timing, sides, and rubric."
  }
};

export const formatById = (id) => EVENT_FORMATS[id] || EVENT_FORMATS.custom;

/**
 * Resolve the effective format for an event document. An event doc can
 * override the format's timing (event.timing.slots), sides (event.sides),
 * and rubric (event.rubricId). Returns { format, slots, sides, rubricId }.
 */
export function effectiveFormat(event) {
  const base = formatById(event?.formatId || event?.format || "custom");
  const slots = Array.isArray(event?.timing?.slots) && event.timing.slots.length
    ? event.timing.slots
    : base.slots;
  const sides = Array.isArray(event?.sides) && event.sides.length ? event.sides : base.sides;
  return {
    format: base,
    slots,
    sides,
    rubricId: event?.rubricId || base.rubricId || "custom"
  };
}

/** Ordered, labeled speech slots only (for the speech order panel). */
export function speechSlots(slots) {
  return (slots || []).filter((s) => s.kind === "speech");
}
