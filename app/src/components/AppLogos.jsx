// AppLogos.jsx — realistic SVG logo marks for the app's main destinations.
//
// Each mark is a rounded app-icon tile with its own gradient and a detailed
// white glyph, so navigation reads like a real product directory instead of a
// list of generic line icons. One registry below; new destinations are one
// gradient + one glyph entry.

const GLYPHS = {
  // Speedometer: arc, needle, tick.
  dashboard: (
    <>
      <path d="M13 29a11 11 0 1 1 22 0" />
      <path d="M24 28 L24 16" strokeWidth="3.2" />
      <path d="M24 28 L30.5 30.5" strokeWidth="2.2" />
      <circle cx="24" cy="29" r="2.3" fill="#fff" stroke="none" />
    </>
  ),

  // Fountain pen nib with an ink line beneath.
  studio: (
    <>
      <path d="M15.5 12.5 H32.5 L24 37 Z" fill="#fff" stroke="none" />
      <path d="M24 17 V26" strokeWidth="1.6" />
      <path d="M16.5 40 H31.5" strokeWidth="2.2" />
    </>
  ),

  // Document with a magnifier over the corner.
  research: (
    <>
      <path d="M15 11 h11 l6 6 v18 a2 2 0 0 1 -2 2 H17 a2 2 0 0 1 -2 -2 V13 a2 2 0 0 1 2 -2 Z" />
      <path d="M20.5 19 h9 M20.5 23.5 h9" strokeWidth="2" opacity="0.7" />
      <circle cx="31" cy="31" r="7" />
      <path d="M36 36 L41.5 41.5" strokeWidth="3" />
    </>
  ),

  // Shield with a check.
  prepare: (
    <>
      <path d="M24 9 L33.5 13 V23 C33.5 31 29.5 36 24 39 C18.5 36 14.5 31 14.5 23 V13 Z" />
      <path d="M19.5 24.5 L23 28 L28.5 21.5" strokeWidth="2.6" />
    </>
  ),

  // Stopwatch: lugs, crown, face, hands.
  practice: (
    <>
      <circle cx="24" cy="27" r="10.5" />
      <rect x="20.5" y="9.5" width="3" height="4.5" rx="1" fill="#fff" stroke="none" />
      <rect x="24.5" y="9.5" width="3" height="4.5" rx="1" fill="#fff" stroke="none" />
      <path d="M24 18 V14.5" strokeWidth="2.6" />
      <path d="M24 27 L29 23" strokeWidth="2.6" />
    </>
  ),

  // Trophy: cup, handles, stem, base.
  compete: (
    <>
      <path d="M16.5 11 H31.5 V20 A7.5 7.5 0 0 1 16.5 20 Z" />
      <path d="M16.5 13.5 H14 A3 3 0 0 0 14 19.5 H16.5" />
      <path d="M31.5 13.5 H34 A3 3 0 0 1 34 19.5 H31.5" />
      <path d="M24 27.5 V33" />
      <path d="M19.5 32.5 H28.5" strokeWidth="2.2" />
      <path d="M16.5 37.5 H31.5" strokeWidth="2.6" />
    </>
  ),

  // Whistle: body, hole, mouthpiece, finger ring.
  coach: (
    <>
      <circle cx="19.5" cy="28" r="8" />
      <circle cx="19.5" cy="28" r="2.8" strokeWidth="1.8" opacity="0.75" />
      <circle cx="16" cy="22" r="1.7" strokeWidth="1.8" opacity="0.8" />
      <rect x="25" y="24.5" width="10.5" height="7" rx="3" fill="#fff" stroke="none" />
    </>
  ),

  // Crossed swords with crossguards and pommels.
  rebuttals: (
    <>
      <path d="M16 15 L32 31" strokeWidth="3.6" />
      <path d="M32 15 L16 31" strokeWidth="3.6" />
      <path d="M28.5 35 L35.5 28" strokeWidth="2.4" />
      <path d="M12.5 20 L19.5 13" strokeWidth="2.4" />
      <circle cx="13.5" cy="15" r="1.9" fill="#fff" stroke="none" />
      <circle cx="34.5" cy="33" r="1.9" fill="#fff" stroke="none" />
    </>
  ),

  // Folder with a summary page inside.
  past: (
    <>
      <path d="M13 16 h7.5 l3 3 H35 a2 2 0 0 1 2 2 v12 a2 2 0 0 1 -2 2 H15 a2 2 0 0 1 -2 -2 Z" />
      <path d="M18.5 24 h11 M18.5 28 h8" strokeWidth="2" opacity="0.7" />
    </>
  ),

  // Open book with a spine.
  methods: (
    <>
      <path d="M12 14 H21 V33 H15 Q12 33 12 30 Z" />
      <path d="M36 14 H27 V33 H33 Q36 33 36 30 Z" />
      <path d="M24 14 V33" strokeWidth="1.8" opacity="0.8" />
    </>
  ),

  // Newspaper: sheet with headline lines.
  blog: (
    <>
      <rect x="14" y="12" width="20" height="26" rx="2" />
      <path d="M18 18 h12 M18 22.5 h12 M18 27 h8 M18 31 h10" strokeWidth="2" opacity="0.75" />
    </>
  ),

  // Gear.
  settings: (
    <>
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        transform="translate(0 0) scale(2)"
        strokeWidth="2.4"
      />
      <circle cx="24" cy="24" r="3" transform="translate(0 0) scale(2)" strokeWidth="2.2" />
    </>
  ),

  // Inbox tray with a down arrow.
  inbox: (
    <>
      <path d="M14 14 h20 a2 2 0 0 1 2 2 v18 a2 2 0 0 1 -2 2 H14 a2 2 0 0 1 -2 -2 V16 a2 2 0 0 1 2 -2 Z" />
      <path d="M14 32 h20" strokeWidth="2.2" />
      <path d="M24 22 v8" strokeWidth="2.6" />
      <path d="M20 26.5 L24 30.5 L28 26.5" strokeWidth="2.6" />
    </>
  ),

  // Stacked cards with text lines.
  cards: (
    <>
      <path d="M17.5 11 H36 A1.5 1.5 0 0 1 37.5 12.5 V28" opacity="0.65" />
      <rect x="12" y="16" width="21" height="21" rx="2.5" />
      <path d="M16 22 h13 M16 26.5 h10" strokeWidth="2" opacity="0.75" />
    </>
  ),

  // Clock face.
  timer: (
    <>
      <circle cx="24" cy="24" r="11" />
      <path d="M24 17 V24 L29 27" strokeWidth="2.6" />
      <circle cx="24" cy="24" r="1.9" fill="#fff" stroke="none" />
    </>
  ),

  // Compass rose.
  strategy: (
    <>
      <circle cx="24" cy="24" r="11.5" />
      <path d="M24 13.5 L27.2 24 L24 34.5 L20.8 24 Z" fill="#fff" stroke="none" />
      <circle cx="24" cy="24" r="1.7" fill="#fff" stroke="none" />
    </>
  )
};

