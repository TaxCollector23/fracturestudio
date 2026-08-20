import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const POSTS = [
  {
    title: "The collapse point: the one sentence your case lives or dies on",
    tag: "Method",
    read: "5 min",
    preview: "Every argument has a single load-bearing claim. Find it, defend it, and the rest holds. Ignore it, and the whole structure falls on one well-aimed question.",
    body: [
      "Every argument — no matter how long, how sourced, or how well organized — rests on a single sentence that everything else depends on. We call it the collapse point: the claim that, if wrong or unprovable, takes the entire case down with it. It is almost never the thesis statement. It is usually buried two or three steps into the reasoning, stated as if it were obvious, and left without a warrant. A persuasive essay arguing that social media causes teen depression might spend three paragraphs building on the premise that correlation between usage and mental health outcomes implies causation. That premise is the collapse point. Pull it out, and every statistic, every citation, every vivid example lands in a pile of disconnected facts.",
      "Finding your own collapse point is uncomfortable because it forces you to look at your weakest assumption instead of your strongest evidence. The best method is to read your argument backwards: start at the conclusion and ask what must be true for this conclusion to hold, then ask what must be true for that, and keep going until you reach a claim you have not defended. That claim is the collapse point. In competitive debate, skilled opponents locate this moment faster than you think — usually within thirty seconds of reading your case — and spend their entire cross-examination attacking it. In academic writing, a careful professor circles the paragraph and writes 'but why?' in the margin. In both cases, the rest of your work becomes irrelevant until you answer that question.",
      "Fracture isolates the collapse point automatically, quoting the exact sentence and naming the logical mechanism that makes it load-bearing. But knowing the collapse point is only half the fix. The other half is defending it: either with explicit evidence that closes the gap, a qualifier that narrows the claim to what you can actually prove, or an acknowledgment of the assumption followed by a reason the audience should accept it anyway. The writers who improve fastest are not the ones who write the most — they are the ones who learn to read their own work the way a skeptic would, hunting for the sentence that, if challenged, would unravel everything."
    ]
  },
  {
    title: "Why 'studies show' is the weakest phrase in your draft",
    tag: "Evidence",
    read: "4 min",
    preview: "Vague source language signals to a reader that you haven't checked. Here's what to replace it with — and why specificity is not just a style choice but a logical one.",
    body: [
      "The phrase 'studies show' is doing two jobs badly at once. First, it is supposed to introduce evidence, but it tells the reader nothing about what study, who ran it, how many participants, when, or under what conditions. Second, it is supposed to build credibility, but it achieves the opposite — any reader who has spent time with academic sources immediately recognizes it as a signal that the writer either could not find a specific source or did not look. It is the written equivalent of saying 'someone, somewhere, once said something relevant.' It invites the reader to be skeptical of everything that follows, even if the underlying evidence is real and strong.",
      "The alternative is not to cite in perfect academic format — it is to be specific in plain language. 'A 2022 study' is already better. 'A 2022 study published in the Journal of Pediatrics' is better still. 'A 2022 study of 1,400 adolescents published in the Journal of Pediatrics, which found a 34% increase in anxiety scores after 90 minutes of daily social media use' gives the reader enough detail to evaluate the claim on its own terms. Notice that this does not require footnotes or MLA formatting — it requires the writer to know what they are actually citing. The discipline of writing specific evidence forces you to go find the real source, which then forces you to understand whether the source actually proves what you think it proves. This is the part most writers skip.",
      "The deeper problem with vague evidence is not stylistic — it is logical. Evidence only supports a claim if it is specific enough to make the claim testable. 'Studies show social media harms teens' combined with 'we should limit teen screen time' looks like an argument, but it is not one. It is two assertions connected by assumption. The evidence never specifies what harm, to which teens, in what dose, reversible or not. Without that specificity, there is no way to evaluate whether the proposed solution addresses the actual mechanism of harm. Fracture flags vague source language not because it looks bad, but because it usually means the logical bridge between evidence and claim has not been built yet — and that bridge is where arguments are actually won or lost."
    ]
  },
  {
    title: "Warrants: the reasoning step everyone skips",
    tag: "Logic",
    read: "6 min",
    preview: "A claim and a piece of evidence are not an argument until you explain why one proves the other. That explanation is the warrant — and most writers never write it.",
    body: [
      "The Toulmin model of argument has three core components: the claim (what you are arguing), the evidence (what you are using to support it), and the warrant (the reasoning that explains why the evidence proves the claim). Most writers produce the first two and assume the third is obvious. It almost never is. Consider a common argument structure: 'Teen mental health has declined over the past decade [evidence]. Therefore, we should restrict smartphone use in schools [claim].' Both statements might be true. But the warrant — the reasoning that connects declining mental health to school smartphone bans as a solution — is entirely missing. The evidence does not speak for itself. The reader is left to construct the logical bridge on their own, and different readers will build very different bridges.",
      "Warrants come in several forms, and knowing which type you need changes how you write the sentence. Causal warrants explain a mechanism: 'because smartphones during school hours interrupt working memory consolidation, restricting them would remove a direct physiological barrier to learning.' Comparative warrants establish that your solution outperforms alternatives: 'unlike counseling programs that require years of implementation, phone-free policies produce measurable attention improvements within weeks.' Value warrants appeal to shared principles: 'if we accept that schools are responsible for the conditions of learning, then they are also responsible for removing known impediments to it.' Each warrant type answers a different version of the question 'why does the evidence prove the claim?' — and the best arguments choose the warrant type that closes the gap the evidence actually leaves open.",
      "The practical test for a missing warrant is simple: read your evidence sentence, then read your claim sentence, then ask whether a reasonable skeptic who accepts the evidence would still be able to reject the claim. If yes, you are missing a warrant. The skeptic does not have to think your evidence is wrong — they just need a path to say 'sure, but that doesn't mean your solution follows.' Filling that path is the warrant's job. Fracture identifies claim-evidence pairs and flags the ones where the warrant is implicit or entirely absent, then names the specific logical gap — scope mismatch, missing causal link, assumed value, or burden the evidence does not meet. The fix is almost always one sentence, written directly between the evidence and the claim, that explains the mechanism. That sentence is frequently the most important one in the entire paragraph."
    ]
  },
  {
    title: "Scoring honestly: how a 100 is actually possible",
    tag: "Scoring",
    read: "3 min",
    preview: "Most feedback tools cluster every score in the 70s to avoid hard conversations. Fracture commits to the score the work earns — including a perfect one.",
    body: [
      "The default behavior of most AI feedback tools is to score everything between 72 and 84. This is not an accident — it is a calibration choice driven by the fear of two extremes. If a tool gives a 95, students feel they are done and stop revising. If a tool gives a 40, students feel attacked and lose trust in the feedback. So the tool settles in the middle, where scores feel actionable and non-threatening. The problem is that this range is a lie for most of the work it sees. A first-draft argument with no thesis, vague evidence, and no warrant structure does not score 74 — it scores 45. A fully-developed essay with a clear arguable thesis, specific sourced evidence, explicit warrants, and a genuine counterargument does not score 81 — it scores 93. Collapsing both into the 70s destroys the information value of the score.",
      "Fracture's scoring is anchored to what the work actually does, not to a comfortable range. The rubric is public: a score below 60 means the argument does not hold under basic scrutiny. A score in the 60s means there is a thesis but significant structural gaps. A score in the 70s means the work is solid but has at least one gap a skilled reader would exploit. A score in the 80s means the work is strong with only minor remaining improvements. A score in the 90s means the work would survive serious critical pressure. A 100 means the argument is complete — every load-bearing claim is defended, every piece of evidence has an explicit warrant, the counterargument is engaged and answered, and nothing of substance is left for a skeptical reader to attack. It is not a score for perfection; it is a score for thoroughness.",
      "The practical effect of honest scoring is that feedback becomes useful in both directions. When a score is low, the gap between the score and 70 gives the student a concrete target. When a score is high, reaching for the last few points requires identifying the specific remaining weaknesses, which is exactly the kind of high-leverage revision that most feedback tools never reach. And when a piece earns 100, that matters too — not because it is beyond improvement, but because the writer deserves to know when their argument is structurally sound before they spend more time polishing sentences that are already doing their job."
    ]
  }
];

