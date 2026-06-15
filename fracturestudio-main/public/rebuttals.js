/* rebuttals.js - project-aware strategic debate preparation */
(function () {
  'use strict';

  const projectSelect = document.getElementById('rebuttalProjectSelect');
  const loadBtn = document.getElementById('loadRebuttalProject');
  const generateBtn = document.getElementById('generateRebuttalsBtn');
  const focusInput = document.getElementById('rebuttalFocusInput');
  const draftTitle = document.getElementById('rebuttalDraftTitle');
  const draftPreview = document.getElementById('rebuttalDraftPreview');
  const reportSummary = document.getElementById('rebuttalReportSummary');
  const status = document.getElementById('rebuttalStatus');
  const progress = document.getElementById('rebuttalProgress');
  const output = document.getElementById('rebuttalOutput');
  let workspace = null;

  function compact(value, max) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > max ? text.slice(0, max - 3).trim() + '...' : text;
  }

  function reportFromWorkspace(current) {
    return current && current.analysis && current.analysis.audit ? current.analysis.audit : null;
  }

  function setProgress(value) {
    if (progress) progress.style.width = Math.max(0, Math.min(100, Number(value) || 0)) + '%';
  }

  function setWorkspace(next) {
    workspace = next && String(next.draft || '').trim() ? next : null;
    if (!workspace) {
      draftTitle.textContent = 'No Studio draft loaded yet';
      draftPreview.textContent = 'Open Studio, add your argument, and choose Prepare Rebuttals. Your draft will appear here automatically.';
      reportSummary.textContent = 'Run Fracture It first for report-aware preparation, or generate a first pass from the draft alone.';
      generateBtn.disabled = true;
      status.textContent = 'Choose saved work';
      return;
    }

    if (window.FractureAuth && typeof window.FractureAuth.setActiveWorkspace === 'function') {
      window.FractureAuth.setActiveWorkspace(workspace);
    }
    const report = reportFromWorkspace(workspace);
    draftTitle.textContent = workspace.title || compact(workspace.draft, 72) || 'Current Studio draft';
    draftPreview.textContent = compact(workspace.draft, 620);
    reportSummary.textContent = report
      ? compact(report.verdict || 'The saved Fracture report will guide this preparation pass.', 440)
      : 'No audit report is attached yet. Fracture will prepare a draft-first rebuttal plan and focus on the reasoning it can identify.';
    generateBtn.disabled = false;
    status.textContent = report ? 'Report context ready' : 'Draft ready';
  }

  async function loadSelectedProject() {
    const id = String(projectSelect.value || '').trim();
    if (!window.FractureAuth) return;
    status.textContent = id ? 'Opening saved work' : 'Opening Studio draft';
    const next = id && typeof window.FractureAuth.getProject === 'function'
      ? await window.FractureAuth.getProject(id)
      : window.FractureAuth.getActiveWorkspace();
    setWorkspace(next);
  }

  async function populateProjects() {
    if (!window.FractureAuth) return;
    const active = typeof window.FractureAuth.getActiveWorkspace === 'function'
      ? window.FractureAuth.getActiveWorkspace()
      : null;
    setWorkspace(active);

    let projects = [];
    try {
      projects = typeof window.FractureAuth.listProjects === 'function'
        ? await window.FractureAuth.listProjects()
        : [];
    } catch (_) {}

    const queryId = new URLSearchParams(window.location.search).get('project') || '';
    projects.forEach(function (project) {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.title || compact(project.draft, 70) || 'Untitled saved argument';
      projectSelect.appendChild(option);
    });

    if (queryId) {
      projectSelect.value = queryId;
      await loadSelectedProject();
    } else if (!active && projects.length) {
      projectSelect.value = projects[0].id;
      await loadSelectedProject();
    }
  }

  // Simple markdown-to-HTML renderer for rebuttal output
  function renderMarkdown(text) {
    if (!text) return '';
    var html = text
      // Escape HTML entities first
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Bold: **text** or __text__
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      // H1-H4 headings
      .replace(/^#### (.+)$/gm, '<h4 class="reb-h4">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="reb-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="reb-h2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="reb-h1">$1</h1>')
      // Horizontal rules
      .replace(/^---+$/gm, '<hr class="reb-hr">')
      // Numbered lists: lines starting with "1. " etc
      .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="reb-li-num"><span class="reb-li-num-badge">$1</span><span>$2</span></li>')
      // Bullet lists
      .replace(/^[\-\*]\s+(.+)$/gm, '<li class="reb-li-bullet"><span class="reb-bullet-dot"></span><span>$1</span></li>')
      // Wrap consecutive list items
      .replace(/(<li class="reb-li-num">.*?<\/li>\n?)+/g, function(m) { return '<ol class="reb-ol">' + m + '</ol>'; })
      .replace(/(<li class="reb-li-bullet">.*?<\/li>\n?)+/g, function(m) { return '<ul class="reb-ul">' + m + '</ul>'; })
      // Paragraphs: blank-line-separated blocks that aren't already HTML
      .split(/\n{2,}/)
      .map(function(block) {
        block = block.trim();
        if (!block) return '';
        if (/^<(h[1-4]|ul|ol|hr|li|blockquote)/.test(block)) return block;
        // Convert single newlines within a paragraph to <br>
        return '<p class="reb-p">' + block.replace(/\n/g, '<br>') + '</p>';
      })
      .filter(Boolean)
      .join('\n');
    return html;
  }

  var rawRebuttalText = '';

  function readSseChunk(chunk, state) {
    state.buffer += chunk;
    const parts = state.buffer.split(/\r?\n\r?\n/);
    state.buffer = parts.pop() || '';
    parts.forEach(function (part) {
      const line = part.split(/\r?\n/).find(function (entry) { return entry.startsWith('data: '); });
      if (!line) return;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const payload = JSON.parse(data);
        if (payload.fracture_text_delta) {
          if (!state.hasText) { output.innerHTML = ''; rawRebuttalText = ''; }
          state.hasText = true;
          rawRebuttalText += payload.fracture_text_delta;
          output.innerHTML = renderMarkdown(rawRebuttalText);
          output.scrollTop = output.scrollHeight;
        }
        if (payload.fracture_text_progress) {
          setProgress(payload.fracture_text_progress.progress);
          status.textContent = payload.fracture_text_progress.message || 'Preparing';
        }
      } catch (_) {}
    });
  }

  async function generateRebuttals() {
    if (!workspace || !String(workspace.draft || '').trim()) {
      setWorkspace(null);
      return;
    }

    generateBtn.disabled = true;
    output.innerHTML = '<p class="reb-streaming"><span class="reb-pulse"></span> Fracture is reading your argument and preparing the strongest reply paths&hellip;</p>';
    status.textContent = 'Reading saved argument';
    setProgress(4);

    try {
      const response = await fetch('/api/rebuttal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          draft: workspace.draft,
          report: reportFromWorkspace(workspace),
          message: focusInput.value.trim()
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(function () { return {}; });
        throw new Error(payload.error || 'Rebuttal preparation could not start.');
      }
      if (!response.body) throw new Error('Live rebuttal preparation is unavailable in this browser.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const state = { buffer: '', hasText: false };
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        readSseChunk(decoder.decode(result.value, { stream: true }), state);
      }
      readSseChunk(decoder.decode(), state);
      setProgress(100);
      status.textContent = 'Preparation ready';
      if (!state.hasText) output.innerHTML = '<p class="reb-p">The preparation pass returned no text. Try again.</p>';
    } catch (error) {
      setProgress(0);
      status.textContent = 'Unable to prepare';
      output.innerHTML = '<p class="reb-error">' + (error.message || 'Rebuttal preparation could not finish.') + '</p>';
    } finally {
      generateBtn.disabled = !workspace;
    }
  }

  if (loadBtn) loadBtn.addEventListener('click', loadSelectedProject);
  if (projectSelect) projectSelect.addEventListener('change', loadSelectedProject);
  if (generateBtn) generateBtn.addEventListener('click', generateRebuttals);
  populateProjects();
})();