// name → gradient stops (light→dark corner) for the tile.
export const LOGO_GRADIENTS = {
  dashboard: ["#6366f1", "#8b5cf6"], // indigo → violet
  studio: ["#f59e0b", "#ef4444"], // amber → red
  research: ["#0ea5e9", "#2563eb"], // sky → blue
  prepare: ["#10b981", "#047857"], // emerald
  practice: ["#f97316", "#f43f5e"], // orange → rose
  compete: ["#eab308", "#ea580c"], // yellow → orange
  coach: ["#14b8a6", "#0f766e"], // teal
  rebuttals: ["#ef4444", "#991b1b"], // red
  past: ["#8b5cf6", "#6d28d9"], // violet → purple
  methods: ["#64748b", "#475569"], // slate
  blog: ["#0ea5e9", "#0369a1"], // sky
  settings: ["#71717a", "#3f3f46"], // zinc
  inbox: ["#22c55e", "#15803d"], // green
  cards: ["#a855f7", "#7e22ce"], // fuchsia → purple
  timer: ["#38bdf8", "#0284c7"], // light sky
  strategy: ["#f472b6", "#db2777"], // pink
};

export const LOGO_NAMES = Object.keys(GLYPHS);

/**
 * Render a destination logo. `uid` keeps SVG gradient ids unique when the
 * same mark appears more than once on one page.
 */
export default function AppLogo({ name, size = 40, uid, className }) {
  const glyph = GLYPHS[name];
  if (!glyph) return null;
  const gradient = LOGO_GRADIENTS[name] || ["#71717a", "#3f3f46"];
  const id = `fs-logo-${name}-${uid || ""}`;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gradient[0]} />
          <stop offset="1" stopColor={gradient[1]} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect width="48" height="48" rx="12" />
        </clipPath>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${id})`} />
      {/* Soft top highlight + bottom shade for a dimensional app-icon look. */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="48" height="19" fill="#fff" opacity="0.12" />
        <rect y="38" width="48" height="10" fill="#000" opacity="0.10" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.96">
        {glyph}
      </g>
    </svg>
  );
}
