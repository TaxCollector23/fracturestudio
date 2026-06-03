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
  const formatHint      = document.getElementById('formatHint');
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
    'Finding the load-bearing point',
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


  function normalizeAnalysisFormat(value) {
    const cleaned = String(value || (analysisFormat ? analysisFormat.value : 'not-chosen')).toLowerCase();
    if (cleaned === 'speech' || cleaned === 'presentation') return 'speech';
    if (cleaned === 'debate' || cleaned === 'debate-case') return 'debate-case';
    if (cleaned === 'paragraph') return 'paragraph';
    if (cleaned === 'essay') return 'essay';
    if (cleaned === 'policy') return 'policy';
    if (cleaned === 'source-review') return 'source-review';
    return 'not-chosen';
  }

  function currentMode() {
    return normalizeAnalysisFormat(analysisFormat ? analysisFormat.value : 'not-chosen');
  }

  function modeLabels(mode) {
    const normalized = normalizeAnalysisFormat(mode);
    if (normalized === 'speech') {
      return {
        name: 'Speech',
        hint: 'Speech mode grades hook, audience clarity, pacing, signposting, spoken flow, listener objections, and the final call to action.',
        pressureTitle: 'Audience Friction Point',
        pressureShort: 'Audience friction',
        pressureQuote: 'Moment that may lose the audience:',
        pressureWhy: 'Why listeners may lose the thread:',
        pressureMetricA: 'Audience dependencies',
        pressureMetricB: 'Audience survival chance',
        pressureDepends: 'What the audience must understand',
        pressureAttack: 'Likely listener objection:',
        pressureDefense: 'Best clarity or delivery repair:',
        graphTitle: 'Audience Friction Point'
      };
    }
    if (normalized === 'debate-case') {
      return {
        name: 'Debate Case',
        hint: 'Debate mode grades contentions, warrants, links, impacts, weighing, crossfire risk, burden of proof, and opponent attacks.',
        pressureTitle: 'Collapse Point',
        pressureShort: 'Collapse point',
        pressureQuote: 'Load-bearing contention or warrant:',
        pressureWhy: 'Why it can collapse:',
        pressureMetricA: 'Dependent claims',
        pressureMetricB: 'Survival chance',
        pressureDepends: 'What depends on it',
        pressureAttack: 'Strongest opponent attack:',
        pressureDefense: 'Strongest defense:',
        graphTitle: 'Collapse Point'
      };
    }
    if (normalized === 'essay') {
      return {
        name: 'Essay',
        hint: 'Essay mode grades thesis precision, paragraph jobs, evidence integration, warrants, counterclaim handling, and academic flow.',
        pressureTitle: 'Thesis Pressure Point',
        pressureShort: 'Thesis pressure point',
        pressureQuote: 'Load-bearing thesis sentence:',
        pressureWhy: 'Why the essay weakens here:',
        pressureMetricA: 'Dependent paragraphs',
        pressureMetricB: 'Essay survival chance',
        pressureDepends: 'What depends on it',
        pressureAttack: 'Likely reader objection:',
        pressureDefense: 'Best essay repair:',
        graphTitle: 'Thesis Pressure Point'
      };
    }
    if (normalized === 'paragraph') {
      return {
        name: 'Paragraph',
        hint: 'Paragraph mode grades one topic claim, sentence order, evidence, warrant, and the final link back to the point. It does not expect a full essay.',
        pressureTitle: 'Paragraph Hinge Sentence',
        pressureShort: 'Paragraph hinge',
        pressureQuote: 'Hinge sentence:',
        pressureWhy: 'Why the paragraph weakens here:',
        pressureMetricA: 'Dependent sentences',
        pressureMetricB: 'Paragraph survival chance',
        pressureDepends: 'What depends on it',
        pressureAttack: 'Likely reader objection:',
        pressureDefense: 'Best paragraph repair:',
        graphTitle: 'Paragraph Hinge'
      };
    }
    if (normalized === 'policy') {
      return {
        name: 'Policy',
        hint: 'Policy mode grades problem definition, mechanism, feasibility, stakeholders, tradeoffs, alternatives, and solvency.',
        pressureTitle: 'Solvency Hinge',
        pressureShort: 'Solvency hinge',
        pressureQuote: 'Load-bearing mechanism:',
        pressureWhy: 'Why the policy weakens here:',
        pressureMetricA: 'Dependent impacts',
        pressureMetricB: 'Solvency survival chance',
        pressureDepends: 'What depends on it',
        pressureAttack: 'Likely feasibility objection:',
        pressureDefense: 'Best policy repair:',
        graphTitle: 'Solvency Hinge'
      };
    }
    return {
      name: 'General',
      hint: 'Choose a type so Fracture uses a different rubric for speech, debate, essay, or paragraph writing.',
      pressureTitle: 'Load-Bearing Point',
      pressureShort: 'Load-bearing point',
      pressureQuote: 'Load-bearing sentence:',
      pressureWhy: 'Why it matters:',
      pressureMetricA: 'Dependencies',
      pressureMetricB: 'Survival chance',
      pressureDepends: 'What depends on it',
      pressureAttack: 'Likely objection:',
      pressureDefense: 'Best repair:',
      graphTitle: 'Load-Bearing Point'
    };
  }


  function modeSafeText(value) {
    const text = String(value || '');
    if (currentMode() !== 'speech') return text;
    return text
      .replace(/collapse point/gi, 'audience friction point')
      .replace(/collapses/gi, 'loses force')
      .replace(/collapse/gi, 'lose force');
  }

  function updateFormatHint() {
    const labels = modeLabels(currentMode());
    if (formatHint) formatHint.textContent = labels.hint;
    if (essayInput) essayInput.setAttribute('data-mode', currentMode());
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
      + '<span>Fracture is writing your ' + esc(modeLabels(currentMode()).name.toLowerCase()) + ' audit' + (score ? ' · Score ' + esc(score) + '/100' : '') + '</span>'
      + '</div>';

    html += streamingReportSection('Verdict in progress', verdict);

    problems.forEach(function (problem, index) {
      const details = [
        whyItMatters[index] ? 'Why it matters: ' + whyItMatters[index] : '',
        exactFixes[index] ? 'What to change: ' + exactFixes[index] : ''
      ].filter(Boolean).join(' ');
      html += streamingReportSection('Priority ' + (index + 1), problem + (details ? ' ' + details : ''));
    });

    const labels = modeLabels(currentMode());
    html += streamingReportSection(labels.pressureShort, modeSafeText(collapse));
    html += streamingReportSection(labels.pressureAttack.replace(':', ''), modeSafeText(opponentAttack));

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
    if (score >= 11) return 'Argument breaks under pressure';
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
    const labels = modeLabels(currentMode());
    lines.push(labels.pressureTitle);
    const collapse = parsed.collapse_point || {};
    lines.push(firstText(collapse.quote, 'No single load-bearing point detected.'));
    if (collapse.why_it_collapses) lines.push(labels.pressureWhy + ' ' + modeSafeText(collapse.why_it_collapses));
    if (collapse.strongest_attack || collapse.opponent_attack) lines.push(labels.pressureAttack + ' ' + modeSafeText(firstText(collapse.strongest_attack, collapse.opponent_attack)));
    if (collapse.strongest_defense || collapse.reinforcement) lines.push(labels.pressureDefense + ' ' + modeSafeText(firstText(collapse.strongest_defense, collapse.reinforcement)));
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
    const labels = modeLabels(currentMode());
    const collapse = parsed.collapse_point || {};
    const fallbackClaim = (((parsed.argument_strength || {}).claims) || [])[0] || {};
    const quote = firstText(collapse.quote, fallbackClaim.quote, ((parsed.argument_strength || {}).thesis || {}).quote);

    return '<div class="report-item">'
         + '<span class="report-label">' + esc(labels.pressureQuote) + '</span>'
         + quoteBlock(quote)
         + '<p><b>' + esc(labels.pressureWhy) + '</b> ' + esc(modeSafeText(firstText(collapse.why_it_collapses, fallbackClaim.diagnosis, 'This point carries more work than it currently supports.'))) + '</p>'
         + '<div class="report-metric-row">'
         + '<span class="report-metric">' + esc(labels.pressureMetricA) + ': ' + esc(String(collapse.dependency_count ?? 0)) + '</span>'
         + '<span class="report-metric report-metric-risk">' + esc(labels.pressureMetricB) + ': ' + esc(String(collapse.survival_probability ?? '—')) + '%</span>'
         + '</div>'
         + renderInlineList(labels.pressureDepends, collapse.affected_claims)
         + '<p><b>' + esc(labels.pressureAttack) + '</b> ' + esc(modeSafeText(firstText(collapse.strongest_attack, collapse.opponent_attack, fallbackClaim.opponent_exploit, 'A skeptical reader will ask what proves this exact point.'))) + '</p>'
         + '<p><b>' + esc(labels.pressureDefense) + '</b> ' + esc(modeSafeText(firstText(collapse.strongest_defense, collapse.reinforcement, fallbackClaim.fix, 'State the warrant directly, narrow the claim, and support it with the most relevant evidence.'))) + '</p>'
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
    const labels = modeLabels(currentMode());
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
        + '<div class="collapse-card" role="button" tabindex="0" data-chat-point="' + dataPoint(firstText(collapse.quote, thesis.quote)) + '" title="Select this pressure point for Fracture Chat">'
    + '<div class="note-title">' + esc(labels.graphTitle) + '</div>'
    + '<p>' + esc(truncateText(firstText(collapse.quote, thesis.quote, 'The most load-bearing claim is not clear yet.'), 150)) + '</p>'
    + '<small>' + esc(truncateText(modeSafeText(firstText(collapse.why_it_collapses, "This point carries the draft's main pressure.")), 170)) + '</small>'
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
    if (!window.FractureAuth || typeof window.FractureAuth.getPreferences !== 'function') {
      return format ? { analysisFormat: format } : null;
    }
    try {
      return Object.assign({}, await window.FractureAuth.getPreferences(), { analysisFormat: format });
    } catch (_) {
      return format ? { analysisFormat: format } : null;
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
    c.innerHTML =
      section('Verdict and Score', verdictSection, true, 'report-verdict') +
      section('Score Breakdown', scoreSection, true) +
      section('Priority Fixes', renderPriorityFixes(parsed), true, 'report-priorities') +
      section(modeLabels(currentMode()).pressureTitle, renderCollapsePoint(parsed), true) +
      section('How the Argument Hangs Together', renderDependencyGraph(parsed), true) +
      section('Thesis Analysis', thesisSection, true) +
      section('Claim-by-Claim Analysis', claimsSection, true, 'report-claims') +
      section('Assumption Audit', assumptionsSection, true) +
      section('Logical Fallacies', fallaciesSection, true) +
      section('Counterarguments', countersSection, true, 'report-attacks') +
      section('Attack Tree and Crossfire Questions', renderAttackTree(parsed), true) +
      section('Source Claims to Check', renderTruthAudit(parsed), true) +
      section('Alternative Solutions Test', renderAlternatives(parsed), true) +
      section('Rhetorical Analysis', rhetoricSection, true) +
      section('Make It Stronger: Rewrite Suggestions', rewritesSection, true, 'report-rewrites');

    renderArgumentGraph(parsed);
    mountSourceVerification();
    updateReportActions(true);
    requestAnimationFrame(function () { c.classList.add('visible'); });
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
  if (analysisFormat) analysisFormat.addEventListener('change', updateFormatHint);
  updateFormatHint();

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
