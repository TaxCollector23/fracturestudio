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
  const analysisFormat  = document.getElementById('analysisFormat');
  const depthLevel      = document.getElementById('depthLevel');
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
  const scoreSummary    = document.getElementById('scoreSummary');
  const exportBtn       = document.getElementById('exportBtn');
  const shareBtn        = document.getElementById('shareBtn');
  const copyReportBtn   = document.getElementById('copyReportBtn');
  const downloadTextBtn = document.getElementById('downloadTextBtn');
  const printReportBtn  = document.getElementById('printReportBtn');
  const reportNav       = document.getElementById('reportNav');
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
  let readableReportText = '';
  let finalAuditStreamText = '';
  let finalAuditStreamSections = [];
  let serverReadableStreaming = false;
  let postAnalysisSurveyShown = false;

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
    if (isStreaming && !auditRendered && !serverReadableStreaming) renderStreamingReadableReport();
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
    if (scoreSummary) scoreSummary.hidden = true;
    updateReportActions(false);
    if (reportNav) reportNav.hidden = true;
    finalAuditStreamText = '';
    finalAuditStreamSections = [];
    serverReadableStreaming = false;
    if (reportContainer) { reportContainer.innerHTML = ''; reportContainer.classList.remove('visible', 'streaming', 'final-streaming'); }
    resetArgumentGraph();
    if (skeleton)   skeleton.classList.add('hidden');
    setProgress(0, 'Ready when you are');
  }

  function setBtns(disabled) {
    [analyzeBtn, clearBtn, saveBtn, loadBtn, rebuttalsBtn].forEach(function (b) {
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


  function renderFinalAuditStream() {
    if (!reportContainer || auditRendered) return;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;

    const sectionsHtml = finalAuditStreamSections.map(function (section, index) {
      return '<section class="final-audit-stream-section">'
        + '<div class="final-audit-stream-kicker">' + esc(section.title || ('Section ' + (index + 1))) + '</div>'
        + '<p>' + esc(section.body || '').replace(/\n/g, '<br>') + '</p>'
        + '</section>';
    }).join('');

    reportContainer.innerHTML = '<article class="final-audit-stream">'
      + '<div class="final-audit-stream-status"><span class="streaming-report-pulse"></span><span>Writing the final readable audit</span></div>'
      + (sectionsHtml || '<p class="streaming-report-writing">Converting the Fracture JSON into the report you will actually use<span class="streaming-report-caret"></span></p>')
      + '<span class="streaming-report-caret" aria-hidden="true"></span>'
      + '</article>';
    reportContainer.classList.add('visible', 'streaming', 'final-streaming');
  }

  function startFinalAuditStream() {
    serverReadableStreaming = true;
    finalAuditStreamText = '';
    finalAuditStreamSections = [];
    renderFinalAuditStream();
  }

  function appendFinalAuditDelta(section) {
    if (!section || typeof section !== 'object') return;
    serverReadableStreaming = true;
    const next = {
      title: firstText(section.title, 'Report section'),
      body: firstText(section.body)
    };
    if (!next.body) return;
    finalAuditStreamSections.push(next);
    finalAuditStreamText += (finalAuditStreamText ? '\n\n' : '') + next.title + '\n' + next.body;
    readableReportText = finalAuditStreamText;
    renderFinalAuditStream();
  }

  function finishFinalAuditStream() {
    serverReadableStreaming = false;
    if (reportContainer) reportContainer.classList.remove('streaming');
  }

  function renderStreamingReadableReport() {
    if (!reportContainer || auditRendered) return;
    if (finalReviewPlaceholder) finalReviewPlaceholder.hidden = true;

    const verdict = streamedStringValue(rawJsonText, 'verdict');
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

    html += streamingReportSection('Verdict in progress', verdict);

    problems.forEach(function (problem, index) {
      const details = [
        whyItMatters[index] ? 'Why it matters: ' + whyItMatters[index] : '',
        exactFixes[index] ? 'What to change: ' + exactFixes[index] : ''
      ].filter(Boolean).join(' ');
      html += streamingReportSection('Priority ' + (index + 1), problem + (details ? ' ' + details : ''));
    });

    html += streamingReportSection('Collapse point', collapse);
    html += streamingReportSection('Likely challenge', opponentAttack);

    if (!verdict && !problems.length && !collapse) {
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

  function uniqueItems(items, keyFn) {
    const seen = new Set();
    return asArray(items).filter(function (item) {
      const key = String(typeof keyFn === 'function' ? keyFn(item) : item).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeRenderedAudit(audit) {
    if (!audit || typeof audit !== 'object') return audit;
    const next = Object.assign({}, audit);
    next.priority_fixes = uniqueItems(next.priority_fixes, function (item) {
      return firstText(item.quote, item.problem, item.exact_fix);
    });
    next.logical_fallacies = uniqueItems(next.logical_fallacies, function (item) {
      return firstText(item.name, item.quote, item.explanation);
    });
    next.counter_arguments = uniqueItems(next.counter_arguments, function (item) {
      return firstText(item.steelman, item.targets, item.damage);
    });
    next.attack_tree = uniqueItems(next.attack_tree, function (item) {
      return firstText(item.attack, item.targets, item.response);
    });
    next.truth_audit = uniqueItems(next.truth_audit, function (item) {
      return firstText(item.claim, item.verification_step);
    });
    next.rewrite_suggestions = uniqueItems(next.rewrite_suggestions, function (item) {
      return firstText(item.original, item.rewrite);
    });
    return next;
  }

  function scoreLabel(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return 'Not scored yet';
    if (score >= 90) return 'Strong and resilient';
    if (score >= 75) return 'Strong with fixable pressure points';
    if (score >= 60) return 'Usable but vulnerable';
    if (score >= 40) return 'Major revision needed';
    if (score >= 11) return 'Argument collapses under pressure';
    return 'Not enough argument to evaluate';
  }

  function scoreChip(label, value, description) {
    return '<div class="score-chip"><strong>' + esc(label) + '</strong><span>' + esc(String(value ?? '—')) + '/25</span><small>' + esc(description || '') + '</small></div>';
  }

  function mainStrength(parsed) {
    const rhet = parsed.rhetorical_analysis || {};
    return firstText(
      (rhet.strongest_sentence || {}).why,
      ((parsed.argument_strength || {}).thesis || {}).assessment,
      'The draft has enough material for a focused revision pass.'
    );
  }

  function mainWeakness(parsed) {
    const fix = (asArray(parsed.priority_fixes)[0] || {});
    const collapse = parsed.collapse_point || {};
    return firstText(
      fix.problem,
      collapse.why_it_collapses,
      (rhetWeakest(parsed) || {}).why,
      'The argument needs a clearer connection between its claim and its proof.'
    );
  }

  function rhetWeakest(parsed) {
    return ((parsed.rhetorical_analysis || {}).weakest_sentence || {});
  }

  function revisionPath(parsed) {
    const fixes = asArray(parsed.priority_fixes).slice(0, 4);
    if (!fixes.length) return '<p>Start by clarifying the thesis, then add one direct warrant for the main claim.</p>';
    return '<ol class="report-mission-list">' + fixes.map(function (fix, index) {
      return '<li><b>Mission ' + (index + 1) + ':</b> ' + esc(firstText(fix.exact_fix, fix.problem, 'Repair this pressure point.'))
        + '<span>' + esc(firstText(fix.why_it_matters, fix.necessity, 'This is one of the fastest ways to improve the argument.')) + '</span></li>';
    }).join('') + '</ol>';
  }

  function buildReadableReportText(parsed) {
    const scores = parsed.score_breakdown || {};
    const thesis = (parsed.argument_strength || {}).thesis || {};
    const lines = [];
    lines.push('Fracture Studio Report');
    lines.push('');
    lines.push('Verdict and Score');
    lines.push('Overall score: ' + (typeof parsed.overall_score === 'number' ? parsed.overall_score + '/100' : 'Not scored'));
    lines.push(scoreLabel(parsed.overall_score));
    if (parsed.verdict) lines.push(parsed.verdict);
    lines.push('');
    lines.push('Score Breakdown');
    lines.push('Argument Strength: ' + (scores.argument_strength ?? '—') + '/25');
    lines.push('Assumption Safety: ' + (scores.assumption_audit ?? '—') + '/25');
    lines.push('Logic: ' + (scores.logic ?? '—') + '/25');
    lines.push('Rhetoric: ' + (scores.rhetoric ?? '—') + '/25');
    lines.push('');
    lines.push('Main Strength');
    lines.push(mainStrength(parsed));
    lines.push('');
    lines.push('Main Weakness');
    lines.push(mainWeakness(parsed));
    lines.push('');
    lines.push('Thesis');
    lines.push(firstText(thesis.quote, 'No clear thesis detected.'));
    if (thesis.assessment) lines.push(thesis.assessment);
    lines.push('');
    lines.push('Priority Fixes');
    (asArray(parsed.priority_fixes).length ? asArray(parsed.priority_fixes) : fallbackPriorityFixes(parsed)).forEach(function (fix, index) {
      lines.push((index + 1) + '. ' + firstText(fix.problem, 'Repair this pressure point.'));
      if (fix.quote) lines.push('Text: ' + fix.quote);
      if (fix.why_it_matters) lines.push('Why it matters: ' + fix.why_it_matters);
      if (fix.exact_fix) lines.push('Exact fix: ' + fix.exact_fix);
      if (fix.rewrite) lines.push('Suggested wording: ' + fix.rewrite);
      lines.push('');
    });
    lines.push('Collapse Point');
    const collapse = parsed.collapse_point || {};
    lines.push(firstText(collapse.quote, 'No single collapse point detected.'));
    if (collapse.why_it_collapses) lines.push(collapse.why_it_collapses);
    if (collapse.strongest_attack || collapse.opponent_attack) lines.push('Likely attack: ' + firstText(collapse.strongest_attack, collapse.opponent_attack));
    if (collapse.strongest_defense || collapse.reinforcement) lines.push('Repair: ' + firstText(collapse.strongest_defense, collapse.reinforcement));
    lines.push('');
    lines.push('Claims');
    asArray((parsed.argument_strength || {}).claims).forEach(function (claim, index) {
      lines.push((index + 1) + '. ' + firstText(claim.quote, 'Claim'));
      if (claim.rating) lines.push('Rating: ' + claim.rating);
      if (claim.diagnosis) lines.push('Diagnosis: ' + claim.diagnosis);
      if (claim.fix) lines.push('Repair: ' + claim.fix);
      lines.push('');
    });
    lines.push('Counterarguments and Questions');
    asArray(parsed.attack_tree).forEach(function (attack, index) {
      lines.push((index + 1) + '. ' + firstText(attack.attack, attack.why_dangerous, 'Opponent attack'));
      if (attack.response) lines.push('Response: ' + attack.response);
      if (attack.crossfire_question) lines.push('Crossfire question: ' + attack.crossfire_question);
      lines.push('');
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
    const format = analysisFormat ? analysisFormat.value : '';
    const depth  = depthLevel ? depthLevel.value : 'medium';
    if (!window.FractureAuth || typeof window.FractureAuth.getPreferences !== 'function') {
      return { analysisFormat: format, depthLevel: depth };
    }
    try {
      return Object.assign({}, await window.FractureAuth.getPreferences(), { analysisFormat: format, depthLevel: depth });
    } catch (_) {
      return { analysisFormat: format, depthLevel: depth };
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
          : 'Draft saved in this browser. Sign in to keep cloud history.';
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
    parsedAudit = normalizeRenderedAudit(audit);
    if (!rawJsonText.trim()) rawJsonText = JSON.stringify(audit, null, 2);
    if (typeof audit.overall_score === 'number' && scorePill) {
      scorePill.textContent = String(audit.overall_score);
      if (scoreSummary) scoreSummary.hidden = false;
    }
    if (!auditRendered) {
      renderReport(parsedAudit);
      auditRendered = true;
    }
    maybeShowPostAnalysisSurvey();
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
      updateReportActions(true);
      setProgress(100, 'Saved report loaded');
      setStatus('done', 'Saved report loaded from your work history.');
    } else {
      setStatus('idle', 'Saved draft loaded. Run Fracture It when you are ready.');
    }
  }

  async function loadStudioHistory() {
    if (!studioHistoryList || !window.FractureAuth || typeof window.FractureAuth.listProjects !== 'function') return;
    historyEmpty('Loading your saved work...');
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
    if (reportNav) reportNav.hidden = false;
    c.classList.remove('streaming', 'final-streaming');
    c.innerHTML = '';

    function section(title, innerHTML, open, id) {
      const shouldOpen = open !== false;
      return '<details class="report-section"' + (id ? ' id="' + esc(id) + '"' : '') + (shouldOpen ? ' open' : '') + '>'
           + '<summary>' + title + '</summary>'
           + '<div class="content">' + innerHTML + '</div>'
           + '</details>';
    }

    const scores = parsed.score_breakdown || {};
    const scoreDescriptions = parsed.score_explanations || {};
    const verdictSection =
      '<div class="verdict-card">'
    + '<div><span class="report-label">Overall Score</span><strong>' + esc(typeof parsed.overall_score === 'number' ? parsed.overall_score + '/100' : 'Not scored') + '</strong><small>' + esc(scoreLabel(parsed.overall_score)) + '</small></div>'
    + '<p>' + esc(parsed.verdict || 'Fracture did not receive enough report text to write a verdict.') + '</p>'
    + '</div>'
    + '<div class="report-dual-grid">'
    + '<div class="report-item"><p><b>Main strength:</b> ' + esc(mainStrength(parsed)) + '</p></div>'
    + '<div class="report-item"><p><b>Main weakness:</b> ' + esc(mainWeakness(parsed)) + '</p></div>'
    + '</div>'
    + '<div class="report-item"><p><b>Revision path:</b></p>' + revisionPath(parsed) + '</div>';

    const scoreSection =
      '<div class="score-grid">'
    + scoreChip('Argument Strength', scores.argument_strength, scoreDescriptions.argument_strength)
    + scoreChip('Assumption Safety', scores.assumption_audit, scoreDescriptions.assumption_audit)
    + scoreChip('Logic', scores.logic, scoreDescriptions.logic)
    + scoreChip('Rhetoric', scores.rhetoric, scoreDescriptions.rhetoric)
    + '</div>';

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

    readableReportText = buildReadableReportText(parsed);
    var mode = (analysisFormat && analysisFormat.value) || 'argument';

    // Build verdict and score sections (shared across all modes)
    var verdictAndScore = section('Verdict and Score', verdictSection, true, 'report-verdict')
      + section('Score Breakdown', scoreSection, true);

    // Priority fixes (shared, always last or near-last)
    var pfixesHtml = '<ol class="priority-fixes-list">'
      + (asArray(parsed.priority_fixes).length ? asArray(parsed.priority_fixes) : fallbackPriorityFixes(parsed)).map(function (fix, i) {
        return '<li class="priority-fix-li">'
          + '<div class="priority-fix-header"><span class="priority-fix-num">' + (i + 1) + '</span><strong>' + esc(firstText(fix.problem, 'Repair needed')) + '</strong></div>'
          + (fix.quote ? quoteBlock(fix.quote) : '')
          + (fix.why_it_matters ? '<p class="pf-why">' + esc(fix.why_it_matters) + '</p>' : '')
          + (fix.exact_fix ? '<p><b>Fix:</b> ' + esc(fix.exact_fix) + '</p>' : '')
          + (fix.rewrite ? '<div class="report-label">Rewritten:</div>' + quoteBlock(fix.rewrite) : '')
          + '</li>';
      }).join('')
      + '</ol>';

    // Rubric mode: totally different top-level structure
    if (mode === 'rubric') {
      var rubricScoreHtml = '<div class="rubric-score-hero">'
        + '<div class="rubric-score-main"><span>' + esc(String(parsed.score_earned || 0)) + '</span><small>/ ' + esc(String(parsed.rubric_total_possible || 0)) + ' points</small></div>'
        + '<div class="rubric-score-pct">' + esc(parsed.percentage || '0%') + '</div>'
        + '<div class="rubric-grade">' + esc(parsed.letter_grade || '—') + '</div>'
        + '</div>'
        + '<div class="verdict-card"><p>' + esc(parsed.verdict || '') + '</p></div>';
      c.innerHTML = rubricScoreHtml
        + renderModeSpecificSections(parsed, section)
        + section('Priority Fixes', pfixesHtml, true, 'report-priorities');
    } else {
      // All other modes: verdict + scores, then mode-specific, then shared fallacies, then priority fixes
      var fallaciesHtml2 = asArray(parsed.logical_fallacies).map(function (f) {
        return '<div class="report-item"><p><b>' + esc(f.name || 'Fallacy') + '</b></p>' + quoteBlock(f.quote) + '<p>' + esc(f.explanation || '') + '</p><p><b>Fix:</b> ' + esc(f.fix || '') + '</p></div>';
      }).join('') || '<p>No explicit fallacies flagged.</p>';

      c.innerHTML = verdictAndScore
        + renderModeSpecificSections(parsed, section)
        + (parsed.logical_fallacies && asArray(parsed.logical_fallacies).length ? section('Logical Fallacies', fallaciesHtml2, false) : '')
        + (parsed.rhetorical_analysis ? section('Rhetorical Analysis', rhetoricSection, false) : '')
        + section('Priority Fixes', pfixesHtml, true, 'report-priorities');
    }

    renderArgumentGraph(parsed);
    mountSourceVerification();
    updateReportActions(true);
    requestAnimationFrame(function () { c.classList.add('visible'); });
  }

  // ── Mode-aware section renderers ──────────────────────────────────────────

  function renderModeSpecificSections(parsed, section) {
    var mode = (analysisFormat && analysisFormat.value) || 'argument';
    var html = '';

    // ── ARGUMENT mode extras ──
    if (mode === 'argument' || mode === 'debate-case' || mode === 'policy' || mode === 'not-chosen') {
      // Claims with full evidence/warrant/impact
      var claimsHtml = asArray(parsed.claims).map(function (cl, i) {
        var rc = (cl.rating || 'WEAK').toLowerCase();
        return '<div class="report-item">'
          + '<div class="report-metric-row"><span class="report-metric report-metric-' + (rc === 'strong' ? 'strong' : rc === 'moderate' ? '' : 'risk') + '">Claim ' + (i+1) + ': ' + esc(cl.rating || 'WEAK') + '</span></div>'
          + quoteBlock(cl.quote)
          + (cl.evidence_used ? '<p><b>Evidence used:</b> ' + esc(cl.evidence_used) + '</p>' : '')
          + (cl.warrant ? '<p><b>Warrant:</b> ' + esc(cl.warrant) + '</p>' : '')
          + (cl.missing_warrant ? '<p><b>Missing warrant:</b> ' + esc(cl.missing_warrant) + '</p>' : '')
          + (cl.impact ? '<p><b>Impact:</b> ' + esc(cl.impact) + '</p>' : '')
          + (cl.diagnosis ? '<p><b>Diagnosis:</b> ' + esc(cl.diagnosis) + '</p>' : '')
          + (cl.opponent_exploit ? '<p><b>Opponent attack:</b> ' + esc(cl.opponent_exploit) + '</p>' : '')
          + (cl.fix ? '<p><b>Fix:</b> ' + esc(cl.fix) + '</p>' : '')
          + (cl.rewrite ? '<div class="report-label">Rewrite:</div>' + quoteBlock(cl.rewrite) : '')
          + '</div>';
      }).join('') || '<p>No claims parsed.</p>';
      html += section('Claim-by-Claim Analysis (Evidence → Warrant → Impact)', claimsHtml, true, 'report-claims');

      // Attackable Gaps
      var gapsHtml = asArray(parsed.attackable_gaps).map(function (g) {
        return '<div class="report-item">'
          + '<p><b>' + esc(g.gap || '') + '</b></p>'
          + (g.quote ? quoteBlock(g.quote) : '')
          + (g.why_vulnerable ? '<p><b>Why vulnerable:</b> ' + esc(g.why_vulnerable) + '</p>' : '')
          + (g.how_to_close ? '<p><b>How to close:</b> ' + esc(g.how_to_close) + '</p>' : '')
          + (g.source_needed ? '<div class="report-source-box"><span class="report-label">Source needed:</span><p>' + esc(g.source_needed.what || '') + '</p><p><b>Search:</b> ' + esc(g.source_needed.search_terms || '') + '</p><p><b>Why it helps:</b> ' + esc(g.source_needed.why_it_helps || '') + '</p></div>' : '')
          + '</div>';
      }).join('') || '<p>No critical gaps identified.</p>';
      html += section('Attackable Gaps', gapsHtml, true);

      // Rebuttal Prep
      var reb = parsed.rebuttal_prep || {};
      var sr = reb.strongest_rebuttal || {}, er = reb.easiest_rebuttal || {}, snr = reb.sneakiest_rebuttal || {};
      var rebHtml = '<div class="report-item"><div class="report-metric-row"><span class="report-metric report-metric-risk">Strongest Attack</span></div>'
        + '<p><b>Attack:</b> ' + esc(sr.attack || '') + '</p>'
        + '<p><b>Targets:</b> ' + esc(sr.targets || '') + '</p>'
        + '<p><b>Why dangerous:</b> ' + esc(sr.why_dangerous || '') + '</p>'
        + '<p><b>How to answer (say this):</b> ' + esc(sr.how_to_answer || '') + '</p>'
        + (sr.evidence_to_block ? '<p><b>Evidence to block it:</b> ' + esc(sr.evidence_to_block) + '</p>' : '')
        + '</div>'
        + '<div class="report-item"><div class="report-metric-row"><span class="report-metric">Easiest Attack</span></div>'
        + '<p><b>Attack:</b> ' + esc(er.attack || '') + '</p>'
        + '<p><b>Why easy:</b> ' + esc(er.why_easy || '') + '</p>'
        + '<p><b>How to answer:</b> ' + esc(er.how_to_answer || '') + '</p></div>'
        + '<div class="report-item"><div class="report-metric-row"><span class="report-metric">Sneakiest Attack</span></div>'
        + '<p><b>Attack:</b> ' + esc(snr.attack || '') + '</p>'
        + '<p><b>Why sneaky:</b> ' + esc(snr.why_sneaky || '') + '</p>'
        + '<p><b>How to answer:</b> ' + esc(snr.how_to_answer || '') + '</p></div>';
      html += section('Rebuttal Preparation', rebHtml, true, 'report-rebuttal');

      // Extra Arguments
      var extras = asArray(parsed.extra_arguments);
      if (extras.length) {
        var extHtml = extras.map(function (e) {
          return '<div class="report-item report-item-extra">'
            + '<p><b>' + esc(e.argument || '') + '</b></p>'
            + (e.why_important ? '<p>' + esc(e.why_important) + '</p>' : '')
            + (e.how_to_add ? '<p><b>How to add it:</b> ' + esc(e.how_to_add) + '</p>' : '')
            + (e.search_terms ? '<p><b>Search for evidence:</b> ' + esc(e.search_terms) + '</p>' : '')
            + '</div>';
        }).join('');
        html += section('Missing Arguments You Should Be Making', extHtml, true, 'report-extra');
      }

      // Impact Weighing
      var iw = parsed.impact_weighing || {};
      if (iw.why_it_matters || iw.how_to_outweigh) {
        var iwHtml = '<div class="report-item">'
          + '<p><b>Is impact weighed?</b> <span class="report-metric report-metric-' + (iw.is_weighed ? 'strong' : 'risk') + '">' + (iw.is_weighed ? 'YES' : 'NO — critical gap') + '</span></p>'
          + (iw.why_it_matters ? '<p><b>Why weighing matters:</b> ' + esc(iw.why_it_matters) + '</p>' : '')
          + (iw.magnitude ? '<p><b>Magnitude:</b> ' + esc(iw.magnitude) + '</p>' : '')
          + (iw.probability ? '<p><b>Probability:</b> ' + esc(iw.probability) + '</p>' : '')
          + (iw.timeframe ? '<p><b>Timeframe:</b> ' + esc(iw.timeframe) + '</p>' : '')
          + (iw.how_to_outweigh ? '<p><b>Say this to outweigh:</b></p>' + quoteBlock(iw.how_to_outweigh) : '')
          + '</div>';
        html += section('Impact Weighing', iwHtml, false);
      }

      // Assumption audit
      var assumeHtml = asArray(parsed.assumption_audit).map(function (a) {
        return '<div class="report-item">'
          + '<p><span class="report-metric report-metric-risk">' + esc(a.type || 'HIDDEN') + '</span></p>'
          + '<p><b>Assumption:</b> ' + esc(a.assumption || '') + '</p>'
          + (a.quote ? quoteBlock(a.quote) : '')
          + (a.if_rejected ? '<p><b>If rejected:</b> ' + esc(a.if_rejected) + '</p>' : '')
          + (a.how_to_defend ? '<p><b>How to defend it:</b> ' + esc(a.how_to_defend) + '</p>' : '')
          + '</div>';
      }).join('') || '<p>No hidden assumptions identified.</p>';
      html += section('Assumption Audit', assumeHtml, false);
    }

    // ── SPEECH mode ──
    else if (mode === 'speech') {
      // Audience Clarity
      var ac = parsed.audience_clarity || {};
      var acHtml = '<div class="report-item">'
        + '<p><b>Main message obvious:</b> ' + (ac.main_message_obvious ? 'Yes' : 'No — fix needed') + '</p>'
        + '<p><b>Context sufficient:</b> ' + (ac.context_sufficient ? 'Yes' : 'No') + '</p>'
        + (ac.level_assessment ? '<p><b>Level:</b> ' + esc(ac.level_assessment) + '</p>' : '')
        + (asArray(ac.confusing_terms).length ? '<p><b>Confusing terms:</b> ' + asArray(ac.confusing_terms).map(esc).join(', ') + '</p>' : '')
        + renderInlineList('Fixes', ac.fixes)
        + '</div>';
      html += section('Audience Clarity Check', acHtml, true);

      // Hook Analysis
      var ha = parsed.hook_analysis || {};
      html += section('Hook Strength', '<div class="report-item"><div class="report-metric-row"><span class="report-metric report-metric-' + (ha.rating === 'STRONG' ? 'strong' : ha.rating === 'MODERATE' ? '' : 'risk') + '">' + esc(ha.rating || 'WEAK') + '</span></div>'
        + quoteBlock(ha.current_hook)
        + '<p>' + esc(ha.assessment || '') + '</p>'
        + (ha.stronger_hook ? '<p><b>Stronger hook:</b></p>' + quoteBlock(ha.stronger_hook) : '')
        + '</div>', true);

      // Delivery Markup
      var dm = asArray(parsed.delivery_markup);
      if (dm.length) {
        var dmHtml = dm.map(function (d) {
          return '<div class="report-item">'
            + '<span class="report-label">Original:</span>' + quoteBlock(d.original_text)
            + '<span class="report-label">With delivery cues:</span>'
            + '<div class="delivery-annotated">' + esc(d.annotated || '') + '</div>'
            + (d.note ? '<p><b>Why:</b> ' + esc(d.note) + '</p>' : '')
            + '</div>';
        }).join('');
        html += section('Delivery Markup', dmHtml, true);
      }

      // Structure
      var sa = parsed.structure_analysis || {};
      if (sa.detected_structure || asArray(sa.structural_gaps).length) {
        var saHtml = '<div class="report-item">'
          + (sa.detected_structure ? '<p><b>Current structure:</b> ' + esc(sa.detected_structure) + '</p>' : '')
          + (sa.recommended_structure ? '<p><b>Recommended:</b> ' + esc(sa.recommended_structure) + '</p>' : '')
          + renderInlineList('Gaps', sa.structural_gaps)
          + '</div>';
        if (asArray(sa.paragraph_map).length) {
          saHtml += asArray(sa.paragraph_map).map(function (p) {
            return '<div class="report-item">'
              + '<p><b>Section ' + (p.paragraph || '') + ':</b> ' + esc(p.job || '') + ' — <span class="report-metric">' + esc(p.assessment || '') + '</span></p>'
              + (p.fix ? '<p>' + esc(p.fix) + '</p>' : '')
              + '</div>';
          }).join('');
        }
        html += section('Structure and Flow', saHtml, true, 'report-structure');
      }

      // Delivery Risks
      var dr = asArray(parsed.delivery_risks);
      if (dr.length) {
        html += section('Delivery Risk Warnings', dr.map(function (d) {
          return '<div class="report-item">' + quoteBlock(d.quote) + '<p><b>Risk:</b> ' + esc(d.risk || '') + '</p><p><b>Fix:</b> ' + esc(d.fix || '') + '</p></div>';
        }).join(''), true);
      }

      // Memorability
      var mc = parsed.memorability_check || {};
      html += section('Memorability Check', '<div class="report-item">'
        + '<p><b>Has memorable moment:</b> ' + (mc.has_memorable_moment ? 'Yes' : 'No — add one') + '</p>'
        + renderInlineList('Found', mc.found)
        + renderInlineList('Missing', mc.missing)
        + (mc.suggested_memorable_line ? '<p><b>Try this memorable line:</b></p>' + quoteBlock(mc.suggested_memorable_line) : '')
        + '</div>', true);

      // Audience Questions
      var aq = asArray(parsed.audience_questions);
      if (aq.length) {
        html += section('Predicted Audience Questions', aq.map(function (q) {
          return '<div class="report-item"><p><span class="report-metric">' + esc(q.type || 'question') + '</span> ' + esc(q.question || '') + '</p><p><b>How to preempt:</b> ' + esc(q.how_to_preempt || '') + '</p></div>';
        }).join(''), false);
      }

      // Visual Aids
      var va = asArray(parsed.visual_aid_suggestions);
      if (va.length) {
        html += section('Visual Aid Suggestions', va.map(function (v) {
          return '<div class="report-item"><p><b>Where:</b> ' + esc(v.where || '') + '</p><p><b>What:</b> ' + esc(v.what || '') + '</p><p><b>Why:</b> ' + esc(v.why || '') + '</p>' + (v.slide_content ? '<p><b>Slide content:</b> ' + esc(v.slide_content) + '</p>' : '') + '</div>';
        }).join(''), false);
      }

      // Call to Action
      var cta = parsed.call_to_action || {};
      html += section('Call to Action', '<div class="report-item">'
        + '<p><b>Present:</b> ' + (cta.present ? 'Yes' : 'No — add one') + '</p>'
        + (cta.current ? quoteBlock(cta.current) : '')
        + (cta.assessment ? '<p>' + esc(cta.assessment) + '</p>' : '')
        + (cta.stronger_ending ? '<p><b>Stronger ending:</b></p>' + quoteBlock(cta.stronger_ending) : '')
        + '</div>', true, 'report-cta');

      // Persuasion Check
      var pc = parsed.persuasion_check || {};
      if (pc.overall) {
        html += section('Persuasion Check', '<div class="report-item">'
          + (pc.emotional_appeal ? '<p><b>Emotional appeal:</b> ' + esc(pc.emotional_appeal) + '</p>' : '')
          + (pc.credibility ? '<p><b>Credibility:</b> ' + esc(pc.credibility) + '</p>' : '')
          + (pc.rhythm_and_flow ? '<p><b>Rhythm and flow:</b> ' + esc(pc.rhythm_and_flow) + '</p>' : '')
          + (pc.overall ? '<p><b>Overall:</b> ' + esc(pc.overall) + '</p>' : '')
          + '</div>', false);
      }
    }

    // ── ESSAY mode ──
    else if (mode === 'essay') {
      // Main point
      var mp = parsed.main_point_check || {};
      html += section('Main Point Check', '<div class="report-item">'
        + (mp.central_idea ? '<p><b>Central idea:</b> ' + esc(mp.central_idea) + '</p>' : '')
        + '<p><b>Clear early enough:</b> ' + (mp.is_clear_early ? 'Yes' : 'No') + '</p>'
        + '<p><b>Every paragraph connects:</b> ' + (mp.every_paragraph_connects ? 'Yes' : 'No') + '</p>'
        + (mp.assessment ? '<p>' + esc(mp.assessment) + '</p>' : '')
        + '</div>', true);

      // Paragraph Map
      var pm = asArray(parsed.paragraph_map);
      if (pm.length) {
        var pmHtml = pm.map(function (p) {
          return '<div class="report-item">'
            + '<div class="report-metric-row"><span class="report-metric">Paragraph ' + esc(String(p.number || '')) + '</span><span class="report-metric ' + (p.has_clear_job ? '' : 'report-metric-risk') + '">' + esc(p.job || 'Unknown job') + '</span></div>'
            + (p.topic_sentence ? quoteBlock(p.topic_sentence) : '')
            + (p.topic_sentence_assessment ? '<p><b>Topic sentence:</b> ' + esc(p.topic_sentence_assessment) + '</p>' : '')
            + (p.assessment ? '<p>' + esc(p.assessment) + '</p>' : '')
            + (p.doing_too_much ? '<p><span class="report-metric report-metric-risk">Doing too much</span></p>' : '')
            + (p.should_move ? '<p><span class="report-metric report-metric-risk">Should move</span></p>' : '')
            + (p.fix ? '<p><b>Fix:</b> ' + esc(p.fix) + '</p>' : '')
            + '</div>';
        }).join('');
        html += section('Paragraph Purpose Map', pmHtml, true, 'report-para-map');
      }

      // Evidence Integration
      var ei = asArray(parsed.evidence_integration);
      if (ei.length) {
        html += section('Evidence Integration', ei.map(function (e) {
          return '<div class="report-item">' + quoteBlock(e.quote)
            + '<p><b>Introduced:</b> ' + (e.is_introduced ? 'Yes' : 'No') + ' | <b>Explained:</b> ' + (e.is_explained ? 'Yes' : 'No') + ' | <b>Connected:</b> ' + (e.is_connected_to_point ? 'Yes' : 'No') + (e.just_dropped_in ? ' | <b>Just dropped in: Yes</b>' : '') + '</p>'
            + (e.fix ? '<p><b>Fix:</b> ' + esc(e.fix) + '</p>' : '')
            + '</div>';
        }).join(''), true);
      }

      // Flow
      var ft = parsed.flow_and_transitions || {};
      html += section('Flow and Transitions', '<div class="report-item">'
        + (ft.assessment ? '<p>' + esc(ft.assessment) + '</p>' : '')
        + renderInlineList('Abrupt jumps', ft.abrupt_jumps)
        + renderInlineList('Repeated transitions', ft.repeated_transitions)
        + renderInlineList('Fixes', ft.fixes)
        + '</div>', true);

      // Redundancy
      var rc2 = parsed.redundancy_check || {};
      if (asArray(rc2.repeated_ideas).length || asArray(rc2.filler_sentences).length) {
        html += section('Redundancy Check', '<div class="report-item">'
          + renderInlineList('Repeated ideas', rc2.repeated_ideas)
          + renderInlineList('Repeated evidence', rc2.repeated_evidence)
          + (asArray(rc2.filler_sentences).length ? '<p><b>Filler sentences:</b></p>' + asArray(rc2.filler_sentences).map(quoteBlock).join('') : '')
          + '</div>', false);
      }

      // Quote analysis
      var qa2 = asArray(parsed.quote_analysis);
      if (qa2.length) {
        html += section('Quote Analysis', qa2.map(function (q) {
          return '<div class="report-item">' + quoteBlock(q.quote)
            + '<p>' + ['Introduced: ' + (q.is_introduced ? 'Yes' : 'No'), 'Explained: ' + (q.is_explained_after ? 'Yes' : 'No'), 'Too long: ' + (q.is_too_long ? 'Yes' : 'No'), 'Supports point: ' + (q.supports_the_point ? 'Yes' : 'No')].join(' | ') + '</p>'
            + (q.fix ? '<p><b>Fix:</b> ' + esc(q.fix) + '</p>' : '')
            + '</div>';
        }).join(''), false);
      }

      // Grammar
      var gs = parsed.grammar_style || {};
      if (gs.sentence_variety || asArray(gs.grammar_errors).length) {
        html += section('Grammar and Style', '<div class="report-item">'
          + renderInlineList('Grammar errors', gs.grammar_errors)
          + (gs.sentence_variety ? '<p><b>Sentence variety:</b> ' + esc(gs.sentence_variety) + '</p>' : '')
          + (gs.word_choice ? '<p><b>Word choice:</b> ' + esc(gs.word_choice) + '</p>' : '')
          + renderInlineList('Passive voice issues', gs.passive_voice_issues)
          + renderInlineList('Repetitive phrasing', gs.repetitive_phrasing)
          + '</div>', false);
      }

      // Conclusion
      var conc = parsed.conclusion_strength || {};
      html += section('Conclusion Strength', '<div class="report-item">'
        + (conc.assessment ? '<p>' + esc(conc.assessment) + '</p>' : '')
        + '<p>' + ['Restates without copying: ' + (conc.restates_without_copying ? 'Yes' : 'No'), 'Explains significance: ' + (conc.explains_why_it_matters ? 'Yes' : 'No'), 'No new evidence: ' + (conc.no_new_evidence ? 'Yes' : 'No'), 'Strong final thought: ' + (conc.strong_final_thought ? 'Yes' : 'No')].join(' | ') + '</p>'
        + (conc.stronger_conclusion ? '<p><b>Stronger closing line:</b></p>' + quoteBlock(conc.stronger_conclusion) : '')
        + '</div>', true);
    }

    // ── COLLEGE ESSAY mode ──
    else if (mode === 'college-essay') {
      // Thesis Pressure Test
      var tpt = parsed.thesis_pressure_test || {};
      html += section('Thesis Pressure Test', '<div class="report-item">' + quoteBlock(tpt.quote)
        + '<p>' + ['Specific: ' + (tpt.is_specific ? 'Yes' : 'No'), 'Arguable: ' + (tpt.is_arguable ? 'Yes' : 'No'), 'Too obvious: ' + (tpt.is_too_obvious ? 'Yes' : 'No'), 'Too broad: ' + (tpt.is_too_broad ? 'Yes' : 'No')].join(' | ') + '</p>'
        + (tpt.assessment ? '<p>' + esc(tpt.assessment) + '</p>' : '')
        + (tpt.stronger_thesis ? '<p><b>More precise thesis:</b></p>' + quoteBlock(tpt.stronger_thesis) : '')
        + '</div>', true, 'report-thesis');

      // Paragraph Architecture
      var pa = asArray(parsed.paragraph_architecture);
      if (pa.length) {
        html += section('Paragraph Architecture', pa.map(function (p) {
          return '<div class="report-item">'
            + '<div class="report-metric-row"><span class="report-metric">¶' + (p.number || '') + '</span><span class="report-metric ' + (p.has_clear_job ? '' : 'report-metric-risk') + '">' + esc(p.job || '') + '</span></div>'
            + (p.topic_sentence ? quoteBlock(p.topic_sentence) : '')
            + (p.doing_two_jobs ? '<p><span class="report-metric report-metric-risk">Doing two jobs</span></p>' : '')
            + (p.needs_more_analysis ? '<p><span class="report-metric report-metric-risk">Needs more analysis after evidence</span></p>' : '')
            + (p.fix ? '<p><b>Fix:</b> ' + esc(p.fix) + '</p>' : '')
            + '</div>';
        }).join(''), true, 'report-para-arch');
      }

      // Evidence/Analysis Balance
      var eab = parsed.evidence_analysis_balance || {};
      html += section('Evidence vs. Analysis Balance', '<div class="report-item">'
        + (eab.analysis_ratio ? '<p><b>' + esc(eab.analysis_ratio) + '</b></p>' : '')
        + (eab.too_much_summary ? '<p><span class="report-metric report-metric-risk">Too much summary</span></p>' : '')
        + (asArray(eab.evidence_without_analysis).length ? '<p><b>Evidence dropped without analysis:</b></p>' + asArray(eab.evidence_without_analysis).map(quoteBlock).join('') : '')
        + (eab.fix ? '<p><b>Fix:</b> ' + esc(eab.fix) + '</p>' : '')
        + '</div>', true);

      // Close Reading Audit
      var cra = asArray(parsed.close_reading_audit);
      if (cra.length) {
        html += section('Close Reading Audit', cra.map(function (cr) {
          return '<div class="report-item">' + quoteBlock(cr.quote)
            + '<p>' + ['Analyzes specific words: ' + (cr.analyzes_specific_words ? 'Yes' : 'No'), 'Explains imagery/tone/diction: ' + (cr.explains_imagery_tone_diction ? 'Yes' : 'No'), 'Just summarizes: ' + (cr.just_summarizes ? 'Yes' : 'No')].join(' | ') + '</p>'
            + (cr.feedback ? '<p><b>What deeper analysis would say:</b> ' + esc(cr.feedback) + '</p>' : '')
            + '</div>';
        }).join(''), true);
      }

      // Counterargument Quality
      var cq = parsed.counterargument_quality || {};
      html += section('Counterargument Integrity', '<div class="report-item">'
        + '<p><b>Has counterargument:</b> ' + (cq.has_counterargument ? 'Yes' : 'No') + ' | <b>Real and strong:</b> ' + (cq.is_real_and_strong ? 'Yes' : 'No') + ' | <b>Fairly represented:</b> ' + (cq.is_fairly_represented ? 'Yes' : 'No') + '</p>'
        + (cq.assessment ? '<p>' + esc(cq.assessment) + '</p>' : '')
        + (cq.better_counterargument ? '<p><b>Better counterargument:</b></p>' + quoteBlock(cq.better_counterargument) : '')
        + '</div>', true);

      // Academic Voice Coach
      var avc = asArray(parsed.academic_voice_coach);
      if (avc.length) {
        html += section('Academic Voice Coach', avc.map(function (a) {
          return '<div class="report-item">' + quoteBlock(a.quote)
            + '<p><b>Issue:</b> ' + esc(a.issue || '') + '</p>'
            + '<p><b>Problem:</b> ' + esc(a.problem || '') + '</p>'
            + (a.suggestion ? '<p><b>Direction:</b> ' + esc(a.suggestion) + '</p>' : '')
            + '</div>';
        }).join(''), false);
      }

      // Professor Lens
      var pl = parsed.professor_lens || {};
      if (pl.end_comment || asArray(pl.margin_comments).length) {
        html += section('Professor Lens', '<div class="report-item">'
          + (asArray(pl.margin_comments).length ? '<p><b>Margin comments:</b></p><ul>' + asArray(pl.margin_comments).map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '')
          + (pl.end_comment ? '<p><b>End comment:</b></p>' + quoteBlock(pl.end_comment) : '')
          + '</div>', true, 'report-professor');
      }

      // Conclusion
      var cc = parsed.conclusion_check || {};
      html += section('Conclusion Strength', '<div class="report-item">'
        + (cc.assessment ? '<p>' + esc(cc.assessment) + '</p>' : '')
        + (cc.stronger_closing ? '<p><b>Stronger closing:</b></p>' + quoteBlock(cc.stronger_closing) : '')
        + '</div>', false);
    }

    // ── RESEARCH PAPER mode ──
    else if (mode === 'research-paper') {
      // Research Question Audit
      var rqa = parsed.research_question_audit || {};
      html += section('Research Question Audit', '<div class="report-item">'
        + (rqa.detected_question ? '<p><b>Detected question:</b> ' + esc(rqa.detected_question) + '</p>' : '')
        + '<p>' + ['Clear: ' + (rqa.is_clear ? 'Yes' : 'No'), 'Answerable: ' + (rqa.is_answerable ? 'Yes' : 'No'), 'Too broad: ' + (rqa.too_broad ? 'Yes' : 'No'), 'Paper answers it: ' + (rqa.paper_answers_it ? 'Yes' : 'No')].join(' | ') + '</p>'
        + (rqa.assessment ? '<p>' + esc(rqa.assessment) + '</p>' : '')
        + (rqa.narrower_question ? '<p><b>More focused question:</b></p>' + quoteBlock(rqa.narrower_question) : '')
        + '</div>', true, 'report-rq');

      // Alignment Map
      var ram = parsed.research_alignment_map || {};
      if (ram.drift_points || !ram.thesis_answers_question) {
        html += section('Research Alignment Map', '<div class="report-item">'
          + '<p>' + ['Thesis answers question: ' + (ram.thesis_answers_question ? 'Yes' : 'No'), 'Sections support thesis: ' + (ram.sections_support_thesis ? 'Yes' : 'No'), 'Conclusion matches evidence: ' + (ram.conclusion_matches_evidence ? 'Yes' : 'No')].join(' | ') + '</p>'
          + renderInlineList('Drift points', ram.drift_points)
          + '</div>', true);
      }

      // Section Architecture
      var sa2 = asArray(parsed.section_architecture);
      if (sa2.length) {
        html += section('Paper Structure Map', sa2.map(function (s) {
          return '<div class="report-item"><div class="report-metric-row"><span class="report-metric ' + (s.present ? '' : 'report-metric-risk') + '">' + esc(s.section || '') + ': ' + (s.present ? 'Present' : 'MISSING') + '</span></div>'
            + (s.assessment ? '<p>' + esc(s.assessment) + '</p>' : '')
            + (s.fix ? '<p><b>Fix:</b> ' + esc(s.fix) + '</p>' : '')
            + '</div>';
        }).join(''), true, 'report-structure');
      }

      // Citation Coverage Map
      var ccm = asArray(parsed.citation_coverage_map);
      if (ccm.length) {
        html += section('Citation Coverage Map', ccm.map(function (c) {
          return '<div class="report-item"><p><b>Claim:</b> ' + esc(c.claim || '') + '</p>'
            + '<p><b>Citation present:</b> ' + (c.citation_present ? 'Yes' : '<span class="report-metric report-metric-risk">NO</span>') + ' | <b>Source strength:</b> ' + esc(c.source_strength || '—') + '</p>'
            + (c.problem ? '<p><b>Problem:</b> ' + esc(c.problem) + '</p>' : '')
            + (c.fix ? '<p><b>Fix:</b> ' + esc(c.fix) + '</p>' : '')
            + '</div>';
        }).join(''), true, 'report-citations');
      }

      // Missing Citation Flags
      var mcf = asArray(parsed.missing_citation_flags);
      if (mcf.length) {
        html += section('Citation Needed Flags', mcf.map(function (f) {
          return '<div class="report-item">' + quoteBlock(f.sentence)
            + '<p><b>Why it needs a citation:</b> ' + esc(f.why || '') + '</p>'
            + (f.needed_source ? '<p><b>Find:</b> ' + esc(f.needed_source) + '</p>' : '')
            + '</div>';
        }).join(''), true);
      }

      // Source Quality Ladder
      var sql2 = asArray(parsed.source_quality_ladder);
      if (sql2.length) {
        html += section('Source Quality Ladder', sql2.map(function (s) {
          var rc3 = s.rating === 'STRONG' ? 'strong' : s.rating === 'NEEDS_REPLACEMENT' ? 'risk' : '';
          return '<div class="report-item"><p><b>' + esc(s.source || '') + '</b> — <span class="report-metric ' + (rc3 ? 'report-metric-' + rc3 : '') + '">' + esc(s.rating || '—') + '</span> (' + esc(s.type || 'unclear') + ')</p>'
            + (s.problem ? '<p>' + esc(s.problem) + '</p>' : '')
            + (s.replacement ? '<p><b>Replace with:</b> ' + esc(s.replacement) + '</p>' : '')
            + '</div>';
        }).join(''), false);
      }

      // Evidence Fit Test
      var eft = asArray(parsed.evidence_fit_test);
      if (eft.length) {
        html += section('Evidence Fit Test', eft.map(function (e) {
          return '<div class="report-item"><p><b>Claim:</b> ' + esc(e.claim || '') + '</p>'
            + '<p><b>Evidence type:</b> ' + esc(e.evidence_type || '') + ' — <span class="report-metric ' + (e.fit === 'POOR' ? 'report-metric-risk' : '') + '">' + esc(e.fit || '—') + '</span></p>'
            + (e.problem ? '<p><b>Problem:</b> ' + esc(e.problem) + '</p>' : '')
            + (e.fix ? '<p><b>Fix:</b> ' + esc(e.fix) + '</p>' : '')
            + '</div>';
        }).join(''), false);
      }

      // Literature Review Audit
      var lra = parsed.literature_review_audit || {};
      if (lra.assessment) {
        html += section('Literature Review Audit', '<div class="report-item">'
          + '<p>' + ['Compares sources: ' + (lra.compares_sources ? 'Yes' : 'No'), 'Groups by theme: ' + (lra.groups_by_theme ? 'Yes' : 'No'), 'Shows disagreement: ' + (lra.shows_disagreement ? 'Yes' : 'No'), 'Identifies gap: ' + (lra.identifies_research_gap ? 'Yes' : 'No')].join(' | ') + '</p>'
          + (lra.assessment ? '<p>' + esc(lra.assessment) + '</p>' : '')
          + (lra.fix ? '<p><b>Fix:</b> ' + esc(lra.fix) + '</p>' : '')
          + '</div>', false);
      }

      // Conclusion Overclaim
      var coc = parsed.conclusion_overclaim_check || {};
      if (coc.assessment) {
        html += section('Conclusion Overclaim Check', '<div class="report-item">'
          + '<p>' + ['Matches evidence: ' + (coc.matches_evidence ? 'Yes' : 'No'), 'Introduces new claims: ' + (coc.introduces_new_claims ? 'Yes' : 'No'), 'Exaggerates: ' + (coc.exaggerates ? 'Yes' : 'No')].join(' | ') + '</p>'
          + (coc.assessment ? '<p>' + esc(coc.assessment) + '</p>' : '')
          + '</div>', false);
      }
    }

    // ── RUBRIC mode ──
    else if (mode === 'rubric') {
      // Criterion-by-criterion
      var crits = asArray(parsed.criterion_scores);
      if (crits.length) {
        var critsHtml = crits.map(function (c) {
          var pct = c.score_possible > 0 ? Math.round(c.score_earned / c.score_possible * 100) : 0;
          return '<div class="report-item rubric-criterion">'
            + '<div class="report-metric-row"><span class="report-metric">' + esc(c.criterion || '') + '</span><span class="report-metric ' + (pct >= 80 ? 'report-metric-strong' : pct < 50 ? 'report-metric-risk' : '') + '">' + esc(String(c.score_earned || 0)) + ' / ' + esc(String(c.score_possible || 0)) + ' points</span></div>'
            + (c.evidence_from_text ? quoteBlock(c.evidence_from_text) : '')
            + (c.reason ? '<p>' + esc(c.reason) + '</p>' : '')
            + (c.what_is_missing ? '<p><b>Missing:</b> ' + esc(c.what_is_missing) + '</p>' : '')
            + (c.how_to_improve ? '<p><b>To improve:</b> ' + esc(c.how_to_improve) + '</p>' : '')
            + '</div>';
        }).join('');
        html += section('Criterion-by-Criterion Scores', critsHtml, true, 'report-rubric');
      }

      // Teacher Comment
      if (parsed.teacher_comment) {
        html += section('Teacher Comment', '<div class="report-item teacher-comment"><p>' + esc(parsed.teacher_comment) + '</p></div>', true);
      }

      // Point Recovery Plan
      var prp = asArray(parsed.point_recovery_plan);
      if (prp.length) {
        html += section('Point Recovery Plan', '<ol class="report-recovery-list">' + prp.map(function (p) {
          return '<li><b>' + esc(p.action || '') + '</b> (+' + esc(String(p.points_possible || 0)) + ' possible points)<br><span>' + esc(p.how_to_do_it || '') + '</span></li>';
        }).join('') + '</ol>', true, 'report-recovery');
      }

      html += '<p class="rubric-note">' + esc(parsed.note || 'This grade is based only on the pasted rubric.') + '</p>';
    }

    // ── MODEL UN mode ──
    else if (mode === 'model-un') {
      // Delegate Brief
      var db = parsed.delegate_brief || {};
      html += section('Delegate Brief', '<div class="report-item">'
        + (db.country_stance ? '<p><b>Country stance:</b> ' + esc(db.country_stance) + '</p>' : '')
        + renderInlineList('National interests', db.national_interests)
        + renderInlineList('Red lines (would never support)', db.red_lines)
        + renderInlineList('Likely allies', db.likely_allies)
        + renderInlineList('Likely opponents', db.likely_opponents)
        + (db.past_un_actions ? '<p><b>Past UN actions:</b> ' + esc(db.past_un_actions) + '</p>' : '')
        + renderInlineList('Useful facts to cite', db.useful_facts)
        + '</div>', true, 'report-brief');

      // Writing Audit
      var wa = parsed.writing_audit || {};
      html += section('Writing Audit', '<div class="report-item">'
        + '<p>' + ['Explains the issue: ' + (wa.explains_the_issue ? 'Yes' : 'No'), 'Matches country: ' + (wa.matches_country_position ? 'Yes' : '<b>No — critical</b>'), 'Past UN action: ' + (wa.includes_past_un_action ? 'Yes' : 'No'), 'Country policy: ' + (wa.includes_country_policy ? 'Yes' : 'No'), 'Realistic solutions: ' + (wa.proposes_realistic_solutions ? 'Yes' : 'No'), 'Too generic: ' + (wa.too_generic ? '<b>Yes</b>' : 'No')].join(' | ') + '</p>'
        + (wa.assessment ? '<p>' + esc(wa.assessment) + '</p>' : '')
        + '</div>', true);

      // Strategy Map
      var sm = parsed.strategy_map || {};
      if (asArray(sm.best_caucus_topics).length) {
        var stHtml = asArray(sm.best_caucus_topics).map(function (t) {
          return '<div class="report-item"><p><b>' + esc(t.topic || '') + '</b></p>'
            + (t.why_it_helps ? '<p>' + esc(t.why_it_helps) + '</p>' : '')
            + (t.opening_line ? '<p><b>Opening line:</b></p>' + quoteBlock(t.opening_line) : '')
            + renderInlineList('Countries supporting', t.countries_supporting)
            + renderInlineList('Countries opposing', t.countries_opposing)
            + '</div>';
        }).join('');
        html += section('Caucus Strategy', stHtml, true, 'report-strategy');
      }

      if (sm.bloc_strategy || sm.negotiation_approach) {
        html += section('Negotiation and Bloc Strategy', '<div class="report-item">'
          + (sm.bloc_strategy ? '<p><b>Bloc:</b> ' + esc(sm.bloc_strategy) + '</p>' : '')
          + (sm.negotiation_approach ? '<p><b>Approach:</b> ' + esc(sm.negotiation_approach) + '</p>' : '')
          + renderInlineList('Talk to first', sm.countries_to_talk_to_first)
          + renderInlineList('Avoid saying', sm.what_to_avoid_saying)
          + (sm.compromise_to_offer ? '<p><b>Compromise to offer:</b> ' + esc(sm.compromise_to_offer) + '</p>' : '')
          + '</div>', false);
      }

      // Resolution Clauses
      var rc4 = asArray(parsed.resolution_clauses);
      if (rc4.length) {
        html += section('Resolution Clauses', rc4.map(function (r) {
          return '<div class="report-item">'
            + quoteBlock(r.operative_clause)
            + '<p>' + ['Realistic: ' + (r.is_realistic ? 'Yes' : 'No'), 'Too vague: ' + (r.too_vague ? 'Yes' : 'No'), 'Sovereignty concern: ' + (r.sovereignty_concern ? 'Yes' : 'No'), 'Needs funding: ' + (r.needs_funding ? 'Yes' : 'No')].join(' | ') + '</p>'
            + (r.assessment ? '<p>' + esc(r.assessment) + '</p>' : '')
            + '</div>';
        }).join(''), true, 'report-clauses');
      }

      // Speech Coach
      var sc2 = parsed.speech_coach || {};
      if (sc2.delivery_notes) {
        html += section('Speech Coach', '<div class="report-item">'
          + (sc2.delivery_notes ? '<p><b>Delivery notes:</b> ' + esc(sc2.delivery_notes) + '</p>' : '')
          + renderInlineList('Questions delegates will ask', sc2.questions_delegates_will_ask)
          + renderInlineList('Responses to attacks', sc2.responses_to_attacks)
          + (sc2.fit_to_time ? '<p><b>Time fit:</b> ' + esc(sc2.fit_to_time) + '</p>' : '')
          + '</div>', false);
      }

      // Source Pack
      var sp = asArray(parsed.source_pack);
      if (sp.length) {
        html += section('Source Pack', sp.map(function (s) {
          return '<div class="report-item"><p><b>Claim:</b> ' + esc(s.claim || '') + '</p>'
            + '<p><b>Source type:</b> ' + esc(s.source_type || '') + '</p>'
            + (s.search_terms ? '<p><b>Search:</b> ' + esc(s.search_terms) + '</p>' : '')
            + '</div>';
        }).join(''), false);
      }

      // Policy Accuracy Check
      var pac = parsed.policy_accuracy_check || {};
      if (asArray(pac.red_flags).length || !pac.realistic_for_country) {
        html += section('Policy Accuracy Check', '<div class="report-item">'
          + '<p><b>Realistic for country:</b> ' + (pac.realistic_for_country ? 'Yes' : '<span class="report-metric report-metric-risk">No — flag</span>') + '</p>'
          + '<p><b>Foreign policy consistent:</b> ' + (pac.foreign_policy_consistent ? 'Yes' : 'No') + '</p>'
          + renderInlineList('Red flags', pac.red_flags)
          + '</div>', true);
      }
    }

    return html;
  }

  function maybeShowPostAnalysisSurvey() {
    if (postAnalysisSurveyShown) return;
    try {
      if (localStorage.getItem('fracture_post_analysis_survey')) return;
    } catch (_) {}
    const showPanel = function () {
      postAnalysisSurveyShown = true;
      window.removeEventListener('scroll', onScroll);
      const panel = document.createElement('aside');
      panel.className = 'post-analysis-survey';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Fracture report feedback');
      panel.innerHTML = ''
        + '<button class="survey-close" type="button" aria-label="Dismiss feedback">x</button>'
        + '<div class="panel-title">Quick feedback</div>'
        + '<p>Was this report useful enough to revise from?</p>'
        + '<div class="survey-score" aria-label="Rating">'
        + '<button type="button" data-score="1">1</button><button type="button" data-score="2">2</button><button type="button" data-score="3">3</button><button type="button" data-score="4">4</button><button type="button" data-score="5">5</button>'
        + '</div>'
        + '<textarea placeholder="Optional: what should Fracture explain better?"></textarea>'
        + '<button class="btn-primary survey-submit" type="button">Save Feedback</button>';
      document.body.appendChild(panel);
      let selectedScore = '';
      panel.querySelector('.survey-close').addEventListener('click', function () { panel.remove(); });
      panel.querySelectorAll('[data-score]').forEach(function (button) {
        button.addEventListener('click', function () {
          selectedScore = button.getAttribute('data-score');
          panel.querySelectorAll('[data-score]').forEach(function (candidate) { candidate.classList.toggle('active', candidate === button); });
        });
      });
      panel.querySelector('.survey-submit').addEventListener('click', function () {
        try {
          localStorage.setItem('fracture_post_analysis_survey', JSON.stringify({
            score: selectedScore,
            note: panel.querySelector('textarea').value.trim(),
            createdAt: new Date().toISOString()
          }));
        } catch (_) {}
        panel.remove();
        if (statusDetail) statusDetail.textContent = 'Thanks. Feedback saved in this browser.';
      });
    };
    const onScroll = function () {
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 520;
      if (nearBottom) showPanel();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.setTimeout(onScroll, 1200);
  }

  // ── Core analysis ──────────────────────────────────────────────────────────
  async function runAnalysis() {
    const essay = essayInput.value.trim();
    if (!essay) { setStatus('error', 'Paste an argument before using Fracture.'); return; }

    // Auth gate: require sign-in or guest access before running
    const isAuthed = window.FractureAuth &&
      typeof window.FractureAuth.getUser === 'function' &&
      await window.FractureAuth.getUser();
    const isGuest = window.FractureAuth &&
      typeof window.FractureAuth.hasGuestAccess === 'function' &&
      window.FractureAuth.hasGuestAccess();
    if (!isAuthed && !isGuest) {
      if (window.FractureAuth && typeof window.FractureAuth.showAuthModal === 'function') {
        window.FractureAuth.showAuthModal(false,
          'Sign in to run Fracture and save your report history, or continue as a guest to start immediately.');
      }
      return;
    }

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
            if (json.fracture_report_start) {
              startFinalAuditStream();
              continue;
            }
            if (json.fracture_report_delta) {
              appendFinalAuditDelta(json.fracture_report_delta);
              continue;
            }
            if (json.fracture_report_done) {
              finishFinalAuditStream();
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
  function updateReportActions(enabled) {
    [exportBtn, shareBtn, copyReportBtn, downloadTextBtn, printReportBtn].forEach(function (button) {
      if (button) button.disabled = !enabled;
    });
  }

  function copyTextWithFallback(text) {
    if (!text) return Promise.reject(new Error('No report text is ready yet.'));
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  function copyReadableReport() {
    const text = readableReportText || (parsedAudit ? buildReadableReportText(parsedAudit) : '');
    copyTextWithFallback(text).then(function () {
      if (statusDetail) statusDetail.textContent = 'Readable report copied.';
    }).catch(function () {
      if (statusDetail) statusDetail.textContent = 'Copy failed. Try downloading the text report instead.';
    });
  }

  function downloadReadableReport() {
    const text = readableReportText || (parsedAudit ? buildReadableReportText(parsedAudit) : '');
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fracture-studio-report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (statusDetail) statusDetail.textContent = 'Readable text report downloaded.';
  }

  function printReadableReport() {
    if (!parsedAudit) return;
    window.print();
  }

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
    if (!parsedAudit) return;
    persistActiveWorkspace();
    copyTextWithFallback(location.origin + location.pathname)
      .then(function () { if (statusDetail) statusDetail.textContent = 'Studio link copied. Saved reports reopen from Past Work.'; })
      .catch(function () { if (statusDetail) statusDetail.textContent = 'Share link could not be copied. Use Past Work or export the PDF.'; });
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
      if (typeof parsed.overall_score === 'number' && scoreSummary) scoreSummary.hidden = false;
      renderReport(parsed);
      updateReportActions(true);
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
    if (document.title === 'Report ready - Fracture Studio') document.title = 'Fracture Studio';
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
  if (copyReportBtn) copyReportBtn.addEventListener('click', copyReadableReport);
  if (downloadTextBtn) downloadTextBtn.addEventListener('click', downloadReadableReport);
  if (printReportBtn) printReportBtn.addEventListener('click', printReadableReport);
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
  document.addEventListener('keydown', function (event) {
    if (!parsedAudit) return;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copyReadableReport();
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  updateCharCount();
  setStatus('idle', 'Waiting for an argument.');
  setProgress(0, 'Ready when you are');
  if (skeleton) skeleton.classList.add('hidden');
  maybeLoadSharedAnalysis();
  window.setTimeout(maybeLoadSavedProject, 350);
})();
