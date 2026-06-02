/* app.js — Fracture Studio core analysis logic */
(function () {
  'use strict';

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const essayInput      = document.getElementById('essayInput');
  const charCount       = document.getElementById('charCount');
  const analyzeBtn      = document.getElementById('analyzeBtn');
  const clearBtn        = document.getElementById('clearBtn');
  const saveBtn         = document.getElementById('saveBtn');
  const loadBtn         = document.getElementById('loadBtn');
  const rebuttalsBtn    = document.getElementById('rebuttalsBtn');
  const refreshStudioHistory = document.getElementById('refreshStudioHistory');
  const studioHistoryList = document.getElementById('studioHistoryList');
  const statusDot       = document.getElementById('statusDot');
  const statusLabel     = document.getElementById('statusLabel');
  const statusDetail    = document.getElementById('statusDetail');
  const progressNote    = document.getElementById('progressNote');
  const progressPill    = document.getElementById('progressPill');
  const progressBar     = document.getElementById('progressBar');
  const progressTrack   = document.getElementById('progressTrack');
  const auditProgressLabel = document.getElementById('auditProgressLabel');
  const finalReviewPlaceholder = document.getElementById('finalReviewPlaceholder');
  const jsonError       = document.getElementById('jsonError');
  const scorePill       = document.getElementById('scorePill');
  const exportBtn       = document.getElementById('exportBtn');
  const shareBtn        = document.getElementById('shareBtn');
  const reportContainer = document.getElementById('reportContainer');
  const argumentGraph   = document.getElementById('argumentGraph');
  const argumentMapPlaceholder = document.getElementById('argumentMapPlaceholder');
  const sourceVerificationArea = document.getElementById('sourceVerificationArea');
  const worksCitedPlaceholder = document.getElementById('worksCitedPlaceholder');
  const outputPanel     = document.getElementById('outputPanel');
  const skeleton        = document.getElementById('skeleton');
  const chatInput       = document.getElementById('chatInput');
  const chatBtn         = document.getElementById('chatBtn');
  const chatStatus      = document.getElementById('chatStatus');
  const chatProgress    = document.getElementById('chatProgress');
  const chatOutput      = document.getElementById('chatOutput');
  const chatClearBtn    = document.getElementById('chatClearBtn');
  const chatSelectedPoint = document.getElementById('chatSelectedPoint');
  const fractureChatCard = document.getElementById('fractureChatCard');

  if (!essayInput) return; // Not on studio page

  // ── State ──────────────────────────────────────────────────────────────────
  let rawJsonText   = '';
  let parsedAudit   = null;
  let auditedDraft  = '';
  let auditRendered = false;
  let isStreaming   = false;
  let progress      = 0;
  let progressTimer = null;
  let pacingIndex   = 0;
  let sourceVerifier = null;
  let sourceVerificationData = null;
  let autoSaveInFlight = false;
  let selectedChatPoint = '';
  let preferredCitationStyle = 'mla';
  let chatHistory = [];

  const PACING_PHRASES = [
    'Preparing the audit',
    'Checking your claims',
    'Finding the thesis',
    'Mapping evidence to claims',
    'Testing warrant strength',
    'Scanning for unsupported facts',
    'Cross-checking source language',
    'Looking for hidden assumptions',
    'Checking causation links',
    'Finding the collapse point',
    'Building counterarguments',
    'Stress-testing the logic',
    'Reviewing academic tone',
    'Scoring argument strength',
    'Scoring evidence quality',
    'Scoring rhetorical control',
    'Prioritizing revision moves',
    'Writing concrete fixes',
    'Validating the report',
    'Preparing your Fracture report'
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────
  function updateCharCount() {
    charCount.textContent = essayInput.value.length.toLocaleString() + ' chars';
  }

  function currentWorkspace(overrides) {
    const active = window.FractureAuth && typeof window.FractureAuth.getActiveWorkspace === 'function'
      ? window.FractureAuth.getActiveWorkspace()
      : null;
    const draft = essayInput.value;
    return Object.assign({}, active || {}, {
      title: workspaceTitle(draft),
      draft: draft,
      analysis: currentAnalysisForDraft(),
      updated: new Date().toISOString()
    }, overrides || {});
  }

  function workspaceTitle(draft) {
    const text = String(draft || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Untitled argument';
    return text.length > 70 ? text.slice(0, 67) + '...' : text;
  }

  function currentAnalysisForDraft() {
    const matchesAudit = parsedAudit && auditedDraft.trim() === essayInput.value.trim();
    return {
      audit: matchesAudit ? parsedAudit : null,
      sources: matchesAudit ? sourceVerificationData : null,
      saved_at: new Date().toISOString()
    };
  }

  function persistActiveWorkspace(overrides) {
    if (!window.FractureAuth || typeof window.FractureAuth.setActiveWorkspace !== 'function') return null;
    return window.FractureAuth.setActiveWorkspace(currentWorkspace(overrides));
  }

  function setStatus(mode, detail) {
    statusDot.classList.remove('live', 'error');
    if (mode === 'live')       { statusDot.classList.add('live');  statusLabel.textContent = 'Streaming'; }
    else if (mode === 'error') { statusDot.classList.add('error'); statusLabel.textContent = 'Error'; }
    else if (mode === 'done')  { statusLabel.textContent = 'Complete'; }
    else                       { statusLabel.textContent = 'Idle'; }
    if (statusDetail) statusDetail.textContent = detail;
  }

  function setProgress(value, message) {
    progress = Math.max(0, Math.min(100, value));
    if (progressPill) progressPill.textContent = Math.floor(progress) + '%';
    if (auditProgressLabel) auditProgressLabel.textContent = Math.floor(progress) + '%';
    if (progressBar)  progressBar.style.width  = progress + '%';
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(Math.floor(progress)));
    if (progressNote && message) progressNote.textContent = message;
    if (isStreaming && !auditRendered) renderStreamingReadableReport();
  }

  function startProgress() {
    pacingIndex = 0;
    setProgress(3, PACING_PHRASES[0]);
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(function () {
      if (!isStreaming) return;
      pacingIndex = (pacingIndex + 1) % PACING_PHRASES.length;
      if (progress < 82) setProgress(progress + 1.5, PACING_PHRASES[pacingIndex]);
      else if (progressNote) progressNote.textContent = PACING_PHRASES[pacingIndex];
    }, 1250);
  }

  function stopProgress(success, message) {
    if (progressTimer) clearInterval(progressTimer);
    setProgress(success ? 100 : progress, message || (success ? 'Report ready' : 'Audit paused'));
  }

  function resetOutput() {
    rawJsonText = '';
    parsedAudit = null;
    auditedDraft = '';
    auditRendered = false;
    resetSourceVerification();
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = false;
    if (jsonError)  { jsonError.classList.add('hidden'); jsonError.textContent = ''; }
    if (scorePill)  scorePill.textContent = '—';
    if (exportBtn)  exportBtn.disabled = true;
    if (shareBtn)   shareBtn.disabled  = true;
    if (reportContainer) { reportContainer.innerHTML = ''; reportContainer.classList.remove('visible', 'streaming'); }
    resetArgumentGraph();
    if (skeleton)   skeleton.classList.add('hidden');
    setProgress(0, 'Ready when you are');
  }

  function setBtns(disabled) {
    [analyzeBtn, clearBtn, saveBtn, loadBtn].forEach(function (b) {
      if (b) b.disabled = disabled;
    });
  }

  function appendReadableAuditDelta(delta) {
    if (!delta || !reportContainer || auditRendered) return;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;
    renderStreamingReadableReport();
  }

  function notifyAuditComplete() {
    try {
      localStorage.setItem('fracture_notice', JSON.stringify({
        id: String(Date.now()),
        title: 'Your Fracture report is ready',
        body: 'Return to Studio to review the readable report, argument map, and revision plan.',
        href: 'studio.html',
        createdAt: Date.now()
      }));
    } catch (_) {}
    if (!document.hidden) return;
    document.title = 'Report ready - Fracture Studio';
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Your Fracture report is ready', {
        body: 'Return to Studio to review the argument map and revision plan.',
        icon: 'favicon.svg'
      });
    }
  }

  // ── Escape HTML ────────────────────────────────────────────────────────────
  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function quoteBlock(text) {
    return '<div class="report-quote">' + esc(text || '') + '</div>';
  }

  function dataPoint(text) {
    return encodeURIComponent(firstText(text).slice(0, 1200));
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function firstText() {
    for (let i = 0; i < arguments.length; i += 1) {
      if (typeof arguments[i] === 'string' && arguments[i].trim()) return arguments[i].trim();
    }
    return '';
  }

  function decodeJsonString(value) {
    try {
      return JSON.parse('"' + value + '"');
    } catch (_) {
      return String(value || '').replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
    }
  }

  function streamedStringValues(text, key) {
    const values = [];
    const pattern = new RegExp('"' + key + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'g');
    let match;
    while ((match = pattern.exec(String(text || '')))) {
      const value = decodeJsonString(match[1]).trim();
      if (value && values.indexOf(value) === -1) values.push(value);
    }
    return values;
  }

  function streamedStringValue(text, key) {
    const completed = streamedStringValues(text, key);
    if (completed.length) return completed[0];

    const source = String(text || '');
    const marker = '"' + key + '"';
    const markerStart = source.indexOf(marker);
    if (markerStart === -1) return '';
    const colon = source.indexOf(':', markerStart + marker.length);
    if (colon === -1) return '';
    const quote = source.indexOf('"', colon + 1);
    if (quote === -1) return '';

    let value = '';
    let escaped = false;
    for (let index = quote + 1; index < source.length; index += 1) {
      const character = source[index];
      if (!escaped && character === '"') break;
      value += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
    }
    return decodeJsonString(value).trim();
  }

  function streamedNumber(text, key) {
    const match = String(text || '').match(new RegExp('"' + key + '"\\s*:\\s*(\\d{1,3})'));
    return match ? match[1] : '';
  }

  function jsonSlice(text, startKey, endKey) {
    const source = String(text || '');
    const start = source.indexOf('"' + startKey + '"');
    if (start === -1) return '';
    const end = endKey ? source.indexOf('"' + endKey + '"', start + startKey.length + 2) : -1;
    return source.slice(start, end === -1 ? source.length : end);
  }

  function streamingReportSection(title, body) {
    if (!body) return '';
    return '<section class="streaming-report-section">'
      + '<div class="streaming-report-kicker">' + esc(title) + '</div>'
      + '<p>' + esc(body) + '</p>'
      + '</section>';
  }

  function renderStreamingReadableReport() {
    if (!reportContainer || auditRendered) return;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;

    const verdict = streamedStringValue(rawJsonText, 'verdict');
    const firstMove = streamedStringValue(rawJsonText, 'coaching_note');
    const prioritySlice = jsonSlice(rawJsonText, 'priority_fixes', 'collapse_point');
    const problems = streamedStringValues(prioritySlice, 'problem').slice(0, 3);
    const whyItMatters = streamedStringValues(prioritySlice, 'why_it_matters').slice(0, 3);
    const exactFixes = streamedStringValues(prioritySlice, 'exact_fix').slice(0, 3);
    const collapseSlice = jsonSlice(rawJsonText, 'collapse_point', 'argument_strength');
    const collapse = streamedStringValue(collapseSlice, 'why_it_collapses');
    const opponentAttack = streamedStringValue(collapseSlice, 'strongest_attack') || streamedStringValue(collapseSlice, 'opponent_attack');
    const score = streamedNumber(rawJsonText, 'overall_score');

    let html = '<article class="streaming-readable-report">'
      + '<div class="streaming-report-status">'
      + '<span class="streaming-report-pulse"></span>'
      + '<span>Fracture is writing your review' + (score ? ' · Score ' + esc(score) + '/100' : '') + '</span>'
      + '</div>';

    html += streamingReportSection('What Fracture is seeing', verdict);
    html += streamingReportSection('Best first move', firstMove);

    problems.forEach(function (problem, index) {
      const details = [
        whyItMatters[index] ? 'Why it matters: ' + whyItMatters[index] : '',
        exactFixes[index] ? 'What to change: ' + exactFixes[index] : ''
      ].filter(Boolean).join(' ');
      html += streamingReportSection('Priority ' + (index + 1), problem + (details ? ' ' + details : ''));
    });

    html += streamingReportSection('Collapse point', collapse);
    html += streamingReportSection('Likely challenge', opponentAttack);

    if (!verdict && !firstMove && !problems.length && !collapse) {
      html += '<p class="streaming-report-writing">' + esc(PACING_PHRASES[pacingIndex] || 'Reading the argument') + '<span class="streaming-report-caret"></span></p>';
    } else {
      html += '<span class="streaming-report-caret" aria-hidden="true"></span>';
    }

    html += '</article>';
    reportContainer.innerHTML = html;
    reportContainer.classList.add('visible', 'streaming');
  }

  function fallbackPriorityFixes(parsed) {
    const claims = (((parsed.argument_strength || {}).claims) || [])
      .filter(function (claim) { return (claim.rating || '').toUpperCase() !== 'STRONG'; })
      .slice(0, 3)
      .map(function (claim) {
        return {
          quote: claim.quote,
          problem: firstText(claim.diagnosis, 'This claim is not protected well enough.'),
          why_it_matters: firstText(claim.opponent_exploit, 'A reader can pressure this claim before accepting the thesis.'),
          exact_fix: firstText(claim.fix, 'Add a direct warrant and evidence source for this exact claim.'),
          rewrite: ''
        };
      });

    if (claims.length) return claims;

    return asArray(parsed.rewrite_suggestions).slice(0, 3).map(function (rewrite) {
      return {
        quote: rewrite.original,
        problem: firstText(rewrite.improvement, 'This sentence can carry more argumentative work.'),
        why_it_matters: 'A cleaner sentence makes the reasoning easier to judge.',
        exact_fix: 'Use the replacement sentence and connect it to the paragraph claim.',
        rewrite: rewrite.rewrite
      };
    });
  }

  function renderPriorityFixes(parsed) {
    const fixes = asArray(parsed.priority_fixes).length ? parsed.priority_fixes : fallbackPriorityFixes(parsed);
    return fixes.map(function (fix, index) {
      return '<div class="report-item">'
           + '<p><span class="report-label">Priority ' + (index + 1) + ':</span> ' + esc(firstText(fix.problem, 'Repair this pressure point.')) + '</p>'
           + '<div class="report-metric-row">'
           + '<span class="report-metric report-metric-risk">Impact if skipped: ' + esc(firstText(fix.fatality, 'MEDIUM')) + '</span>'
           + '<span class="report-metric">Risk score: ' + esc(String(fix.fatality_score ?? '—')) + '/100</span>'
           + '</div>'
           + '<span class="report-label">Exact Text:</span>'
           + quoteBlock(fix.quote)
           + '<p><b>Why this repair is necessary:</b> ' + esc(firstText(fix.necessity, 'This point affects the argument directly.')) + '</p>'
           + renderInlineList('Claims affected', fix.affected_claims)
           + '<p><b>Why it matters:</b> ' + esc(firstText(fix.why_it_matters, 'This is where the argument loses pressure.')) + '</p>'
           + '<p><b>Exact fix:</b> ' + esc(firstText(fix.exact_fix, 'Rewrite this claim with evidence and warrant support.')) + '</p>'
           + (fix.rewrite ? '<span class="report-label">Replacement:</span>' + quoteBlock(fix.rewrite) : '')
           + '</div>';
    }).join('') || '<p>No priority fixes generated.</p>';
  }

  function renderCollapsePoint(parsed) {
    const collapse = parsed.collapse_point || {};
    const fallbackClaim = (((parsed.argument_strength || {}).claims) || [])[0] || {};
    const quote = firstText(collapse.quote, fallbackClaim.quote, ((parsed.argument_strength || {}).thesis || {}).quote);

    return '<div class="report-item">'
         + '<span class="report-label">Load-bearing sentence:</span>'
         + quoteBlock(quote)
         + '<p><b>Why it can collapse:</b> ' + esc(firstText(collapse.why_it_collapses, fallbackClaim.diagnosis, 'If this sentence is not proven, the rest of the argument loses force.')) + '</p>'
         + '<div class="report-metric-row">'
         + '<span class="report-metric">Dependent claims: ' + esc(String(collapse.dependency_count ?? 0)) + '</span>'
         + '<span class="report-metric report-metric-risk">Survival chance: ' + esc(String(collapse.survival_probability ?? '—')) + '%</span>'
         + '</div>'
         + renderInlineList('What depends on it', collapse.affected_claims)
         + '<p><b>Strongest opponent attack:</b> ' + esc(firstText(collapse.strongest_attack, collapse.opponent_attack, fallbackClaim.opponent_exploit, 'A strong opponent will ask what proves this exact point.')) + '</p>'
         + '<p><b>Strongest defense:</b> ' + esc(firstText(collapse.strongest_defense, collapse.reinforcement, fallbackClaim.fix, 'Add direct evidence, a warrant sentence, and a qualifier that survives counterexamples.')) + '</p>'
         + '</div>';
  }

  function renderInlineList(label, values) {
    const items = asArray(values).filter(Boolean);
    if (!items.length) return '';
    return '<p><b>' + esc(label) + ':</b> ' + items.map(function (item) { return esc(String(item)); }).join(' · ') + '</p>';
  }

  function renderDependencyGraph(parsed) {
    const graph = parsed.argument_dependency_graph || {};
    const links = asArray(graph.links);
    const items = links.map(function (link, index) {
      return '<div class="report-item dependency-item">'
        + '<div class="dependency-route"><span>' + esc(firstText(link.from, 'Supporting point')) + '</span><b>' + esc(firstText(link.relationship, 'supports')) + '</b><span>' + esc(firstText(link.to, 'Dependent point')) + '</span></div>'
        + '<p><b>Connection strength:</b> ' + esc(firstText(link.strength, 'WEAK')) + '</p>'
        + '<p><b>If this link breaks:</b> ' + esc(firstText(link.risk, 'The dependent point loses force.')) + '</p>'
        + '</div>';
    }).join('');
    return '<p>' + esc(firstText(graph.explanation, 'This view shows how one part of the argument supports another.')) + '</p>'
      + (items || '<p>No dependency links were identified yet.</p>');
  }

  function renderAttackTree(parsed) {
    return asArray(parsed.attack_tree).map(function (item, index) {
      return '<div class="report-item">'
        + '<div class="report-metric-row"><span class="report-metric report-metric-risk">Attack rank ' + esc(String(item.rank ?? index + 1)) + '</span><span class="report-metric">Risk score: ' + esc(String(item.fatality_score ?? '—')) + '/100</span></div>'
        + '<p><b>Attack:</b> ' + esc(item.attack || '') + '</p>'
        + '<p><b>Target:</b> ' + esc(item.targets || '') + '</p>'
        + '<p><b>Why it is dangerous:</b> ' + esc(item.why_dangerous || '') + '</p>'
        + '<p><b>Best response:</b> ' + esc(item.response || '') + '</p>'
        + '<p><b>Crossfire question:</b> ' + esc(item.crossfire_question || '') + '</p>'
        + '</div>';
    }).join('') || '<p>No additional attack paths were identified.</p>';
  }

  function renderTruthAudit(parsed) {
    return asArray(parsed.truth_audit).map(function (item) {
      return '<div class="report-item">'
        + '<div class="report-metric-row"><span class="report-metric report-metric-risk">Public-web check: ' + esc(firstText(item.truth_status, 'VERIFY')) + '</span></div>'
        + quoteBlock(item.claim)
        + '<p><b>Why check it:</b> ' + esc(item.why_check || '') + '</p>'
        + '<p><b>Verification step:</b> ' + esc(item.verification_step || '') + '</p>'
        + '</div>';
    }).join('') || '<p>No factual claims were sent to the separate source-review pass.</p>';
  }

  function renderAlternatives(parsed) {
    return asArray(parsed.alternative_solutions_test).map(function (item) {
      return '<div class="report-item">'
        + '<p><b>Competing option:</b> ' + esc(item.alternative || '') + '</p>'
        + '<p><b>Why a reader may prefer it:</b> ' + esc(item.why_it_competes || '') + '</p>'
        + '<p><b>What your argument must prove:</b> ' + esc(item.what_writer_must_prove || '') + '</p>'
        + '<p><b>How to answer fairly:</b> ' + esc(item.response || '') + '</p>'
        + '</div>';
    }).join('') || '<p>This draft does not need an alternative-solutions test.</p>';
  }

  function truncateText(text, max) {
    const clean = firstText(text).replace(/\s+/g, ' ');
    if (!clean) return '';
    return clean.length > max ? clean.slice(0, max - 1).trim() + '...' : clean;
  }

  function ratingClass(rating) {
    const normalized = (rating || '').toLowerCase();
    if (normalized === 'strong') return 'strong';
    if (normalized === 'moderate') return 'moderate';
    return 'weak';
  }

  function findFixForClaim(claim, parsed) {
    const fixes = asArray(parsed.priority_fixes);
    const claimQuote = firstText(claim.quote);
    return fixes.find(function (fix) {
      return claimQuote && firstText(fix.quote) && (claimQuote === firstText(fix.quote) || claimQuote.includes(firstText(fix.quote)) || firstText(fix.quote).includes(claimQuote));
    }) || fixes[0] || {};
  }

  function resetArgumentGraph() {
    if (!argumentGraph) return;
    argumentGraph.innerHTML = '';
    argumentGraph.hidden = true;
    if (argumentMapPlaceholder) argumentMapPlaceholder.hidden = false;
  }

  function resetSourceVerification() {
    if (sourceVerifier && typeof sourceVerifier.destroy === 'function') sourceVerifier.destroy();
    sourceVerifier = null;
    sourceVerificationData = null;
    if (sourceVerificationArea) sourceVerificationArea.innerHTML = '';
    if (worksCitedPlaceholder) worksCitedPlaceholder.hidden = false;
  }

  function renderArgumentGraph(parsed) {
    if (!argumentGraph) return;

    const thesis = (parsed.argument_strength || {}).thesis || {};
    const claims = asArray((parsed.argument_strength || {}).claims).slice(0, 4);
    const fixes = asArray(parsed.priority_fixes);
    const collapse = parsed.collapse_point || {};
    const score = typeof parsed.overall_score === 'number' ? parsed.overall_score : null;
    const graphClaims = claims.length ? claims : fixes.slice(0, 3).map(function (fix) {
      return {
        quote: fix.quote,
        rating: 'WEAK',
        diagnosis: fix.problem,
        opponent_exploit: fix.why_it_matters,
        fix: fix.exact_fix
      };
    });

    const claimRows = graphClaims.map(function (claim, index) {
      const fix = findFixForClaim(claim, parsed);
      const rating = ratingClass(claim.rating);
      const evidenceText = firstText(fix.exact_fix, claim.fix, 'Add evidence and a warrant that directly support this claim.');
      const problem = firstText(fix.problem, claim.diagnosis, 'This claim needs clearer support before the reader can rely on it.');
      const readerRisk = firstText(fix.why_it_matters, claim.opponent_exploit, 'A skeptical reader can challenge this point before accepting the thesis.');
      const noteTitle = rating === 'strong' ? 'Watch point' : 'Needs attention';

      return '<div class="graph-row">'
        + '<div class="graph-node claim-node ' + rating + '" role="button" tabindex="0" data-chat-point="' + dataPoint(claim.quote) + '" title="Select this claim for Fracture Chat">'
        + '<div class="node-kicker">Claim ' + (index + 1) + '</div>'
        + '<div class="node-text">' + esc(truncateText(claim.quote, 155)) + '</div>'
        + '<span class="node-badge ' + rating + '">' + esc((claim.rating || 'WEAK').toUpperCase()) + '</span>'
        + '</div>'
        + '<div class="graph-connector"><span></span></div>'
        + '<div class="graph-node evidence-node">'
        + '<div class="node-kicker">Evidence or Warrant Needed</div>'
        + '<div class="node-text">' + esc(truncateText(evidenceText, 170)) + '</div>'
        + '</div>'
        + '<div class="graph-note ' + rating + '">'
        + '<div class="note-title">' + noteTitle + '</div>'
        + '<p>' + esc(truncateText(problem, 170)) + '</p>'
        + '<small>' + esc(truncateText(readerRisk, 155)) + '</small>'
        + '</div>'
        + '</div>';
    }).join('');

    const mapRows = claimRows || '<div class="argument-map-empty"><p>Fracture could not identify body claims yet. Add a thesis plus at least one reason and run the analysis again.</p></div>';

    argumentGraph.innerHTML =
      '<div class="argument-map-head">'
    + '<div>'
    + '<div class="panel-title">Argument Flow Map</div>'
    + '<div class="panel-sub">Visual structure built from the Fracture report.</div>'
    + '</div>'
    + '<span class="graph-status">' + (score === null ? 'Mapped' : 'Score ' + score + '/100') + '</span>'
    + '</div>'
    + '<div class="graph-canvas">'
    + '<div class="graph-thesis-wrap">'
    + '<div class="graph-node thesis-node">'
    + '<div class="node-kicker">Thesis</div>'
    + '<div class="node-text">' + esc(truncateText(firstText(thesis.quote, parsed.verdict, 'No clear thesis found yet.'), 190)) + '</div>'
    + '</div>'
        + '<div class="collapse-card" role="button" tabindex="0" data-chat-point="' + dataPoint(firstText(collapse.quote, thesis.quote)) + '" title="Select this collapse point for Fracture Chat">'
    + '<div class="note-title">Collapse Point</div>'
    + '<p>' + esc(truncateText(firstText(collapse.quote, thesis.quote, 'The most load-bearing claim is not clear yet.'), 150)) + '</p>'
    + '<small>' + esc(truncateText(firstText(collapse.why_it_collapses, 'If this point is unsupported, the whole argument loses force.'), 170)) + '</small>'
    + '</div>'
    + '</div>'
    + '<div class="graph-spine"><span></span><span></span><span></span></div>'
    + '<div class="graph-rows">' + mapRows + '</div>'
    + '</div>';
    argumentGraph.hidden = false;
    if (argumentMapPlaceholder) argumentMapPlaceholder.hidden = true;
  }

  function mountSourceVerification() {
    if (!sourceVerificationArea || !window.FractureSources) return null;
    if (sourceVerifier) return sourceVerifier;
    try {
      if (worksCitedPlaceholder) worksCitedPlaceholder.hidden = true;
      sourceVerifier = window.FractureSources.attach({
        targetSelector: sourceVerificationArea,
        getEssay: function () { return essayInput.value.trim(); },
        getAudit: function () { return parsedAudit; },
        getCitationStyle: function () { return preferredCitationStyle; }
      });
      return sourceVerifier;
    } catch (_) {
      sourceVerifier = null;
      if (worksCitedPlaceholder) worksCitedPlaceholder.hidden = false;
      return null;
    }
  }

  async function runSourceVerification() {
    if (!essayInput.value.trim() || !parsedAudit || !window.FractureSources) return null;
    const verifier = mountSourceVerification();
    if (!verifier || typeof verifier.verify !== 'function') return null;

    try {
      const preferences = await loadFeedbackPreferences();
      preferredCitationStyle = preferences && preferences.citationStyle === 'apa' ? 'apa' : 'mla';
      if (statusDetail) statusDetail.textContent = 'Checking sources and building your bibliography.';
      sourceVerificationData = await verifier.verify();
      persistActiveWorkspace();
      if (statusDetail) statusDetail.textContent = 'Fracture report complete. Source verification added.';
      return sourceVerificationData;
    } catch (_) {
      if (statusDetail) statusDetail.textContent = 'Report complete. Source verification needs review.';
      return null;
    }
  }

  async function loadFeedbackPreferences() {
    if (!window.FractureAuth || typeof window.FractureAuth.getPreferences !== 'function') return null;
    try {
      return await window.FractureAuth.getPreferences();
    } catch (_) {
      return null;
    }
  }

  async function saveCurrentWork(manual) {
    const essay = essayInput.value.trim();
    if (!essay) {
      if (manual && statusDetail) statusDetail.textContent = 'Nothing to save.';
      return null;
    }

    if (!window.FractureAuth || typeof window.FractureAuth.saveProject !== 'function') {
      if (manual && statusDetail) statusDetail.textContent = 'Sign in to add this draft to your work history.';
      return null;
    }

    if (!manual && autoSaveInFlight) return null;
    autoSaveInFlight = true;
    try {
      const payload = currentAnalysisForDraft();
      const saved = await window.FractureAuth.saveProject(essay, payload);
      if (saved) persistActiveWorkspace(saved);
      if (manual && statusDetail) {
        statusDetail.textContent = saved && saved.mode === 'cloud'
          ? 'Draft saved to your work history.'
          : 'Guest drafts are not stored. Sign in to keep this work.';
      }
      return saved;
    } catch (_) {
      if (manual && statusDetail) statusDetail.textContent = 'The draft could not be added to your cloud history.';
      return null;
    } finally {
      autoSaveInFlight = false;
    }
  }

  function extractJsonObject(text) {
    const start = text.indexOf('{');
    if (start === -1) return text;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
    return text.slice(start);
  }

  function parseAuditJson(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      const extracted = extractJsonObject(text);
      try {
        return JSON.parse(extracted);
      } catch (err) {
        const repaired = extracted
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .split(/\r?\n/)
          .filter(function (line) {
            const t = line.trim();
            if (!t) return true;
            return /^["{}\[\],]/.test(t) || /^-?\d/.test(t) || /^(true|false|null)\b/.test(t);
          })
          .join('\n')
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      }
    }
  }

  function renderParsedAudit(audit) {
    if (!audit || typeof audit !== 'object') return;
    parsedAudit = audit;
    if (!rawJsonText.trim()) rawJsonText = JSON.stringify(audit, null, 2);
    if (typeof audit.overall_score === 'number' && scorePill) {
      scorePill.textContent = String(audit.overall_score);
    }
    if (!auditRendered) {
      renderReport(audit);
      auditRendered = true;
    }
    persistActiveWorkspace();
  }

  function displayTimestamp(value) {
    if (!value) return 'Saved recently';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Saved recently' : date.toLocaleString();
  }

  function historyEmpty(message) {
    if (!studioHistoryList) return;
    studioHistoryList.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'studio-history-empty';
    empty.textContent = message;
    studioHistoryList.appendChild(empty);
  }

  async function applyWorkspace(workspace) {
    if (!workspace || typeof workspace.draft !== 'string') return;
    essayInput.value = workspace.draft;
    updateCharCount();
    resetOutput();
    if (window.FractureAuth && typeof window.FractureAuth.setActiveWorkspace === 'function') {
      window.FractureAuth.setActiveWorkspace(workspace);
    }

    const analysis = workspace.analysis && typeof workspace.analysis === 'object' ? workspace.analysis : {};
    if (analysis.audit && typeof analysis.audit === 'object') {
      auditedDraft = workspace.draft.trim();
      rawJsonText = JSON.stringify(analysis.audit, null, 2);
      parsedAudit = analysis.audit;
      sourceVerificationData = analysis.sources || null;
      renderParsedAudit(analysis.audit);
      finalizeJsonTextFromAudit();
      if (sourceVerificationData) {
        const verifier = mountSourceVerification();
        if (verifier && typeof verifier.render === 'function') verifier.render(sourceVerificationData);
      }
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn) shareBtn.disabled = false;
      setProgress(100, 'Saved report loaded');
      setStatus('done', 'Saved report loaded from your work history.');
    } else {
      setStatus('idle', 'Saved draft loaded. Run Fracture it when you are ready.');
    }
  }

  async function loadStudioHistory() {
    if (!studioHistoryList || !window.FractureAuth || typeof window.FractureAuth.listProjects !== 'function') return;
    historyEmpty('Loading your saved work...');
    const user = typeof window.FractureAuth.getUser === 'function' ? await window.FractureAuth.getUser() : null;
    if (!user) {
      historyEmpty('Sign in to open saved drafts and prepare rebuttals without pasting your speech again.');
      return;
    }

    const projects = await window.FractureAuth.listProjects();
    if (!projects.length) {
      historyEmpty('No saved work yet. Analyze a draft and Fracture will keep it here for your next round of revisions.');
      return;
    }

    studioHistoryList.innerHTML = '';
    projects.slice(0, 8).forEach(function (project) {
      const item = document.createElement('article');
      item.className = 'studio-history-item';

      const copy = document.createElement('div');
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      title.textContent = project.title || 'Untitled argument';
      meta.textContent = displayTimestamp(project.updated || project.updated_at);
      copy.appendChild(title);
      copy.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'studio-history-actions';
      const load = document.createElement('button');
      load.className = 'btn-sm';
      load.type = 'button';
      load.textContent = 'Load';
      load.addEventListener('click', function () { applyWorkspace(project); });
      const rebuttals = document.createElement('a');
      rebuttals.className = 'btn-sm';
      rebuttals.href = 'rebuttals.html?project=' + encodeURIComponent(project.id || '');
      rebuttals.textContent = 'Prepare Rebuttals';
      rebuttals.addEventListener('click', function () {
        if (window.FractureAuth && typeof window.FractureAuth.setActiveWorkspace === 'function') {
          window.FractureAuth.setActiveWorkspace(project);
        }
      });
      actions.appendChild(load);
      actions.appendChild(rebuttals);
      item.appendChild(copy);
      item.appendChild(actions);
      studioHistoryList.appendChild(item);
    });
  }

  async function maybeLoadSavedProject() {
    const projectId = new URLSearchParams(window.location.search).get('project');
    if (!projectId || !window.FractureAuth || typeof window.FractureAuth.getProject !== 'function') return;
    const workspace = await window.FractureAuth.getProject(projectId);
    if (workspace) await applyWorkspace(workspace);
  }

  function updateToolButton(input, button) {
    if (!input || !button) return;
    button.disabled = !input.value.trim();
  }

  function setToolProgress(progressEl, statusEl, value, message) {
    if (progressEl) progressEl.style.width = Math.max(0, Math.min(100, value || 0)) + '%';
    if (statusEl && message) statusEl.textContent = message;
  }

  async function streamPlainTextTool(options) {
    const input = options.input;
    const button = options.button;
    const output = options.output;
    if (!input || !button || !output || !input.value.trim()) return;

    const requestText = input.value.trim();
    button.disabled = true;
    const outputTarget = typeof options.createOutputTarget === 'function'
      ? options.createOutputTarget(requestText)
      : output;
    if (!options.preserveOutput) outputTarget.textContent = '';
    setToolProgress(options.progress, options.status, 4, 'Connecting');

    try {
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body(requestText))
      });
      if (!response.ok) {
        const payload = await response.json().catch(function () { return {}; });
        throw new Error(payload.error || response.statusText);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(function (line) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) return;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') return;
          try {
            const event = JSON.parse(data);
            if (event.fracture_text_delta) outputTarget.textContent += event.fracture_text_delta;
            if (event.fracture_text_progress) {
              setToolProgress(options.progress, options.status, event.fracture_text_progress.progress, event.fracture_text_progress.message);
            }
            if (event.fracture_text_error) throw new Error(event.fracture_text_error);
          } catch (err) {
            if (err && err.message && !/Unexpected token/.test(err.message)) throw err;
          }
        });
      }

      setToolProgress(options.progress, options.status, 100, 'Ready');
      if (typeof options.onComplete === 'function') options.onComplete(outputTarget.textContent);
    } catch (err) {
      outputTarget.textContent = 'This request could not finish. ' + (err && err.message ? err.message : String(err));
      setToolProgress(options.progress, options.status, 0, 'Needs attention');
    } finally {
      updateToolButton(input, button);
    }
  }

  function selectChatPoint(point) {
    selectedChatPoint = firstText(point);
    if (!selectedChatPoint || !chatSelectedPoint) return;
    chatSelectedPoint.textContent = 'Selected pressure point: ' + selectedChatPoint;
    chatSelectedPoint.classList.remove('hidden');
    if (chatInput && !chatInput.value.trim()) {
      chatInput.value = 'How should I strengthen this exact point? Give me a practical rewrite and explain why it works.';
      updateToolButton(chatInput, chatBtn);
    }
    if (fractureChatCard) fractureChatCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function runChat() {
    return streamPlainTextTool({
      endpoint: '/api/chat',
      input: chatInput,
      button: chatBtn,
      output: chatOutput,
      preserveOutput: true,
      progress: chatProgress,
      status: chatStatus,
      createOutputTarget: function (question) {
        appendChatMessage('user', question);
        chatHistory.push({ role: 'user', content: question });
        chatInput.value = '';
        const response = appendChatMessage('assistant', '');
        chatOutput.scrollTop = chatOutput.scrollHeight;
        return response;
      },
      body: function (question) {
        return {
          message: question,
          draft: essayInput.value.trim(),
          report: parsedAudit,
          selectedPoint: selectedChatPoint,
          history: chatHistory.slice(0, -1)
        };
      },
      onComplete: function (answer) {
        if (answer) chatHistory.push({ role: 'assistant', content: answer });
        chatOutput.scrollTop = chatOutput.scrollHeight;
      }
    });
  }

  function appendChatMessage(role, content) {
    const message = document.createElement('div');
    message.className = 'chat-message chat-message-' + role;
    const label = document.createElement('span');
    label.className = 'chat-message-label';
    label.textContent = role === 'user' ? 'You' : 'Fracture Chat';
    const body = document.createElement('span');
    body.textContent = content || '';
    message.appendChild(label);
    message.appendChild(body);
    chatOutput.appendChild(message);
    return body;
  }

  function clearChatConversation() {
    chatHistory = [];
    if (chatOutput) chatOutput.textContent = '';
    if (chatStatus) chatStatus.textContent = 'Ready';
    setToolProgress(chatProgress, chatStatus, 0, 'Ready');
  }

  function finalizeJsonTextFromAudit() {
    if (!parsedAudit) return false;
    try {
      JSON.parse(rawJsonText);
      return true;
    } catch (_) {
      rawJsonText = JSON.stringify(parsedAudit, null, 2);
      return true;
    }
  }

  // ── Report renderer ────────────────────────────────────────────────────────
  function renderReport(parsed) {
    const c = reportContainer;
    if (outputPanel) outputPanel.hidden = false;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;
    c.classList.remove('streaming');
    c.innerHTML = '';

    function section(title, innerHTML, open) {
      const shouldOpen = open !== false;
      return '<details class="report-section"' + (shouldOpen ? ' open' : '') + '>'
           + '<summary>' + title + '</summary>'
           + '<div class="content">' + innerHTML + '</div>'
           + '</details>';
    }

    const scores = parsed.score_breakdown || {};
    const readFirstSection =
      '<p>' + esc(parsed.verdict || '') + '</p>'
    + '<p><span class="report-label">First Move:</span> ' + esc(parsed.coaching_note || '') + '</p>';

    const scoreDescriptions = parsed.score_explanations || {};
    const scoreSection =
      '<p>' + esc(parsed.verdict || '') + '</p>'
    + '<p><span class="report-label">Coaching Note:</span> ' + esc(parsed.coaching_note || '') + '</p>'
    + '<div class="score-grid">'
    + scoreChip('Argument Strength', scores.argument_strength, scoreDescriptions.argument_strength)
    + scoreChip('Assumption Safety', scores.assumption_audit, scoreDescriptions.assumption_audit)
    + scoreChip('Logic', scores.logic, scoreDescriptions.logic)
    + scoreChip('Rhetoric', scores.rhetoric, scoreDescriptions.rhetoric)
    + '</div>';

    function scoreChip(label, value, description) {
      return '<div class="score-chip"><strong>' + esc(label) + '</strong><span>' + esc(String(value ?? '—')) + '/25</span><small>' + esc(description || '') + '</small></div>';
    }

    const thesis = (parsed.argument_strength || {}).thesis || {};
    const thesisSection =
      '<div class="report-item"><span class="report-label">Thesis:</span>'
    + quoteBlock(thesis.quote)
    + '<p>' + esc(thesis.assessment || '') + '</p></div>';

    const claimsSection = ((parsed.argument_strength || {}).claims || []).map(function (cl) {
      return '<div class="report-item">'
           + '<span class="report-label">Claim:</span>'
           + quoteBlock(cl.quote)
           + '<p><b>Rating:</b> ' + esc(cl.rating || '—') + '</p>'
           + '<p><b>What breaks:</b> ' + esc(cl.diagnosis || '') + '</p>'
           + '<p><b>How someone attacks it:</b> ' + esc(cl.opponent_exploit || '') + '</p>'
           + '<p><b>Exact repair:</b> ' + esc(cl.fix || '') + '</p>'
           + '</div>';
    }).join('') || '<p>No claims parsed.</p>';

    const assumptionsSection = (parsed.assumption_audit || []).map(function (a) {
      return '<div class="report-item">'
           + '<p><b>Assumption:</b> ' + esc(a.assumption || '') + '</p>'
           + '<p><b>Load-bearing:</b> ' + esc(a.load_bearing || '') + '</p>'
           + '<p><b>Criticality score:</b> ' + esc(String(a.criticality_score ?? '—')) + '/100</p>'
           + '<span class="report-label">Dependent Claim:</span>'
           + quoteBlock(a.quote)
           + renderInlineList('What hinges on it', a.hinges_on)
           + '<p><b>If this changes:</b> ' + esc(a.if_changed || a.vulnerability || '') + '</p>'
           + '<p><b>How to justify it:</b> ' + esc(a.justification || a.defense || '') + '</p>'
           + '<p><b>Why this is risky:</b> ' + esc(a.vulnerability || '') + '</p>'
           + '<p><b>How to defend it:</b> ' + esc(a.defense || '') + '</p>'
           + '</div>';
    }).join('') || '<p>No assumptions parsed.</p>';

    const fallaciesSection = (parsed.logical_fallacies || []).map(function (f) {
      return '<div class="report-item">'
           + '<p><b>' + esc(f.name || 'Fallacy') + '</b></p>'
           + quoteBlock(f.quote)
           + '<p>' + esc(f.explanation || '') + '</p>'
           + '<p><b>Fix:</b> ' + esc(f.fix || '') + '</p>'
           + '</div>';
    }).join('') || '<p>No explicit fallacies flagged.</p>';

    const countersSection = (parsed.counter_arguments || []).map(function (ct) {
      return '<div class="report-item">'
           + '<div class="report-metric-row"><span class="report-metric">Rank ' + esc(String(ct.rank ?? '—')) + '</span><span class="report-metric report-metric-risk">Risk score: ' + esc(String(ct.fatality_score ?? '—')) + '/100</span><span class="report-metric">' + esc(firstText(ct.attack_type, 'logic')) + '</span></div>'
           + '<p><b>Steelman:</b> ' + esc(ct.steelman || '') + '</p>'
           + '<span class="report-label">Targets:</span>'
           + quoteBlock(ct.targets)
           + '<p><b>Damage:</b> ' + esc(ct.damage || '') + '</p>'
           + '<p><b>Suggested Rebuttal:</b> ' + esc(ct.suggested_rebuttal || '') + '</p>'
           + '<p><b>How to prepare:</b> ' + esc(ct.preparation || '') + '</p>'
           + '</div>';
    }).join('') || '<p>No counter-arguments generated.</p>';

    const rhet = parsed.rhetorical_analysis || {};
    const rhetoricSection =
      '<p><b>Opening Hook:</b> ' + esc(rhet.opening_hook || '') + '</p>'
    + '<p><b>Logical Flow:</b> ' + esc(rhet.logical_flow || '') + '</p>'
    + '<p><b>Persuasion:</b> ' + esc(rhet.persuasion_assessment || '') + '</p>'
    + '<p><b>Clarity:</b> ' + esc(rhet.clarity_assessment || '') + '</p>'
    + renderInlineList('Flow repairs', rhet.flow_repairs)
    + ((rhet.world_changing_views || {}).present === 'YES'
      ? '<div class="report-item"><p><b>World-changing view:</b> ' + esc((rhet.world_changing_views || {}).idea || '') + '</p><p><b>Reader resistance:</b> ' + esc((rhet.world_changing_views || {}).reader_risk || '') + '</p><p><b>Make it easier to consider:</b> ' + esc((rhet.world_changing_views || {}).make_reasonable || '') + '</p></div>'
      : '')
    + '<p><b>Strongest Sentence:</b></p>'
    + quoteBlock((rhet.strongest_sentence || {}).quote)
    + '<p>' + esc((rhet.strongest_sentence || {}).why || '') + '</p>'
    + '<p><b>Weakest Sentence:</b></p>'
    + quoteBlock((rhet.weakest_sentence || {}).quote)
    + '<p>' + esc((rhet.weakest_sentence || {}).why || '') + '</p>'
    + '<p><b>Fix:</b> ' + esc((rhet.weakest_sentence || {}).fix || '') + '</p>';

    const rewritesSection = (parsed.rewrite_suggestions || []).map(function (r) {
      return '<div class="report-item">'
           + '<span class="report-label">Original:</span>'
           + quoteBlock(r.original)
           + '<span class="report-label">Rewrite:</span>'
           + quoteBlock(r.rewrite)
           + '<p><b>Improvement:</b> ' + esc(r.improvement || '') + '</p>'
           + '</div>';
    }).join('') || '<p>No rewrite suggestions generated.</p>';

    c.innerHTML =
      section('Read This First', readFirstSection, true) +
      section('Priority Fixes', renderPriorityFixes(parsed), true) +
      section('Collapse Point', renderCollapsePoint(parsed), true) +
      section('Verdict & Score Breakdown', scoreSection, true) +
      section('How the Argument Hangs Together', renderDependencyGraph(parsed), true) +
      section('Thesis Analysis', thesisSection, true) +
      section('Claim-by-Claim Analysis', claimsSection, true) +
      section('Assumption Audit', assumptionsSection, true) +
      section('Logical Fallacies', fallaciesSection, true) +
      section('Counter-Arguments', countersSection, true) +
      section('Attack Tree', renderAttackTree(parsed), true) +
      section('Truth Audit', renderTruthAudit(parsed), true) +
      section('Alternative Solutions Test', renderAlternatives(parsed), true) +
      section('Rhetorical Analysis', rhetoricSection, true) +
      section('Make It Stronger: Rewrite Suggestions', rewritesSection, true);

    renderArgumentGraph(parsed);
    mountSourceVerification();
    requestAnimationFrame(function () { c.classList.add('visible'); });
  }

  // ── Core analysis ──────────────────────────────────────────────────────────
  async function runAnalysis() {
    const essay = essayInput.value.trim();
    if (!essay) { setStatus('error', 'Paste an argument before using Fracture.'); return; }

    resetOutput();
    auditedDraft = essay;
    isStreaming = true;
    setBtns(true);
    if (skeleton) skeleton.classList.add('hidden');
    setStatus('live', 'Fracturing your argument...');
    startProgress();

    try {
      const preferences = await loadFeedbackPreferences();
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay: essay, preferences: preferences }),
      });

      if (!response.ok) {
        const err = await response.json().catch(function () { return { error: response.statusText }; });
        throw new Error(err.error || response.statusText);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let   buffer  = '';
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
            const json  = JSON.parse(data);
            if (json.fracture_progress) {
              setProgress(json.fracture_progress.progress, json.fracture_progress.message);
              continue;
            }
            if (json.fracture_audit) {
              renderParsedAudit(json.fracture_audit);
              continue;
            }
            if (json.fracture_normalized_json) {
              rawJsonText = json.fracture_normalized_json;
              continue;
            }
            if (json.fracture_model_delta) {
              rawJsonText += json.fracture_model_delta;
              appendReadableAuditDelta(json.fracture_model_delta);
              continue;
            }
            const delta = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) || '';
            if (delta) {
              rawJsonText += delta;
              appendReadableAuditDelta(delta);
            }
          } catch (_) { /* ignore malformed SSE chunks */ }
        }
      }

      isStreaming = false;
      setBtns(false);
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn)  shareBtn.disabled  = false;
      stopProgress(true, 'Report ready');
      if (skeleton) skeleton.classList.add('hidden');

      try {
        const parsed = parsedAudit || parseAuditJson(rawJsonText);
        renderParsedAudit(parsed);
        finalizeJsonTextFromAudit();
        setStatus('done', 'Fracture report complete.');
        notifyAuditComplete();
        loadFeedbackPreferences()
          .then(function (preferences) {
            if (!preferences || preferences.saveReports !== false) return saveCurrentWork(false);
            return null;
          });
        runSourceVerification();
      } catch (e) {
        setStatus('error', 'The report could not be displayed. Please run Fracture again.');
        if (jsonError) {
          jsonError.classList.remove('hidden');
          jsonError.textContent = 'Display error: ' + e.message;
        }
      }

    } catch (err) {
      isStreaming = false;
      setBtns(false);
      stopProgress(false, 'Request needs attention');
      if (skeleton) skeleton.classList.add('hidden');
      setStatus('error', 'The request could not finish. Your writing is still safe in the editor.');
      if (jsonError) {
        jsonError.classList.remove('hidden');
        jsonError.textContent = 'Request error: ' + (err && err.message ? err.message : String(err));
      }
    }
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────
  async function exportPdf() {
    if (!parsedAudit) return;
    if (statusDetail) statusDetail.textContent = 'Formatting your PDF report.';
    try {
      const response = await fetch('/api/report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' },
        body: JSON.stringify({
          audit: parsedAudit,
          sources: sourceVerificationData,
          draft: essayInput.value.trim(),
          citation_style: preferredCitationStyle
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(function () { return {}; });
        throw new Error(payload.error || response.statusText);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fracture-studio-report.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (statusDetail) statusDetail.textContent = 'PDF report downloaded.';
    } catch (err) {
      if (statusDetail) statusDetail.textContent = 'PDF export needs attention: ' + (err && err.message ? err.message : String(err));
    }
  }

  function shareLink() {
    if (!rawJsonText) return;
    const encoded = encodeURIComponent(rawJsonText);
    if (encoded.length > 6000) {
      if (statusDetail) statusDetail.textContent = 'This report is too detailed for a private share link. Export the PDF or sign in to save it.';
      return;
    }
    const url = location.origin + location.pathname + '#analysis=' + encoded;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(function () { if (statusDetail) statusDetail.textContent = 'Share link copied to clipboard.'; })
        .catch(function () { history.replaceState(null, '', url); if (statusDetail) statusDetail.textContent = 'Share link placed in the address bar.'; });
    } else {
      history.replaceState(null, '', url);
      if (statusDetail) statusDetail.textContent = 'Share link placed in the address bar.';
    }
  }

  function clearAll() {
    if (isStreaming) return;
    essayInput.value = '';
    updateCharCount();
    resetOutput();
    setStatus('idle', 'Waiting for an argument.');
  }

  function saveEssay() {
    saveCurrentWork(true);
  }

  function loadEssay() {
    window.location.href = 'past-work.html';
  }

  // ── Shared-link loader ─────────────────────────────────────────────────────
  function maybeLoadSharedAnalysis() {
    const queryAnalysis = new URLSearchParams(location.search).get('analysis');
    const hashAnalysis = location.hash.startsWith('#analysis=') ? location.hash.slice(10) : '';
    const analysis = hashAnalysis || queryAnalysis;
    if (!analysis) return;
    try {
      rawJsonText = decodeURIComponent(analysis);
      const parsed = parseAuditJson(rawJsonText);
      parsedAudit = parsed;
      auditRendered = true;
      if (typeof parsed.overall_score === 'number' && scorePill) scorePill.textContent = String(parsed.overall_score);
      renderReport(parsed);
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn)  shareBtn.disabled  = false;
      if (statusLabel)  statusLabel.textContent  = 'Loaded';
      if (statusDetail) statusDetail.textContent = 'Analysis loaded from shared link.';
    } catch (_) { /* ignore invalid shared payload */ }
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  essayInput.addEventListener('input', updateCharCount);
  essayInput.addEventListener('input', function () { persistActiveWorkspace(); });
  document.addEventListener('click', function (event) {
    if (!isStreaming) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank') return;
    link.target = '_blank';
    link.rel = 'noopener';
    if (statusDetail) statusDetail.textContent = 'Audit still running here. The selected page opened in a new tab.';
  });
  window.addEventListener('focus', function () {
    if (document.title === 'Report ready - Fracture Studio') document.title = 'Studio - Fracture Studio';
  });
  window.addEventListener('beforeunload', function (event) {
    if (!isStreaming) return;
    event.preventDefault();
    event.returnValue = '';
  });
  analyzeBtn.addEventListener('click', runAnalysis);
  if (clearBtn)  clearBtn.addEventListener('click',  clearAll);
  if (exportBtn) exportBtn.addEventListener('click', exportPdf);
  if (shareBtn)  shareBtn.addEventListener('click',  shareLink);
  if (saveBtn)   saveBtn.addEventListener('click',   saveEssay);
  if (loadBtn)   loadBtn.addEventListener('click',   loadEssay);
  if (rebuttalsBtn) rebuttalsBtn.addEventListener('click', function () { persistActiveWorkspace(); });
  if (refreshStudioHistory) refreshStudioHistory.addEventListener('click', loadStudioHistory);
  if (chatInput) chatInput.addEventListener('input', function () { updateToolButton(chatInput, chatBtn); });
  if (chatBtn) chatBtn.addEventListener('click', runChat);
  if (chatClearBtn) chatClearBtn.addEventListener('click', clearChatConversation);
  if (argumentGraph) {
    argumentGraph.addEventListener('click', function (event) {
      const target = event.target.closest('[data-chat-point]');
      if (!target) return;
      selectChatPoint(decodeURIComponent(target.getAttribute('data-chat-point') || ''));
    });
    argumentGraph.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest('[data-chat-point]');
      if (!target) return;
      event.preventDefault();
      selectChatPoint(decodeURIComponent(target.getAttribute('data-chat-point') || ''));
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  updateCharCount();
  setStatus('idle', 'Waiting for an argument.');
  setProgress(0, 'Ready when you are');
  if (skeleton) skeleton.classList.add('hidden');
  maybeLoadSharedAnalysis();
  window.setTimeout(maybeLoadSavedProject, 350);
})();