export default function Blog() {
  const [active, setActive] = useState(null);

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-12">
      <div className="label-mono mb-2">Writing</div>
      <h1 className="font-serif text-4xl md:text-6xl mb-10">The Fracture Journal</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {POSTS.map((p, i) => (
          <motion.button key={p.title} onClick={() => setActive(p)}
            initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="card card-hover p-7 text-left flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <span className="pill">{p.tag}</span>
              <span className="faint text-xs font-mono">{p.read}</span>
            </div>
            <h2 className="font-serif text-2xl mb-2 leading-snug">{p.title}</h2>
            <p className="muted text-sm leading-relaxed">{p.preview}</p>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-start justify-center p-4 md:p-8 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <motion.div
              className="card w-full max-w-2xl my-auto"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 p-7 pb-5 border-b border-[var(--color-border)]">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="pill">{active.tag}</span>
                    <span className="faint text-xs font-mono">{active.read}</span>
                  </div>
                  <h2 className="font-serif text-2xl leading-tight">{active.title}</h2>
                </div>
                <button onClick={() => setActive(null)} className="shrink-0 faint hover:text-[var(--color-text)] transition-colors mt-1">
                  <X size={20} />
                </button>
              </div>
              <div className="p-7 space-y-5">
                {active.body.map((para, i) => (
                  <p key={i} className="muted leading-relaxed text-[0.95rem]">{para}</p>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
