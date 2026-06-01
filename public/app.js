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
  const statusDot       = document.getElementById('statusDot');
  const statusLabel     = document.getElementById('statusLabel');
  const statusDetail    = document.getElementById('statusDetail');
  const progressNote    = document.getElementById('progressNote');
  const progressPill    = document.getElementById('progressPill');
  const progressBar     = document.getElementById('progressBar');
  const liveAuditStream = document.getElementById('liveAuditStream');
  const liveAuditStatus = document.getElementById('liveAuditStatus');
  const liveAuditText   = document.getElementById('liveAuditText');
  const jsonOutput      = document.getElementById('jsonOutput');
  const jsonError       = document.getElementById('jsonError');
  const scorePill       = document.getElementById('scorePill');
  const copyBtn         = document.getElementById('copyBtn');
  const exportBtn       = document.getElementById('exportBtn');
  const shareBtn        = document.getElementById('shareBtn');
  const reportContainer = document.getElementById('reportContainer');
  const argumentGraph   = document.getElementById('argumentGraph');
  const outputPanel     = document.getElementById('outputPanel');
  const skeleton        = document.getElementById('skeleton');
  const rebuttalInput   = document.getElementById('rebuttalInput');
  const rebuttalBtn     = document.getElementById('rebuttalBtn');
  const rebuttalStatus  = document.getElementById('rebuttalStatus');
  const rebuttalProgress = document.getElementById('rebuttalProgress');
  const rebuttalOutput  = document.getElementById('rebuttalOutput');
  const chatInput       = document.getElementById('chatInput');
  const chatBtn         = document.getElementById('chatBtn');
  const chatStatus      = document.getElementById('chatStatus');
  const chatProgress    = document.getElementById('chatProgress');
  const chatOutput      = document.getElementById('chatOutput');
  const chatSelectedPoint = document.getElementById('chatSelectedPoint');
  const fractureChatCard = document.getElementById('fractureChatCard');

  if (!essayInput) return; // Not on studio page

  // ── State ──────────────────────────────────────────────────────────────────
  let rawJsonText   = '';
  let parsedAudit   = null;
  let auditRendered = false;
  let isStreaming   = false;
  let progress      = 0;
  let progressTimer = null;
  let pacingIndex   = 0;
  let sourceVerifier = null;
  let sourceVerificationData = null;
  let autoSaveInFlight = false;
  let selectedChatPoint = '';

  const STORAGE_KEY_ESSAY = 'fracture_studio_last_essay';
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
    if (progressBar)  progressBar.style.width  = progress + '%';
    if (progressNote && message) progressNote.textContent = message;
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
    auditRendered = false;
    sourceVerifier = null;
    sourceVerificationData = null;
    if (jsonOutput) jsonOutput.textContent = '';
    if (liveAuditText) liveAuditText.textContent = '';
    if (liveAuditStream) liveAuditStream.classList.add('hidden');
    if (liveAuditStatus) liveAuditStatus.textContent = 'Fracture is writing';
    if (jsonError)  { jsonError.classList.add('hidden'); jsonError.textContent = ''; }
    if (scorePill)  scorePill.textContent = '—';
    if (copyBtn)    copyBtn.disabled  = true;
    if (exportBtn)  exportBtn.disabled = true;
    if (shareBtn)   shareBtn.disabled  = true;
    if (reportContainer) { reportContainer.innerHTML = ''; reportContainer.classList.remove('visible'); }
    if (outputPanel) outputPanel.hidden = true;
    resetArgumentGraph();
    if (skeleton)   skeleton.classList.add('hidden');
    setProgress(0, 'Ready when you are');
  }

  function setBtns(disabled) {
    [analyzeBtn, clearBtn, saveBtn, loadBtn].forEach(function (b) {
      if (b) b.disabled = disabled;
    });
  }

  function appendLiveAuditDelta(delta) {
    if (!delta || !liveAuditText || !liveAuditStream) return;
    liveAuditStream.classList.remove('hidden');
    liveAuditStream.open = true;
    liveAuditText.textContent += delta;
    liveAuditText.scrollTop = liveAuditText.scrollHeight;
  }

  function completeLiveAuditStream() {
    if (!liveAuditText || !liveAuditText.textContent.trim()) return;
    if (liveAuditStatus) liveAuditStatus.textContent = 'Report stream complete';
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
           + '<span class="report-label">Exact Text:</span>'
           + quoteBlock(fix.quote)
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
         + '<p><b>Opponent attack:</b> ' + esc(firstText(collapse.opponent_attack, fallbackClaim.opponent_exploit, 'A strong opponent will ask what proves this exact point.')) + '</p>'
         + '<p><b>How to reinforce:</b> ' + esc(firstText(collapse.reinforcement, fallbackClaim.fix, 'Add direct evidence, a warrant sentence, and a qualifier that survives counterexamples.')) + '</p>'
         + '</div>';
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
    sourceVerifier = null;
    argumentGraph.innerHTML = '';
    argumentGraph.hidden = true;
  }

  function renderArgumentGraph(parsed) {
    if (!argumentGraph) return;
    sourceVerifier = null;

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
        + '<div class="graph-node claim-node ' + rating + '" data-chat-point="' + dataPoint(claim.quote) + '" title="Select this claim for Fracture Chat">'
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
        + '<div class="collapse-card" data-chat-point="' + dataPoint(firstText(collapse.quote, thesis.quote)) + '" title="Select this collapse point for Fracture Chat">'
    + '<div class="note-title">Collapse Point</div>'
    + '<p>' + esc(truncateText(firstText(collapse.quote, thesis.quote, 'The most load-bearing claim is not clear yet.'), 150)) + '</p>'
    + '<small>' + esc(truncateText(firstText(collapse.why_it_collapses, 'If this point is unsupported, the whole argument loses force.'), 170)) + '</small>'
    + '</div>'
    + '</div>'
    + '<div class="graph-spine"><span></span><span></span><span></span></div>'
    + '<div class="graph-rows">' + mapRows + '</div>'
    + '</div>';
    argumentGraph.hidden = false;
  }

  function mountSourceVerification() {
    if (!argumentGraph || !window.FractureSources || sourceVerifier) return null;
    try {
      sourceVerifier = window.FractureSources.attach({
        targetSelector: argumentGraph,
        getEssay: function () { return essayInput.value.trim(); },
        getAudit: function () { return parsedAudit; }
      });
      return sourceVerifier;
    } catch (_) {
      sourceVerifier = null;
      return null;
    }
  }

  async function runSourceVerification() {
    if (!essayInput.value.trim() || !parsedAudit || !window.FractureSources) return null;
    const verifier = mountSourceVerification();
    if (!verifier || typeof verifier.verify !== 'function') return null;

    try {
      if (statusDetail) statusDetail.textContent = 'Checking sources and building Works Cited.';
      sourceVerificationData = await verifier.verify();
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

    try { localStorage.setItem(STORAGE_KEY_ESSAY, essay); } catch (_) {}

    if (!window.FractureAuth || typeof window.FractureAuth.saveProject !== 'function') {
      if (manual && statusDetail) statusDetail.textContent = 'Draft saved locally.';
      return null;
    }

    if (!manual && autoSaveInFlight) return null;
    autoSaveInFlight = true;
    try {
      const payload = {
        audit: parsedAudit || null,
        sources: sourceVerificationData || null,
        saved_at: new Date().toISOString()
      };
      const saved = await window.FractureAuth.saveProject(essay, payload);
      if (manual && statusDetail) {
        statusDetail.textContent = saved && saved.mode === 'local'
          ? 'Draft saved locally.'
          : 'Draft saved to your work history.';
      }
      return saved;
    } catch (_) {
      if (manual && statusDetail) statusDetail.textContent = 'Draft saved locally.';
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
    if (typeof audit.overall_score === 'number' && scorePill) {
      scorePill.textContent = String(audit.overall_score);
    }
    if (!auditRendered) {
      renderReport(audit);
      auditRendered = true;
    }
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

    button.disabled = true;
    output.textContent = '';
    setToolProgress(options.progress, options.status, 4, 'Connecting');

    try {
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body())
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
            if (event.fracture_text_delta) output.textContent += event.fracture_text_delta;
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
    } catch (err) {
      output.textContent = 'This request could not finish. ' + (err && err.message ? err.message : String(err));
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

  function runRebuttal() {
    return streamPlainTextTool({
      endpoint: '/api/rebuttal',
      input: rebuttalInput,
      button: rebuttalBtn,
      output: rebuttalOutput,
      progress: rebuttalProgress,
      status: rebuttalStatus,
      body: function () {
        return { argument: rebuttalInput.value.trim(), context: essayInput.value.trim() };
      }
    });
  }

  function runChat() {
    return streamPlainTextTool({
      endpoint: '/api/chat',
      input: chatInput,
      button: chatBtn,
      output: chatOutput,
      progress: chatProgress,
      status: chatStatus,
      body: function () {
        return {
          message: chatInput.value.trim(),
          draft: essayInput.value.trim(),
          report: parsedAudit,
          selectedPoint: selectedChatPoint
        };
      }
    });
  }

  function finalizeJsonTextFromAudit() {
    if (!parsedAudit) return false;
    try {
      JSON.parse(rawJsonText);
      return true;
    } catch (_) {
      rawJsonText = JSON.stringify(parsedAudit, null, 2);
      if (jsonOutput) jsonOutput.textContent = rawJsonText;
      return true;
    }
  }

  // ── Report renderer ────────────────────────────────────────────────────────
  function renderReport(parsed) {
    const c = reportContainer;
    if (outputPanel) outputPanel.hidden = false;
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

    const scoreSection =
      '<p>' + esc(parsed.verdict || '') + '</p>'
    + '<p><span class="report-label">Coaching Note:</span> ' + esc(parsed.coaching_note || '') + '</p>'
    + '<div class="score-grid">'
    + '<div class="score-chip">Argument Strength<span>' + (scores.argument_strength ?? '—') + '/25</span></div>'
    + '<div class="score-chip">Assumption Audit<span>' + (scores.assumption_audit ?? '—') + '/25</span></div>'
    + '<div class="score-chip">Logic<span>' + (scores.logic ?? '—') + '/25</span></div>'
    + '<div class="score-chip">Rhetoric<span>' + (scores.rhetoric ?? '—') + '/25</span></div>'
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
           + '<span class="report-label">Dependent Claim:</span>'
           + quoteBlock(a.quote)
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
           + '<p><b>Steelman:</b> ' + esc(ct.steelman || '') + '</p>'
           + '<span class="report-label">Targets:</span>'
           + quoteBlock(ct.targets)
           + '<p><b>Damage:</b> ' + esc(ct.damage || '') + '</p>'
           + '<p><b>Suggested Rebuttal:</b> ' + esc(ct.suggested_rebuttal || '') + '</p>'
           + '</div>';
    }).join('') || '<p>No counter-arguments generated.</p>';

    const rhet = parsed.rhetorical_analysis || {};
    const rhetoricSection =
      '<p><b>Opening Hook:</b> ' + esc(rhet.opening_hook || '') + '</p>'
    + '<p><b>Logical Flow:</b> ' + esc(rhet.logical_flow || '') + '</p>'
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
      section('Thesis Analysis', thesisSection, true) +
      section('Claim-by-Claim Analysis', claimsSection, true) +
      section('Assumption Audit', assumptionsSection, true) +
      section('Logical Fallacies', fallaciesSection, true) +
      section('Counter-Arguments', countersSection, true) +
      section('Rhetorical Analysis', rhetoricSection, true) +
      section('Rewrite Suggestions', rewritesSection, true);

    renderArgumentGraph(parsed);
    mountSourceVerification();
    requestAnimationFrame(function () { c.classList.add('visible'); });
  }

  // ── Core analysis ──────────────────────────────────────────────────────────
  async function runAnalysis() {
    const essay = essayInput.value.trim();
    if (!essay) { setStatus('error', 'Paste an argument before using Fracture.'); return; }

    resetOutput();
    isStreaming = true;
    setBtns(true);
    if (skeleton) skeleton.classList.remove('hidden');
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
      if (jsonOutput) jsonOutput.textContent = '';
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
              if (jsonOutput) jsonOutput.textContent = rawJsonText;
              continue;
            }
            if (json.fracture_model_delta) {
              rawJsonText += json.fracture_model_delta;
              if (jsonOutput) jsonOutput.textContent += json.fracture_model_delta;
              appendLiveAuditDelta(json.fracture_model_delta);
              continue;
            }
            const delta = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) || '';
            if (delta) {
              rawJsonText += delta;
              if (jsonOutput) jsonOutput.textContent += delta;
              appendLiveAuditDelta(delta);
            }
          } catch (_) { /* ignore malformed SSE chunks */ }
        }
      }

      isStreaming = false;
      setBtns(false);
      if (copyBtn)   copyBtn.disabled   = false;
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn)  shareBtn.disabled  = false;
      stopProgress(true, 'Report ready');
      completeLiveAuditStream();
      if (skeleton) skeleton.classList.add('hidden');

      try {
        const parsed = parsedAudit || parseAuditJson(rawJsonText);
        renderParsedAudit(parsed);
        finalizeJsonTextFromAudit();
        setStatus('done', 'Fracture report complete.');
        runSourceVerification()
          .then(loadFeedbackPreferences)
          .then(function (preferences) {
            if (!preferences || preferences.saveReports !== false) return saveCurrentWork(false);
            return null;
          });
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
  async function copyJson() {
    if (!rawJsonText) return;
    try {
      await navigator.clipboard.writeText(rawJsonText);
      if (statusDetail) statusDetail.textContent = 'Report data copied to clipboard.';
    } catch (_) {
      if (statusDetail) statusDetail.textContent = 'Unable to copy to clipboard.';
    }
  }

  function exportJson() {
    if (!rawJsonText) return;
    const blob = new Blob([rawJsonText], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'fracture-analysis.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function shareLink() {
    if (!rawJsonText) return;
    const url = location.origin + location.pathname + '?analysis=' + encodeURIComponent(rawJsonText);
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ESSAY);
      if (!saved) { if (statusDetail) statusDetail.textContent = 'No saved draft found.'; return; }
      essayInput.value = saved; updateCharCount();
      if (statusDetail) statusDetail.textContent = 'Saved draft loaded.';
    } catch (_) { if (statusDetail) statusDetail.textContent = 'Unable to load.'; }
  }

  // ── Shared-link loader ─────────────────────────────────────────────────────
  function maybeLoadSharedAnalysis() {
    const analysis = new URLSearchParams(location.search).get('analysis');
    if (!analysis) return;
    try {
      rawJsonText = decodeURIComponent(analysis);
      if (jsonOutput) jsonOutput.textContent = rawJsonText;
      const parsed = parseAuditJson(rawJsonText);
      if (typeof parsed.overall_score === 'number' && scorePill) scorePill.textContent = String(parsed.overall_score);
      renderArgumentGraph(parsed);
      renderReport(parsed);
      if (copyBtn)   copyBtn.disabled   = false;
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn)  shareBtn.disabled  = false;
      if (statusLabel)  statusLabel.textContent  = 'Loaded';
      if (statusDetail) statusDetail.textContent = 'Analysis loaded from shared link.';
    } catch (_) { /* ignore invalid shared payload */ }
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  essayInput.addEventListener('input', updateCharCount);
  analyzeBtn.addEventListener('click', runAnalysis);
  if (clearBtn)  clearBtn.addEventListener('click',  clearAll);
  if (copyBtn)   copyBtn.addEventListener('click',   copyJson);
  if (exportBtn) exportBtn.addEventListener('click', exportJson);
  if (shareBtn)  shareBtn.addEventListener('click',  shareLink);
  if (saveBtn)   saveBtn.addEventListener('click',   saveEssay);
  if (loadBtn)   loadBtn.addEventListener('click',   loadEssay);
  if (rebuttalInput) rebuttalInput.addEventListener('input', function () { updateToolButton(rebuttalInput, rebuttalBtn); });
  if (chatInput) chatInput.addEventListener('input', function () { updateToolButton(chatInput, chatBtn); });
  if (rebuttalBtn) rebuttalBtn.addEventListener('click', runRebuttal);
  if (chatBtn) chatBtn.addEventListener('click', runChat);
  if (argumentGraph) {
    argumentGraph.addEventListener('click', function (event) {
      const target = event.target.closest('[data-chat-point]');
      if (!target) return;
      selectChatPoint(decodeURIComponent(target.getAttribute('data-chat-point') || ''));
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  updateCharCount();
  setStatus('idle', 'Waiting for an argument.');
  setProgress(0, 'Ready when you are');
  if (skeleton) skeleton.classList.add('hidden');
  maybeLoadSharedAnalysis();

})();
