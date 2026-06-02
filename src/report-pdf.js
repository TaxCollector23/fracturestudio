import PDFDocument from "pdfkit";

const COLORS = {
  ink: "#172033",
  muted: "#5B6475",
  line: "#D8DEE8",
  accent: "#4358D6",
  danger: "#B42318",
  soft: "#F4F6FA"
};

export function createReportPdf(input = {}) {
  const audit = input.audit && typeof input.audit === "object" ? input.audit : {};
  const sources = input.sources && typeof input.sources === "object" ? input.sources : null;
  const draft = typeof input.draft === "string" ? input.draft.trim() : "";
  const citationStyle = String(input.citationStyle || sources?.citation_style || "mla").toLowerCase() === "apa" ? "apa" : "mla";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 52, bottom: 56, left: 54, right: 54 },
      bufferPages: true,
      info: {
        Title: "Fracture Studio Argument Report",
        Author: "Fracture Studio",
        Subject: "Argument analysis and source verification report"
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const addHeading = (title, level = 1) => {
      if (doc.y > 690) doc.addPage();
      doc.moveDown(level === 1 ? 0.8 : 0.45);
      doc.font("Helvetica-Bold")
        .fontSize(level === 1 ? 17 : 12)
        .fillColor(level === 1 ? COLORS.ink : COLORS.accent)
        .text(title, { width: pageWidth });
      doc.moveDown(level === 1 ? 0.35 : 0.2);
    };
    const addParagraph = (text, options = {}) => {
      const value = clean(text);
      if (!value) return;
      if (doc.y > 718) doc.addPage();
      doc.font(options.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(options.size || 10.5)
        .fillColor(options.color || COLORS.ink)
        .text(value, { width: pageWidth, lineGap: 2.8 });
      doc.moveDown(options.gap ?? 0.42);
    };
    const addLabel = (label, value) => {
      const text = clean(value);
      if (!text) return;
      if (doc.y > 718) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.accent).text(`${label}: `, { continued: true });
      doc.font("Helvetica").fillColor(COLORS.ink).text(text, { width: pageWidth, lineGap: 2.4 });
      doc.moveDown(0.28);
    };
    const addRule = () => {
      if (doc.y > 730) doc.addPage();
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor(COLORS.line)
        .lineWidth(0.7)
        .stroke();
      doc.moveDown(0.55);
    };

    doc.rect(0, 0, doc.page.width, 112).fill(COLORS.ink);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(23).text("FRACTURE STUDIO", 54, 43);
    doc.fillColor("#B8C3FF").font("Helvetica").fontSize(10).text("ARGUMENT PRESSURE-TEST REPORT", 54, 74);
    doc.y = 137;
    addParagraph(`Generated ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`, { color: COLORS.muted, size: 9 });

    const score = Number.isFinite(audit.overall_score) ? audit.overall_score : null;
    if (score !== null) {
      doc.roundedRect(54, doc.y + 4, 108, 56, 6).fill(COLORS.soft);
      doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(25).text(String(score), 67, doc.y + 17, { width: 42 });
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9).text("OVERALL SCORE", 109, doc.y + 24, { width: 48 });
      doc.y += 70;
    }

    addHeading("Verdict");
    addParagraph(audit.verdict || "No verdict was available.");
    addLabel("First revision move", audit.coaching_note);

    const scores = audit.score_breakdown || {};
    const scoreExplanations = audit.score_explanations || {};
    addHeading("Score Breakdown");
    [
      ["Argument strength", scores.argument_strength, scoreExplanations.argument_strength],
      ["Assumption safety", scores.assumption_audit, scoreExplanations.assumption_audit],
      ["Logic", scores.logic, scoreExplanations.logic],
      ["Rhetoric", scores.rhetoric, scoreExplanations.rhetoric]
    ].forEach(([label, value, explanation]) => {
      addLabel(label, value === undefined ? "Not scored" : `${value}/25`);
      addParagraph(explanation, { color: COLORS.muted, size: 9.6 });
    });

    const fixes = array(audit.priority_fixes);
    addHeading("Priority Fixes");
    if (!fixes.length) addParagraph("No priority fixes were returned.");
    fixes.forEach((fix, index) => {
      addHeading(`${index + 1}. ${clean(fix.problem) || "Revision priority"}`, 2);
      addLabel("Impact if skipped", fix.fatality);
      addLabel("Risk score", fix.fatality_score === undefined ? "" : `${fix.fatality_score}/100`);
      addLabel("Quoted passage", fix.quote);
      addLabel("Why this repair is necessary", fix.necessity);
      addLabel("Claims affected", list(fix.affected_claims));
      addLabel("Why it matters", fix.why_it_matters);
      addLabel("Exact repair", fix.exact_fix);
      addLabel("Suggested wording", fix.rewrite);
      addRule();
    });

    const collapse = audit.collapse_point || {};
    addHeading("Collapse Point");
    addLabel("Load-bearing passage", collapse.quote);
    addLabel("Why the argument depends on it", collapse.why_it_collapses);
    addLabel("Dependent claims", collapse.dependency_count);
    addLabel("Affected claims", list(collapse.affected_claims));
    addLabel("Survival probability", collapse.survival_probability === undefined ? "" : `${collapse.survival_probability}%`);
    addLabel("Strongest opponent attack", collapse.strongest_attack || collapse.opponent_attack);
    addLabel("Strongest defense", collapse.strongest_defense || collapse.reinforcement);

    const thesis = audit.argument_strength?.thesis || {};
    addHeading("Argument Structure");
    addLabel("Thesis", thesis.quote);
    addLabel("Assessment", thesis.assessment);
    array(audit.argument_strength?.claims).forEach((claim, index) => {
      addHeading(`Claim ${index + 1}`, 2);
      addLabel("Passage", claim.quote);
      addLabel("Rating", claim.rating);
      addLabel("Diagnosis", claim.diagnosis);
      addLabel("Opponent exploit", claim.opponent_exploit);
      addLabel("Repair", claim.fix);
    });

    addCollection("Hidden Assumptions", array(audit.assumption_audit), (item) => [
      ["Assumption", item.assumption],
      ["Load bearing", item.load_bearing],
      ["Criticality score", item.criticality_score === undefined ? "" : `${item.criticality_score}/100`],
      ["Affected passage", item.quote],
      ["What hinges on it", list(item.hinges_on)],
      ["If this changes", item.if_changed],
      ["How to justify it", item.justification],
      ["Vulnerability", item.vulnerability],
      ["Defense", item.defense]
    ]);
    addCollection("Logical Fallacies", array(audit.logical_fallacies), (item) => [
      ["Fallacy", item.name],
      ["Passage", item.quote],
      ["Why it matters", item.explanation],
      ["Repair", item.fix]
    ]);
    addCollection("Counterarguments", array(audit.counter_arguments), (item) => [
      ["Rank", item.rank],
      ["Attack type", item.attack_type],
      ["Risk score", item.fatality_score === undefined ? "" : `${item.fatality_score}/100`],
      ["Steelman", item.steelman],
      ["Target", item.targets],
      ["Damage", item.damage],
      ["Suggested rebuttal", item.suggested_rebuttal],
      ["How to prepare", item.preparation]
    ]);

    const dependencyGraph = audit.argument_dependency_graph || {};
    addHeading("How the Argument Hangs Together");
    addParagraph(dependencyGraph.explanation || "This view shows how one part of the argument supports another.");
    array(dependencyGraph.links).forEach((link, index) => {
      addHeading(`Connection ${index + 1}`, 2);
      addParagraph(`${clean(link.from) || "Supporting point"} ${clean(link.relationship) || "supports"} ${clean(link.to) || "dependent point"}.`);
      addLabel("Connection strength", link.strength);
      addLabel("If this link breaks", link.risk);
    });

    addCollection("Attack Tree", array(audit.attack_tree), (item) => [
      ["Rank", item.rank],
      ["Risk score", item.fatality_score === undefined ? "" : `${item.fatality_score}/100`],
      ["Attack", item.attack],
      ["Target", item.targets],
      ["Why it is dangerous", item.why_dangerous],
      ["Best response", item.response],
      ["Crossfire question", item.crossfire_question]
    ]);

    addCollection("Truth Audit", array(audit.truth_audit), (item) => [
      ["Claim to check", item.claim],
      ["Public-web check", item.truth_status],
      ["Why check it", item.why_check],
      ["Verification step", item.verification_step]
    ]);

    addCollection("Alternative Solutions Test", array(audit.alternative_solutions_test), (item) => [
      ["Competing option", item.alternative],
      ["Why a reader may prefer it", item.why_it_competes],
      ["What the draft must prove", item.what_writer_must_prove],
      ["How to answer fairly", item.response]
    ]);

    const rhetoric = audit.rhetorical_analysis || {};
    addHeading("Rhetorical Analysis");
    addLabel("Opening", rhetoric.opening_hook);
    addLabel("Logical flow", rhetoric.logical_flow);
    addLabel("Persuasion", rhetoric.persuasion_assessment);
    addLabel("Clarity", rhetoric.clarity_assessment);
    addLabel("Flow repairs", list(rhetoric.flow_repairs));
    if (rhetoric.world_changing_views?.present === "YES") {
      addLabel("World-changing view", rhetoric.world_changing_views.idea);
      addLabel("Reader resistance", rhetoric.world_changing_views.reader_risk);
      addLabel("Make it easier to consider", rhetoric.world_changing_views.make_reasonable);
    }

    addCollection("Make It Stronger: Rewrite Suggestions", array(audit.rewrite_suggestions), (item) => [
      ["Original", item.original],
      ["Rewrite", item.rewrite],
      ["Why this is stronger", item.improvement]
    ]);

    if (draft) {
      addHeading("Submitted Draft");
      addParagraph(draft);
    }

    if (sources) {
      const summary = sources.summary || {};
      addHeading("Source Verification");
      addParagraph(summary.note || "The verifier searched public pages and compared retrieved text to factual claims.");
      addLabel("Citation standard", summary.style_edition || (citationStyle === "apa" ? "APA 7th edition" : "MLA 9th edition"));
      addLabel("Claims checked", summary.total_claims);
      addLabel("Strong public-web matches", summary.likely_supported);
      addLabel("Claims needing review", (Number(summary.needs_source_review) || 0) + (Number(summary.partial_match) || 0) + (Number(summary.source_not_found) || 0) + (Number(summary.citation_incomplete) || 0));
      array(sources.claims).forEach((claim, index) => {
        addHeading(`Source check ${index + 1}`, 2);
        addLabel("Claim", claim.claim);
        addLabel("Status", String(claim.support_status || "needs review").replace(/_/g, " "));
        addLabel("Verifier note", claim.verification_note);
      });

      const bibliography = array(sources.works_cited);
      addHeading(sources.bibliography_title || (citationStyle === "apa" ? "References" : "Works Cited"));
      if (!bibliography.length) {
        addParagraph("No source cleared the verifier's strong-match threshold. Review the flagged claims before adding a bibliography entry.");
      } else {
        bibliography.forEach((entry, index) => addParagraph(`${index + 1}. ${entry.entry || entry.citation || entry.mla || entry.apa || entry.url}`));
      }
    }

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted)
        .text("Fracture Studio  |  Reasoning first. Sources checked separately.", 54, doc.page.height - 34, { width: pageWidth - 70 });
      doc.text(`${index + 1} / ${range.count}`, doc.page.width - 98, doc.page.height - 34, { width: 44, align: "right" });
    }

    doc.end();

    function addCollection(title, items, fieldsFor) {
      addHeading(title);
      if (!items.length) {
        addParagraph(`No ${title.toLowerCase()} were returned.`);
        return;
      }
      items.forEach((item, index) => {
        addHeading(`${title.replace(/s$/, "")} ${index + 1}`, 2);
        fieldsFor(item).forEach(([label, value]) => addLabel(label, value));
      });
    }
  });
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function list(value) {
  return array(value).map(clean).filter(Boolean).join("; ");
}
