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
  const progressPill    = document.getElementById('progressPill');
  const progressBar     = document.getElementById('progressBar');
  const jsonOutput      = document.getElementById('jsonOutput');
  const jsonError       = document.getElementById('jsonError');
  const scorePill       = document.getElementById('scorePill');
  const copyBtn         = document.getElementById('copyBtn');
  const exportBtn       = document.getElementById('exportBtn');
  const shareBtn        = document.getElementById('shareBtn');
  const reportContainer = document.getElementById('reportContainer');
  const skeleton        = document.getElementById('skeleton');

  if (!essayInput) return; // Not on studio page

  // ── State ──────────────────────────────────────────────────────────────────
  let rawJsonText   = '';
  let isStreaming   = false;
  let progress      = 0;
  let progressTimer = null;

  const STORAGE_KEY_ESSAY = 'fracture_studio_last_essay';

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

  function setProgress(value) {
    progress = Math.max(0, Math.min(100, value));
    if (progressPill) progressPill.textContent = String(Math.floor(progress)).padStart(2, ' ') + '%';
    if (progressBar)  progressBar.style.width  = progress + '%';
  }

  function startProgress() {
    setProgress(3);
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(function () {
      if (!isStreaming) return;
      if (progress < 90) setProgress(progress + 2.5);
    }, 500);
  }

  function stopProgress(success) {
    if (progressTimer) clearInterval(progressTimer);
    setProgress(success ? 100 : progress);
  }

  function resetOutput() {
    rawJsonText = '';
    if (jsonOutput) jsonOutput.textContent = '';
    if (jsonError)  { jsonError.classList.add('hidden'); jsonError.textContent = ''; }
    if (scorePill)  scorePill.textContent = '—';
    if (copyBtn)    copyBtn.disabled  = true;
    if (exportBtn)  exportBtn.disabled = true;
    if (shareBtn)   shareBtn.disabled  = true;
    if (reportContainer) { reportContainer.innerHTML = ''; reportContainer.classList.remove('visible'); }
    if (skeleton)   skeleton.classList.add('hidden');
    setProgress(0);
  }

  function setBtns(disabled) {
    [analyzeBtn, clearBtn, saveBtn, loadBtn].forEach(function (b) {
      if (b) b.disabled = disabled;
    });
  }

  // ── Escape HTML ────────────────────────────────────────────────────────────
  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function quoteBlock(text) {
    return '<div class="report-quote">' + esc(text || '') + '</div>';
  }

  // ── Report renderer ────────────────────────────────────────────────────────
  function renderReport(parsed) {
    const c = reportContainer;
    c.innerHTML = '';

    function section(title, innerHTML, open) {
      return '<details class="report-section"' + (open ? ' open' : '') + '>'
           + '<summary>' + title + '</summary>'
           + '<div class="content">' + innerHTML + '</div>'
           + '</details>';
    }

    const scores = parsed.score_breakdown || {};
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
           + '<p><b>Diagnosis:</b> ' + esc(cl.diagnosis || '') + '</p>'
           + '<p><b>Opponent Exploit:</b> ' + esc(cl.opponent_exploit || '') + '</p>'
           + '<p><b>Fix:</b> ' + esc(cl.fix || '') + '</p>'
           + '</div>';
    }).join('') || '<p>No claims parsed.</p>';

    const assumptionsSection = (parsed.assumption_audit || []).map(function (a) {
      return '<div class="report-item">'
           + '<p><b>Assumption:</b> ' + esc(a.assumption || '') + '</p>'
           + '<p><b>Load-bearing:</b> ' + esc(a.load_bearing || '') + '</p>'
           + '<span class="report-label">Dependent Claim:</span>'
           + quoteBlock(a.quote)
           + '<p><b>Vulnerability:</b> ' + esc(a.vulnerability || '') + '</p>'
           + '<p><b>Defense:</b> ' + esc(a.defense || '') + '</p>'
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
      section('Verdict & Score Breakdown', scoreSection, true) +
      section('Thesis Analysis', thesisSection) +
      section('Claim-by-Claim Analysis', claimsSection) +
      section('Assumption Audit', assumptionsSection) +
      section('Logical Fallacies', fallaciesSection) +
      section('Counter-Arguments', countersSection) +
      section('Rhetorical Analysis', rhetoricSection) +
      section('Rewrite Suggestions', rewritesSection);

    requestAnimationFrame(function () { c.classList.add('visible'); });
  }

  // ── Core analysis ──────────────────────────────────────────────────────────
  async function runAnalysis() {
    const essay = essayInput.value.trim();
    if (!essay) { setStatus('error', 'Paste an essay before running the audit.'); return; }

    resetOutput();
    isStreaming = true;
    setBtns(true);
    if (skeleton) skeleton.classList.remove('hidden');
    setStatus('live', 'Running full argument audit…');
    startProgress();

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay: essay }),
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
            const delta = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) || '';
            if (delta) {
              rawJsonText += delta;
              if (jsonOutput) jsonOutput.textContent += delta;
            }
          } catch (_) { /* ignore malformed SSE chunks */ }
        }
      }

      isStreaming = false;
      setBtns(false);
      if (copyBtn)   copyBtn.disabled   = false;
      if (exportBtn) exportBtn.disabled = false;
      if (shareBtn)  shareBtn.disabled  = false;
      stopProgress(true);
      if (skeleton) skeleton.classList.add('hidden');

      try {
        const parsed = JSON.parse(rawJsonText);
        setStatus('done', 'Audit complete. JSON is valid.');
        if (typeof parsed.overall_score === 'number' && scorePill) {
          scorePill.textContent = String(parsed.overall_score);
        }
        renderReport(parsed);
      } catch (e) {
        setStatus('error', 'Model response is not valid JSON. Check for stray text or truncation.');
        if (jsonError) {
          jsonError.classList.remove('hidden');
          jsonError.textContent = 'Parse error: ' + e.message;
        }
      }

    } catch (err) {
      isStreaming = false;
      setBtns(false);
      stopProgress(false);
      if (skeleton) skeleton.classList.add('hidden');
      setStatus('error', 'Request failed. Check your connection or server configuration.');
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
      if (statusDetail) statusDetail.textContent = 'JSON copied to clipboard.';
    } catch (_) {
      if (statusDetail) statusDetail.textContent = 'Unable to copy to clipboard.';
    }
  }

  function exportJson() {
    if (!rawJsonText) return;
    const blob = new Blob([rawJsonText], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'fracture_analysis.json';
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
    setStatus('idle', 'Waiting for an essay.');
  }

  function saveEssay() {
    const essay = essayInput.value.trim();
    if (!essay) { if (statusDetail) statusDetail.textContent = 'Nothing to save.'; return; }
    try { localStorage.setItem(STORAGE_KEY_ESSAY, essay); if (statusDetail) statusDetail.textContent = 'Essay saved locally.'; }
    catch (_) { if (statusDetail) statusDetail.textContent = 'Unable to save.'; }
  }

  function loadEssay() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ESSAY);
      if (!saved) { if (statusDetail) statusDetail.textContent = 'No saved essay found.'; return; }
      essayInput.value = saved; updateCharCount();
      if (statusDetail) statusDetail.textContent = 'Saved essay loaded.';
    } catch (_) { if (statusDetail) statusDetail.textContent = 'Unable to load.'; }
  }

  // ── Shared-link loader ─────────────────────────────────────────────────────
  function maybeLoadSharedAnalysis() {
    const analysis = new URLSearchParams(location.search).get('analysis');
    if (!analysis) return;
    try {
      rawJsonText = decodeURIComponent(analysis);
      if (jsonOutput) jsonOutput.textContent = rawJsonText;
      const parsed = JSON.parse(rawJsonText);
      if (typeof parsed.overall_score === 'number' && scorePill) scorePill.textContent = String(parsed.overall_score);
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

  // ── Init ───────────────────────────────────────────────────────────────────
  updateCharCount();
  setStatus('idle', 'Waiting for an essay.');
  setProgress(0);
  if (skeleton) skeleton.classList.add('hidden');
  maybeLoadSharedAnalysis();

})();
