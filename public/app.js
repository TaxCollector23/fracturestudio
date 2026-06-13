/* app.js — Fracture Studio v6.0 — Full Engine Rewrite */
(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const essayInput     = document.getElementById('essayInput');
  const charCount      = document.getElementById('charCount');
  const analyzeBtn     = document.getElementById('analyzeBtn');
  const clearBtn       = document.getElementById('clearBtn');
  const saveBtn        = document.getElementById('saveBtn');
  const loadBtn        = document.getElementById('loadBtn');
  const rebuttalsBtn   = document.getElementById('rebuttalsBtn');
  const analysisFormat = document.getElementById('analysisFormat');
  const depthLevel     = document.getElementById('depthLevel');
  const statusDot      = document.getElementById('statusDot');
  const statusLabel    = document.getElementById('statusLabel');
  const statusDetail   = document.getElementById('statusDetail');
  const progressNote   = document.getElementById('progressNote');
  const progressPill   = document.getElementById('progressPill');
  const progressBar    = document.getElementById('progressBar');
  const progressTrack  = document.getElementById('progressTrack');
  const auditProgressLabel = document.getElementById('auditProgressLabel');
  const finalReviewPlaceholder = document.getElementById('finalReviewPlaceholder');
  const jsonError      = document.getElementById('jsonError');
  const scorePill      = document.getElementById('scorePill');
  const scoreSummary   = document.getElementById('scoreSummary');
  const exportBtn      = document.getElementById('exportBtn');
  const copyReportBtn  = document.getElementById('copyReportBtn');
  const downloadTextBtn = document.getElementById('downloadTextBtn');
  const reportNav      = document.getElementById('reportNav');
  const reportContainer = document.getElementById('reportContainer');
  const argumentGraph  = document.getElementById('argumentGraph');
  const argumentMapPlaceholder = document.getElementById('argumentMapPlaceholder');
  const outputPanel    = document.getElementById('outputPanel');
  const chatInput      = document.getElementById('chatInput');
  const chatBtn        = document.getElementById('chatBtn');
  const chatStatus     = document.getElementById('chatStatus');
  const chatProgress   = document.getElementById('chatProgress');
  const chatOutput     = document.getElementById('chatOutput');
  const chatClearBtn   = document.getElementById('chatClearBtn');
  const chatSelectedPoint = document.getElementById('chatSelectedPoint');
  const fractureChatCard = document.getElementById('fractureChatCard');

  if (!essayInput) return;

  // ── State ─────────────────────────────────────────────────────────────────
  let rawJsonText    = '';
  let parsedAudit    = null;
  let auditedDraft   = '';
  let auditRendered  = false;
  let isStreaming    = false;
  let progress       = 0;
  let progressTimer  = null;
  let pacingIndex    = 0;
  let selectedChatPoint = '';
  let chatHistory    = [];
  let readableReportText = '';
  let finalAuditStreamSections = [];
  let serverReadableStreaming = false;

  const PACING_PHRASES = [
    'Preparing the audit', 'Checking your claims', 'Finding the thesis',
    'Mapping evidence to claims', 'Testing warrant strength', 'Looking for hidden assumptions',
    'Checking causation links', 'Finding the collapse point', 'Building counterarguments',
    'Stress-testing the logic', 'Finding missing arguments', 'Scoring rhetorical control',
    'Writing your Fracture report'
  ];

  // ── Auth gate ─────────────────────────────────────────────────────────────
  function requireAuth(callback) {
    const isAuthed = window.FractureAuth &&
      typeof window.FractureAuth.getCurrentUser === 'function' &&
      window.FractureAuth.getCurrentUser();
    const isGuest = window.FractureAuth &&
      typeof window.FractureAuth.hasGuestAccess === 'function' &&
      window.FractureAuth.hasGuestAccess();
    if (isAuthed || isGuest) {
      callback();
    } else {
      if (window.FractureAuth && typeof window.FractureAuth.showModal === 'function') {
        window.FractureAuth.showModal();
        window._pendingAnalysis = callback;
      } else {
        callback();
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function asArray(v) { return Array.isArray(v) ? v : []; }

  function firstText() {
    for (let i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] === 'string' && arguments[i].trim()) return arguments[i].trim();
    }
    return '';
  }

  function updateCharCount() {
    if (charCount) charCount.textContent = (essayInput.value.length).toLocaleString() + ' chars';
  }

  function setStatus(mode, detail) {
    if (!statusDot) return;
    statusDot.classList.remove('live', 'error');
    if (mode === 'live') { statusDot.classList.add('live'); statusLabel.textContent = 'Streaming'; }
    else if (mode === 'error') { statusDot.classList.add('error'); statusLabel.textContent = 'Error'; }
    else if (mode === 'done') { statusLabel.textContent = 'Complete'; }
    else { statusLabel.textContent = 'Idle'; }
    if (statusDetail && detail) statusDetail.textContent = detail;
  }

  function setProgress(value, message) {
    progress = Math.max(0, Math.min(100, value));
    if (progressPill) progressPill.textContent = Math.floor(progress) + '%';
    if (auditProgressLabel) auditProgressLabel.textContent = Math.floor(progress) + '%';
    if (progressBar) progressBar.style.width = progress + '%';
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(Math.floor(progress)));
    if (progressNote && message) progressNote.textContent = message;
  }

  function startProgress() {
    pacingIndex = 0;
    setProgress(3, PACING_PHRASES[0]);
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(function () {
      if (!isStreaming) return;
      pacingIndex = (pacingIndex + 1) % PACING_PHRASES.length;
      if (progress < 82) setProgress(progress + 1.2, PACING_PHRASES[pacingIndex]);
      else if (progressNote) progressNote.textContent = PACING_PHRASES[pacingIndex];
    }, 1400);
  }

  function stopProgress(success, message) {
    if (progressTimer) clearInterval(progressTimer);
    setProgress(success ? 100 : progress, message || (success ? 'Report ready' : 'Audit paused'));
  }

  function setBtns(disabled) {
    [analyzeBtn, clearBtn, saveBtn, loadBtn, rebuttalsBtn].forEach(function (b) {
      if (b) b.disabled = disabled;
    });
  }

  function resetOutput() {
    rawJsonText = '';
    parsedAudit = null;
    auditedDraft = '';
    auditRendered = false;
    finalAuditStreamSections = [];
    serverReadableStreaming = false;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = false;
    if (jsonError) { jsonError.classList.add('hidden'); jsonError.textContent = ''; }
    if (scorePill) scorePill.textContent = '—';
    if (scoreSummary) scoreSummary.hidden = true;
    if (reportNav) reportNav.hidden = true;
    if (reportContainer) { reportContainer.innerHTML = ''; reportContainer.classList.remove('visible', 'streaming', 'final-streaming'); }
    resetArgumentGraph();
    setProgress(0, 'Ready when you are');
  }

  function resetArgumentGraph() {
    if (!argumentGraph) return;
    argumentGraph.innerHTML = '';
    argumentGraph.hidden = true;
    if (argumentMapPlaceholder) argumentMapPlaceholder.hidden = false;
  }

  // ── Streaming UI ──────────────────────────────────────────────────────────
  function startFinalAuditStream() {
    serverReadableStreaming = true;
    finalAuditStreamSections = [];
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;
    renderStreamingState();
  }

  function appendFinalAuditDelta(section) {
    if (!section || !section.body) return;
    finalAuditStreamSections.push(section);
    renderStreamingState();
  }

  function finishFinalAuditStream() {
    serverReadableStreaming = false;
    if (reportContainer) reportContainer.classList.remove('streaming');
  }

  function renderStreamingState() {
    if (!reportContainer || auditRendered) return;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;
    const sHtml = finalAuditStreamSections.map(function (sec) {
      return '<section class="final-audit-stream-section"><div class="final-audit-stream-kicker">' + esc(sec.title || 'Section') + '</div><p>' + esc(sec.body || '').replace(/\n/g, '<br>') + '</p></section>';
    }).join('');
    reportContainer.innerHTML = '<article class="final-audit-stream"><div class="final-audit-stream-status"><span class="streaming-report-pulse"></span><span>Writing your Fracture report…</span></div>' + (sHtml || '<p class="streaming-report-writing">Analyzing your argument<span class="streaming-report-caret"></span></p>') + '</article>';
    reportContainer.classList.add('visible', 'streaming', 'final-streaming');
  }

  // ── Score label ───────────────────────────────────────────────────────────
  function scoreLabel(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return 'Not scored yet';
    if (score >= 90) return 'Competition-ready';
    if (score >= 75) return 'Strong with fixable gaps';
    if (score >= 60) return 'Usable but vulnerable';
    if (score >= 40) return 'Major revision needed';
    if (score >= 11) return 'Collapses under pressure';
    return 'Not enough to evaluate';
  }

  // ── Source link renderer ──────────────────────────────────────────────────
  function renderSourceLinks(sources, label) {
    const items = asArray(sources).filter(function (s) { return s && (s.url || s.search_terms); });
    if (!items.length) return '';
    const links = items.slice(0, 5).map(function (s) {
      const url = s.url || ('https://scholar.google.com/scholar?q=' + encodeURIComponent(s.search_terms || ''));
      const desc = esc(firstText(s.description, s.search_terms, 'Find source'));
      return '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="source-link">' + desc + '</a>';
    }).join('');
    return '<div class="source-links"><span class="source-links-label">' + esc(label || 'Find sources:') + '</span>' + links + '</div>';
  }

  function quoteBlock(text) {
    if (!text) return '';
    return '<blockquote class="report-quote">' + esc(text) + '</blockquote>';
  }

  function renderInlineList(label, values) {
    const items = asArray(values).filter(Boolean);
    if (!items.length) return '';
    return '<p><strong>' + esc(label) + ':</strong> ' + items.map(function (v) { return esc(String(v)); }).join(' · ') + '</p>';
  }

  function ratingClass(rating) {
    const n = (rating || '').toLowerCase();
    if (n === 'strong') return 'strong';
    if (n === 'moderate') return 'moderate';
    return 'weak';
  }

  function truncText(text, max) {
    const t = firstText(text).replace(/\s+/g, ' ');
    return t.length > max ? t.slice(0, max - 3).trim() + '…' : t;
  }

  function scoreChip(label, value, desc) {
    const maxVal = label === 'Source Quality' ? 10 : 25;
    return '<div class="score-chip"><strong>' + esc(label) + '</strong><span>' + esc(String(value ?? '—')) + '/' + maxVal + '</span><small>' + esc(desc || '') + '</small></div>';
  }

  // ── Argument Map ──────────────────────────────────────────────────────────
  function renderArgumentGraph(parsed) {
    if (!argumentGraph) return;
    const thesis = parsed.thesis_check || {};
    const claims = asArray(parsed.claims).slice(0, 4);
    const collapse = parsed.collapse_point || {};
    const score = parsed.overall_score;

    const claimRows = claims.map(function (claim, index) {
      const rating = ratingClass(claim.rating);
      const evidenceText = firstText(claim.evidence_needed, claim.fix, 'Add evidence to support this claim.');
      const problem = firstText(claim.diagnosis, 'This claim needs clearer support.');
      const sources = asArray(claim.sources_to_find);
      const srcLinks = sources.slice(0, 2).map(function (s) {
        const url = s.url || ('https://scholar.google.com/scholar?q=' + encodeURIComponent(s.search_terms || claim.quote || ''));
        return '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="map-source-link">Find source →</a>';
      }).join(' ');

      return '<div class="graph-row"><div class="graph-node claim-node ' + rating + '" role="button" tabindex="0" data-chat-point="' + encodeURIComponent(firstText(claim.quote).slice(0, 1200)) + '" title="Select for Fracture Chat"><div class="node-kicker">Claim ' + (index + 1) + '</div><div class="node-text">' + esc(truncText(claim.quote, 150)) + '</div><span class="node-badge ' + rating + '">' + esc((claim.rating || 'WEAK').toUpperCase()) + '</span></div><div class="graph-connector"><span></span></div><div class="graph-node evidence-node"><div class="node-kicker">Evidence Needed</div><div class="node-text">' + esc(truncText(evidenceText, 160)) + '</div>' + (srcLinks ? '<div class="node-sources">' + srcLinks + '</div>' : '') + '</div><div class="graph-note ' + rating + '"><div class="note-title">' + (rating === 'strong' ? 'Watch point' : 'Needs attention') + '</div><p>' + esc(truncText(problem, 160)) + '</p></div></div>';
    }).join('');

    argumentGraph.innerHTML = '<div class="argument-map-head"><div><div class="panel-title">Argument Flow Map</div><div class="panel-sub">Visual structure from your Fracture report.</div></div><span class="graph-status">' + (score != null ? 'Score ' + score + '/100' : 'Mapped') + '</span></div><div class="graph-canvas"><div class="graph-thesis-wrap"><div class="graph-node thesis-node"><div class="node-kicker">Thesis</div><div class="node-text">' + esc(truncText(firstText(thesis.quote, parsed.verdict, 'No thesis found.'), 190)) + '</div></div>' + (collapse.quote ? '<div class="collapse-card" role="button" tabindex="0" data-chat-point="' + encodeURIComponent(firstText(collapse.quote).slice(0, 1200)) + '" title="Select collapse point for Fracture Chat"><div class="note-title">Collapse Point</div><p>' + esc(truncText(collapse.quote, 150)) + '</p><small>' + esc(truncText(collapse.why_it_collapses || 'If this is unsupported, the argument loses force.', 160)) + '</small></div>' : '') + '</div><div class="graph-spine"><span></span><span></span><span></span></div><div class="graph-rows">' + (claimRows || '<div class="argument-map-empty"><p>No claims identified. Add a thesis and at least one reason, then run Fracture.</p></div>') + '</div></div>';
    argumentGraph.hidden = false;
    if (argumentMapPlaceholder) argumentMapPlaceholder.hidden = true;
  }

  // ── Main Report Renderer ──────────────────────────────────────────────────
  function renderReport(parsed) {
    if (!parsed || typeof parsed !== 'object') return;
    const c = reportContainer;
    if (outputPanel) outputPanel.hidden = false;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;
    if (reportNav) reportNav.hidden = false;
    c.classList.remove('streaming', 'final-streaming');
    c.innerHTML = '';

    function section(title, innerHTML, open, id) {
      return '<details class="report-section"' + (id ? ' id="' + esc(id) + '"' : '') + (open !== false ? ' open' : '') + '><summary>' + title + '</summary><div class="content">' + innerHTML + '</div></details>';
    }

    const scores = parsed.score_breakdown || {};
    const scoreDescs = scores.score_descriptions || {};

    // ── Verdict ──
    const verdictHtml = '<div class="verdict-card"><div><span class="report-label">Overall Score</span><strong>' + esc(parsed.overall_score != null ? parsed.overall_score + '/100' : 'Not scored') + '</strong><small>' + esc(scoreLabel(parsed.overall_score)) + '</small></div><p>' + esc(parsed.verdict || 'Analysis complete.') + '</p></div>';

    // ── Scores ──
    const scoreHtml = '<div class="score-grid">' + scoreChip('Argument Strength', scores.argument_strength, scoreDescs.argument_strength) + scoreChip('Assumption Safety', scores.assumption_audit, scoreDescs.assumption_audit) + scoreChip('Logic', scores.logic, scoreDescs.logic) + scoreChip('Rhetoric', scores.rhetoric, scoreDescs.rhetoric) + scoreChip('Source Quality', scores.source_quality, scoreDescs.source_quality) + '</div>';

    // ── Thesis ──
    const thesis = parsed.thesis_check || {};
    const thesisHtml = '<div class="report-item">' + (thesis.quote ? quoteBlock(thesis.quote) : '<p><em>No clear thesis identified.</em></p>') + '<p>' + esc(thesis.assessment || '') + '</p>' + (thesis.burden_of_proof ? '<p><strong>Burden of proof:</strong> ' + esc(thesis.burden_of_proof) + '</p>' : '') + (thesis.improvement ? '<p><strong>Improved thesis:</strong></p>' + quoteBlock(thesis.improvement) : '') + '</div>';

    // ── Claims ──
    const claimsHtml = asArray(parsed.claims).map(function (cl, i) {
      const rc = ratingClass(cl.rating);
      return '<div class="report-item"><div class="report-metric-row"><span class="report-metric report-metric-' + rc + '">Claim ' + (i+1) + ': ' + esc((cl.rating || 'WEAK').toUpperCase()) + '</span></div>' + quoteBlock(cl.quote) + '<p><strong>Diagnosis:</strong> ' + esc(cl.diagnosis || '') + '</p>' + (cl.missing_warrant ? '<p><strong>Missing warrant:</strong> ' + esc(cl.missing_warrant) + '</p>' : '') + (cl.opponent_exploit ? '<p><strong>How opponent attacks this:</strong> ' + esc(cl.opponent_exploit) + '</p>' : '') + (cl.fix ? '<p><strong>Exact fix:</strong> ' + esc(cl.fix) + '</p>' : '') + renderSourceLinks(cl.sources_to_find, 'Find supporting evidence:') + '</div>';
    }).join('') || '<p>No claims parsed.</p>';

    // ── Attackable Gaps ──
    const gapsHtml = asArray(parsed.attackable_gaps).map(function (g, i) {
      return '<div class="report-item"><p><strong>Gap ' + (i+1) + ':</strong> ' + esc(g.gap || '') + '</p>' + (g.quote ? quoteBlock(g.quote) : '') + '<p><strong>Why vulnerable:</strong> ' + esc(g.why_vulnerable || '') + '</p>' + (g.how_to_close ? '<p><strong>How to close it:</strong> ' + esc(g.how_to_close) + '</p>' : '') + renderSourceLinks(g.evidence_to_add, 'Evidence to close this gap:') + '</div>';
    }).join('') || '<p>No critical gaps identified.</p>';

    // ── Rebuttal Prep ──
    const reb = parsed.rebuttal_prep || {};
    const sr = reb.strongest_rebuttal || {};
    const er = reb.easiest_rebuttal || {};
    const snr = reb.sneakiest_rebuttal || {};
    const rebuttalHtml = '<div class="report-item"><div class="report-metric-row"><span class="report-metric report-metric-risk">Strongest Attack</span></div><p><strong>Attack:</strong> ' + esc(sr.attack || '') + '</p><p><strong>Targets:</strong> ' + esc(sr.targets || '') + '</p><p><strong>How to answer:</strong> ' + esc(sr.how_to_answer || '') + '</p>' + renderSourceLinks(sr.evidence_to_block_it, 'Evidence to block this attack:') + '</div><div class="report-item"><div class="report-metric-row"><span class="report-metric">Easiest Attack</span></div><p><strong>Attack:</strong> ' + esc(er.attack || '') + '</p><p><strong>Why easy:</strong> ' + esc(er.why_easy || '') + '</p><p><strong>How to answer:</strong> ' + esc(er.how_to_answer || '') + '</p></div><div class="report-item"><div class="report-metric-row"><span class="report-metric">Sneakiest Attack</span></div><p><strong>Attack:</strong> ' + esc(snr.attack || '') + '</p><p><strong>Why sneaky:</strong> ' + esc(snr.why_sneaky || '') + '</p><p><strong>How to answer:</strong> ' + esc(snr.how_to_answer || '') + '</p></div>';

    // ── Extra Arguments ──
    const extraHtml = asArray(parsed.extra_arguments).map(function (e, i) {
      return '<div class="report-item extra-argument-item"><div class="extra-arg-badge">Missing Argument ' + (i+1) + '</div><p><strong>' + esc(e.argument || '') + '</strong></p><p><strong>Why this matters:</strong> ' + esc(e.why_important || '') + '</p>' + (e.how_to_add ? '<p><strong>How to add it:</strong> ' + esc(e.how_to_add) + '</p>' : '') + renderSourceLinks(e.sources, 'Sources for this argument:') + '</div>';
    }).join('') || '<p>No missing arguments identified.</p>';

    // ── Logical Fallacies ──
    const fallaciesHtml = asArray(parsed.logical_fallacies).map(function (f) {
      return '<div class="report-item"><p><strong>' + esc(f.name || 'Fallacy') + '</strong></p>' + quoteBlock(f.quote) + '<p>' + esc(f.explanation || '') + '</p>' + (f.fix ? '<p><strong>Fix:</strong> ' + esc(f.fix) + '</p>' : '') + '</div>';
    }).join('') || '<p>No explicit fallacies flagged.</p>';

    // ── Impact Weighing ──
    const impact = parsed.impact_weighing || {};
    const impactHtml = '<div class="report-item"><p><strong>Does this argument weigh impacts?</strong> <span class="report-metric report-metric-' + (impact.does_argument_weigh ? 'strong' : 'risk') + '">' + (impact.does_argument_weigh ? 'YES' : 'NO — Critical gap') + '</span></p>' + (impact.why_weighing_matters ? '<p><strong>Why weighing matters here:</strong> ' + esc(impact.why_weighing_matters) + '</p>' : '') + (impact.magnitude ? '<p><strong>Magnitude:</strong> ' + esc(impact.magnitude) + '</p>' : '') + (impact.probability ? '<p><strong>Probability:</strong> ' + esc(impact.probability) + '</p>' : '') + (impact.timeframe ? '<p><strong>Timeframe:</strong> ' + esc(impact.timeframe) + '</p>' : '') + (impact.how_to_outweigh ? '<p><strong>Language to add for impact comparison:</strong></p>' + quoteBlock(impact.how_to_outweigh) : '') + '</div>';

    // ── Assumptions ──
    const assumptionsHtml = asArray(parsed.assumption_audit).map(function (a) {
      return '<div class="report-item"><p><span class="report-metric report-metric-risk">' + esc(firstText(a.type, 'HIDDEN').replace(/_/g, ' ')) + '</span></p><p><strong>Assumption:</strong> ' + esc(a.assumption || '') + '</p>' + (a.quote ? quoteBlock(a.quote) : '') + (a.if_assumption_fails ? '<p><strong>If this fails:</strong> ' + esc(a.if_assumption_fails) + '</p>' : '') + (a.how_to_defend ? '<p><strong>Defense sentence to add:</strong></p>' + quoteBlock(a.how_to_defend) : '') + renderSourceLinks(a.sources, 'Sources to defend this assumption:') + '</div>';
    }).join('') || '<p>No hidden assumptions identified.</p>';

    // ── Collapse Point ──
    const cp = parsed.collapse_point || {};
    const collapseHtml = cp.quote ? '<div class="report-item">' + quoteBlock(cp.quote) + '<p><strong>Why it collapses:</strong> ' + esc(cp.why_it_collapses || '') + '</p>' + (cp.survival_probability != null ? '<p><strong>Survival probability under pressure:</strong> ' + esc(String(cp.survival_probability)) + '%</p>' : '') + renderInlineList('Dependent claims', cp.dependent_claims) + (cp.strongest_attack ? '<p><strong>Strongest opponent attack:</strong> ' + esc(cp.strongest_attack) + '</p>' : '') + (cp.strongest_defense ? '<p><strong>Exact sentence to add:</strong></p>' + quoteBlock(cp.strongest_defense) : '') + '</div>' : '<p>No single collapse point identified.</p>';

    // ── Rhetorical Analysis ──
    const rhet = parsed.rhetorical_analysis || {};
    const rhetHtml = '<p><strong>Opening Hook:</strong> <span class="report-metric report-metric-' + ratingClass(rhet.hook_strength) + '">' + esc(firstText(rhet.hook_strength, '—')) + '</span> ' + esc(rhet.opening_hook || '') + '</p><p><strong>Logical flow:</strong> ' + esc(rhet.logical_flow || '') + '</p><p><strong>Persuasion:</strong> ' + esc(rhet.persuasion_assessment || '') + '</p><p><strong>Strongest sentence:</strong></p>' + quoteBlock((rhet.strongest_sentence || {}).quote) + '<p>' + esc((rhet.strongest_sentence || {}).why || '') + '</p><p><strong>Weakest sentence:</strong></p>' + quoteBlock((rhet.weakest_sentence || {}).quote) + '<p>' + esc((rhet.weakest_sentence || {}).why || '') + '</p>' + ((rhet.weakest_sentence || {}).fix ? '<p><strong>Fix:</strong> ' + esc(rhet.weakest_sentence.fix) + '</p>' : '');

    // ── Priority Fixes ──
    const fixes = asArray(parsed.priority_fixes);
    const fixesHtml = fixes.map(function (fix, i) {
      return '<div class="report-item priority-fix-item"><div class="report-metric-row"><span class="report-metric report-metric-risk">Fix ' + (i+1) + '</span>' + (fix.score_impact ? '<span class="report-metric report-metric-strong">' + esc(fix.score_impact) + '</span>' : '') + '</div><p><strong>' + esc(fix.problem || 'Repair needed') + '</strong></p>' + (fix.quote ? quoteBlock(fix.quote) : '') + (fix.why_it_matters ? '<p><strong>Why it matters:</strong> ' + esc(fix.why_it_matters) + '</p>' : '') + (fix.exact_fix ? '<p><strong>Exact fix:</strong> ' + esc(fix.exact_fix) + '</p>' : '') + (fix.rewrite ? '<p><strong>Rewritten version:</strong></p>' + quoteBlock(fix.rewrite) : '') + '</div>';
    }).join('') || '<p>No priority fixes generated.</p>';

    // ── Extreme-depth sections ──
    let extremeHtml = '';
    if (parsed.definitional_audit && asArray(parsed.definitional_audit).length) {
      const defHtml = asArray(parsed.definitional_audit).map(function (d) {
        return '<div class="report-item"><p><strong>Term:</strong> ' + esc(d.term || '') + ' — ' + (d.defined_in_text ? '<span class="report-metric report-metric-strong">Defined</span>' : '<span class="report-metric report-metric-risk">Undefined</span>') + '</p>' + (d.how_opponent_contests ? '<p><strong>How opponent contests this:</strong> ' + esc(d.how_opponent_contests) + '</p>' : '') + (d.recommended_definition ? '<p><strong>Add this definition:</strong></p>' + quoteBlock(d.recommended_definition) : '') + '</div>';
      }).join('');
      extremeHtml += section('Definitional Audit', defHtml, false);
    }

    if (parsed.citation_integrity && asArray(parsed.citation_integrity).length) {
      const citHtml = asArray(parsed.citation_integrity).map(function (ci) {
        const ratingMap = { STRONG: 'strong', USABLE: 'moderate', WEAK: 'weak', FABRICATION_RISK: 'risk' };
        const rc = ratingMap[(ci.rating || '').toUpperCase()] || 'weak';
        return '<div class="report-item"><div class="report-metric-row"><span class="report-metric report-metric-' + rc + '">' + esc(ci.rating || 'UNRATED') + '</span></div>' + quoteBlock(ci.claim) + (ci.problem ? '<p><strong>Problem:</strong> ' + esc(ci.problem) + '</p>' : '') + (ci.fix ? '<p><strong>Fix:</strong> ' + esc(ci.fix) + '</p>' : '') + '</div>';
      }).join('');
      extremeHtml += section('Citation Integrity', citHtml, false);
    }

    if (parsed.opponent_stress_test && asArray(parsed.opponent_stress_test).length) {
      const stressHtml = asArray(parsed.opponent_stress_test).map(function (o, i) {
        const handleMap = { HANDLES: 'strong', PARTIALLY_HANDLES: 'moderate', DOES_NOT_HANDLE: 'risk' };
        const rc = handleMap[o.current_handling] || 'weak';
        return '<div class="report-item"><p><strong>Objection ' + (i+1) + ':</strong> ' + esc(o.objection || '') + '</p><p><span class="report-metric report-metric-' + rc + '">' + esc((o.current_handling || '').replace(/_/g, ' ')) + '</span></p>' + (o.language_to_add ? '<p><strong>Language to add:</strong></p>' + quoteBlock(o.language_to_add) : '') + '</div>';
      }).join('');
      extremeHtml += section('Opponent Stress Test', stressHtml, false);
    }

    // ── Dependency Graph ──
    let depGraphHtml = '';
    if (parsed.argument_dependency_graph) {
      const graph = parsed.argument_dependency_graph || {};
      const linksHtml = asArray(graph.links).map(function (link) {
        return '<div class="report-item dependency-item"><div class="dependency-route"><span>' + esc(firstText(link.from, 'Point')) + '</span><b>' + esc(firstText(link.relationship, 'supports')) + '</b><span>' + esc(firstText(link.to, 'Claim')) + '</span></div><p><strong>Strength:</strong> ' + esc(firstText(link.strength, 'WEAK')) + '</p>' + (link.risk ? '<p><strong>If broken:</strong> ' + esc(link.risk) + '</p>' : '') + '</div>';
      }).join('');
      depGraphHtml = section('Argument Dependency Map', '<p>' + esc(graph.explanation || 'How parts of this argument support each other.') + '</p>' + (linksHtml || '<p>No dependency links identified.</p>'), false);
    }

    readableReportText = buildReadableReportText(parsed);

    c.innerHTML =
      section('Verdict & Score', verdictHtml, true, 'report-verdict') +
      section('Score Breakdown', scoreHtml, true) +
      section('Priority Fixes', fixesHtml, true, 'report-priorities') +
      section('Claims Analysis', claimsHtml, true, 'report-claims') +
      section('Attackable Gaps', gapsHtml, true) +
      section('Rebuttal Preparation', rebuttalHtml, true, 'report-rebuttal') +
      section('Missing Arguments', extraHtml, true, 'report-extra') +
      section('Logical Fallacies', fallaciesHtml, true) +
      section('Impact Weighing', impactHtml, true) +
      section('Thesis Analysis', thesisHtml, true) +
      section('Assumption Audit', assumptionsHtml, false) +
      section('Collapse Point', collapseHtml, false) +
      section('Rhetorical Analysis', rhetHtml, false) +
      depGraphHtml +
      extremeHtml;

    renderArgumentGraph(parsed);
    requestAnimationFrame(function () { c.classList.add('visible'); });
  }

  function buildReadableReportText(parsed) {
    const lines = ['Fracture Studio Report', ''];
    const s = parsed || {};
    const scores = s.score_breakdown || {};
    lines.push('VERDICT: ' + (s.overall_score != null ? s.overall_score + '/100' : 'Not scored'));
    lines.push(s.verdict || '');
    lines.push('');
    lines.push('SCORES');
    lines.push('Argument Strength: ' + (scores.argument_strength ?? '—') + '/25');
    lines.push('Assumption Safety: ' + (scores.assumption_audit ?? '—') + '/25');
    lines.push('Logic: ' + (scores.logic ?? '—') + '/25');
    lines.push('Rhetoric: ' + (scores.rhetoric ?? '—') + '/25');
    lines.push('Source Quality: ' + (scores.source_quality ?? '—') + '/10');
    lines.push('');
    const thesis = s.thesis_check || {};
    if (thesis.quote) lines.push('THESIS: ' + thesis.quote);
    if (thesis.assessment) lines.push(thesis.assessment);
    lines.push('');
    lines.push('PRIORITY FIXES');
    asArray(s.priority_fixes).forEach(function (fix, i) {
      lines.push((i+1) + '. ' + firstText(fix.problem, 'Fix needed'));
      if (fix.exact_fix) lines.push('   Fix: ' + fix.exact_fix);
      lines.push('');
    });
    lines.push('MISSING ARGUMENTS');
    asArray(s.extra_arguments).forEach(function (e, i) {
      lines.push((i+1) + '. ' + firstText(e.argument));
      if (e.how_to_add) lines.push('   How to add: ' + e.how_to_add);
      lines.push('');
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ── Core analysis ─────────────────────────────────────────────────────────
  function runAnalysis() {
    const essay = essayInput.value.trim();
    if (!essay) { setStatus('error', 'Paste an argument before using Fracture.'); return; }

    requireAuth(function () {
      _doRunAnalysis(essay);
    });
  }

  async function _doRunAnalysis(essay) {
    resetOutput();
    auditedDraft = essay;
    isStreaming = true;
    setBtns(true);
    setStatus('live', 'Fracturing your argument…');
    startProgress();

    const preferences = {
      analysisFormat: analysisFormat ? analysisFormat.value : 'argument',
      depthLevel: depthLevel ? depthLevel.value : 'medium'
    };

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, preferences })
      });

      if (!response.ok) {
        const err = await response.json().catch(function () { return { error: response.statusText }; });
        throw new Error(err.error || response.statusText);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      rawJsonText = '';
      parsedAudit = null;
      auditRendered = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            if (json.fracture_progress) { setProgress(json.fracture_progress.progress, json.fracture_progress.message); continue; }
            if (json.fracture_report_start) { startFinalAuditStream(); continue; }
            if (json.fracture_report_delta) { appendFinalAuditDelta(json.fracture_report_delta); continue; }
            if (json.fracture_report_done) { finishFinalAuditStream(); continue; }
            if (json.fracture_audit) {
              const audit = json.fracture_audit;
              parsedAudit = audit;
              if (typeof audit.overall_score === 'number' && scorePill) {
                scorePill.textContent = String(audit.overall_score);
                if (scoreSummary) scoreSummary.hidden = false;
              }
              if (!auditRendered) { renderReport(audit); auditRendered = true; }
              continue;
            }
            if (json.fracture_normalized_json) { rawJsonText = json.fracture_normalized_json; continue; }
            if (json.fracture_model_delta) { rawJsonText += json.fracture_model_delta; continue; }
          } catch (_) {}
        }
      }

      isStreaming = false;
      setBtns(false);
      stopProgress(true, 'Report ready');
      setStatus('done', 'Fracture report complete.');
      saveCurrentWork(false);

    } catch (err) {
      isStreaming = false;
      setBtns(false);
      stopProgress(false, 'Request needs attention');
      setStatus('error', 'Request failed. Your writing is still in the editor.');
      if (jsonError) { jsonError.classList.remove('hidden'); jsonError.textContent = 'Error: ' + (err && err.message ? err.message : String(err)); }
    }
  }

  // ── Save/Load ─────────────────────────────────────────────────────────────
  async function saveCurrentWork(manual) {
    const essay = essayInput.value.trim();
    if (!essay) return null;
    if (!window.FractureAuth || typeof window.FractureAuth.saveProject !== 'function') {
      if (manual && statusDetail) statusDetail.textContent = 'Sign in to save your work.';
      return null;
    }
    try {
      const payload = { audit: parsedAudit, saved_at: new Date().toISOString() };
      const saved = await window.FractureAuth.saveProject(essay, payload);
      if (manual && statusDetail) statusDetail.textContent = saved && saved.mode === 'cloud' ? 'Saved to your account.' : 'Saved in this browser. Sign in to keep cloud history.';
      return saved;
    } catch (_) {
      if (manual && statusDetail) statusDetail.textContent = 'Could not save.';
      return null;
    }
  }

  function clearAll() {
    if (isStreaming) return;
    essayInput.value = '';
    updateCharCount();
    resetOutput();
    setStatus('idle', 'Waiting for an argument.');
  }

  function copyReadableReport() {
    const text = readableReportText || (parsedAudit ? buildReadableReportText(parsedAudit) : '');
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { if (statusDetail) statusDetail.textContent = 'Report copied.'; });
    }
  }

  function downloadReadableReport() {
    const text = readableReportText || (parsedAudit ? buildReadableReportText(parsedAudit) : '');
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fracture-report.txt';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  function selectChatPoint(point) {
    selectedChatPoint = firstText(point);
    if (!selectedChatPoint || !chatSelectedPoint) return;
    chatSelectedPoint.textContent = 'Selected: ' + selectedChatPoint.slice(0, 80) + '…';
    chatSelectedPoint.classList.remove('hidden');
    if (chatInput && !chatInput.value.trim()) {
      chatInput.value = 'How should I strengthen this exact point? Give me a practical rewrite.';
      if (chatBtn) chatBtn.disabled = false;
    }
    if (fractureChatCard) fractureChatCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function runChat() {
    if (!chatInput || !chatInput.value.trim()) return;
    const message = chatInput.value.trim();
    chatInput.value = '';
    if (chatBtn) chatBtn.disabled = true;

    appendChatMessage('user', message);
    chatHistory.push({ role: 'user', content: message });
    const responseEl = appendChatMessage('assistant', '');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, draft: essayInput.value.trim(),
          report: parsedAudit, selectedPoint: selectedChatPoint,
          history: chatHistory.slice(-6, -1)
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '', fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            if (event.fracture_text_delta) { fullText += event.fracture_text_delta; responseEl.textContent = fullText; if (chatOutput) chatOutput.scrollTop = chatOutput.scrollHeight; }
          } catch (_) {}
        }
      }
      chatHistory.push({ role: 'assistant', content: fullText });
    } catch (err) {
      responseEl.textContent = 'Chat error: ' + (err.message || String(err));
    }
    if (chatBtn) chatBtn.disabled = false;
  }

  function appendChatMessage(role, content) {
    if (!chatOutput) return { textContent: '' };
    const msg = document.createElement('div');
    msg.className = 'chat-message chat-message-' + role;
    const lbl = document.createElement('span');
    lbl.className = 'chat-message-label';
    lbl.textContent = role === 'user' ? 'You' : 'Fracture Chat';
    const body = document.createElement('span');
    body.textContent = content || '';
    msg.appendChild(lbl); msg.appendChild(body);
    chatOutput.appendChild(msg);
    chatOutput.scrollTop = chatOutput.scrollHeight;
    return body;
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  essayInput.addEventListener('input', updateCharCount);
  analyzeBtn.addEventListener('click', runAnalysis);
  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  if (saveBtn) saveBtn.addEventListener('click', function () { saveCurrentWork(true); });
  if (loadBtn) loadBtn.addEventListener('click', function () { window.location.href = 'past-work.html'; });
  if (copyReportBtn) copyReportBtn.addEventListener('click', copyReadableReport);
  if (downloadTextBtn) downloadTextBtn.addEventListener('click', downloadReadableReport);
  if (chatInput) chatInput.addEventListener('input', function () { if (chatBtn) chatBtn.disabled = !chatInput.value.trim(); });
  if (chatBtn) chatBtn.addEventListener('click', runChat);
  if (chatClearBtn) chatClearBtn.addEventListener('click', function () { chatHistory = []; if (chatOutput) chatOutput.textContent = ''; });
  chatInput && chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runChat(); } });

  if (argumentGraph) {
    argumentGraph.addEventListener('click', function (e) {
      const target = e.target.closest('[data-chat-point]');
      if (target) selectChatPoint(decodeURIComponent(target.getAttribute('data-chat-point') || ''));
    });
  }

  window.addEventListener('beforeunload', function (e) {
    if (!isStreaming) return;
    e.preventDefault(); e.returnValue = '';
  });

  // Handle auth completion triggering pending analysis
  window.addEventListener('fracture_auth_complete', function () {
    if (window._pendingAnalysis) {
      const fn = window._pendingAnalysis;
      window._pendingAnalysis = null;
      fn();
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  updateCharCount();
  setStatus('idle', 'Waiting for an argument.');
  setProgress(0, 'Ready when you are');
})();
