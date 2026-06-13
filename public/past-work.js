/* past-work.js - readable cloud history for signed-in Fracture Studio users */
(function () {
  'use strict';

  const grid = document.getElementById('pastWorkGrid');
  const count = document.getElementById('pastWorkCount');
  const search = document.getElementById('pastWorkSearch');
  const refresh = document.getElementById('refreshPastWork');
  let projects = [];

  function firstText() {
    for (let i = 0; i < arguments.length; i += 1) {
      if (typeof arguments[i] === 'string' && arguments[i].trim()) return arguments[i].trim();
    }
    return '';
  }

  function compact(value, max) {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
  }

  function getAudit(project) {
    const analysis = project && project.analysis;
    if (!analysis || typeof analysis !== 'object') return null;
    if (analysis.audit && typeof analysis.audit === 'object') return analysis.audit;
    return typeof analysis.overall_score === 'number' ? analysis : null;
  }

  function artifactType(project) {
    const draft = String((project && project.draft) || '').toLowerCase();
    if (/\b(resolved|contention|crossfire|affirmative|negative|opponent|rebuttal)\b/.test(draft)) return 'Debate case';
    if (/\b(audience|speech|today i|thank you|call to action)\b/.test(draft)) return 'Speech';
    if (/\b(policy|proposal|recommendation|implementation|brief)\b/.test(draft)) return 'Policy brief';
    if (draft.length > 1300) return 'Essay';
    return 'Argument draft';
  }

  function updatedText(project) {
    const raw = project && (project.updated || project.updated_at);
    if (!raw) return 'Saved recently';
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? 'Saved recently' : date.toLocaleString();
  }

  function empty(message, action) {
    grid.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'past-work-empty';
    const copy = document.createElement('p');
    copy.textContent = message;
    panel.appendChild(copy);
    if (action) {
      const button = document.createElement('button');
      button.className = 'btn-primary';
      button.type = 'button';
      button.textContent = action;
      button.addEventListener('click', function () {
        if (window.FractureAuth && typeof window.FractureAuth.showAuthModal === 'function') {
          window.FractureAuth.showAuthModal(false, 'Sign in to open your cloud-saved arguments and earlier Fracture reports.');
        }
      });
      panel.appendChild(button);
    }
    grid.appendChild(panel);
  }

  function openProject(project, destination) {
    if (window.FractureAuth && typeof window.FractureAuth.setActiveWorkspace === 'function') {
      window.FractureAuth.setActiveWorkspace(project);
    }
    const id = project && project.id ? '?project=' + encodeURIComponent(project.id) : '';
    window.location.href = destination === 'rebuttals' ? 'rebuttals.html' + id : 'studio.html' + id;
  }

  function makeCard(project) {
    const audit = getAudit(project);
    const card = document.createElement('article');
    card.className = 'past-work-card';

    const head = document.createElement('div');
    head.className = 'past-work-card-head';
    const type = document.createElement('span');
    type.className = 'past-work-type';
    type.textContent = artifactType(project);
    const score = document.createElement('span');
    score.className = 'past-work-score';
    score.textContent = audit && typeof audit.overall_score === 'number' ? audit.overall_score + '/100' : 'Draft';
    head.appendChild(type);
    head.appendChild(score);

    const title = document.createElement('h2');
    title.textContent = compact(project.title || project.draft || 'Untitled argument', 96);
    const updated = document.createElement('div');
    updated.className = 'past-work-updated';
    updated.textContent = updatedText(project);

    const summary = document.createElement('section');
    summary.className = 'past-work-card-section';
    const summaryLabel = document.createElement('div');
    summaryLabel.className = 'past-work-card-label';
    summaryLabel.textContent = 'Fracture summary';
    const summaryText = document.createElement('p');
    summaryText.textContent = compact(firstText(
      audit && audit.verdict,
      'This draft has been saved. Run Fracture It to add an AI-generated argument summary.'
    ), 460);
    summary.appendChild(summaryLabel);
    summary.appendChild(summaryText);

    const preview = document.createElement('section');
    preview.className = 'past-work-card-section past-work-preview';
    const previewLabel = document.createElement('div');
    previewLabel.className = 'past-work-card-label';
    previewLabel.textContent = 'Readable preview';
    const previewText = document.createElement('p');
    previewText.textContent = compact(project.draft, 360) || 'No draft text was saved with this item.';
    preview.appendChild(previewLabel);
    preview.appendChild(previewText);

    const actions = document.createElement('div');
    actions.className = 'past-work-card-actions';
    const open = document.createElement('button');
    open.className = 'btn-primary';
    open.type = 'button';
    open.textContent = 'Open in Studio';
    open.addEventListener('click', function () { openProject(project, 'studio'); });
    const rebuttals = document.createElement('button');
    rebuttals.className = 'btn-sm';
    rebuttals.type = 'button';
    rebuttals.textContent = 'Prepare Rebuttals';
    rebuttals.addEventListener('click', function () { openProject(project, 'rebuttals'); });
    actions.appendChild(open);
    actions.appendChild(rebuttals);

    card.appendChild(head);
    card.appendChild(title);
    card.appendChild(updated);
    card.appendChild(summary);
    card.appendChild(preview);
    card.appendChild(actions);
    return card;
  }

  function render() {
    const term = String(search.value || '').trim().toLowerCase();
    const filtered = projects.filter(function (project) {
      if (!term) return true;
      const audit = getAudit(project);
      return [
        project.title,
        project.draft,
        audit && audit.verdict,
        artifactType(project)
      ].join(' ').toLowerCase().includes(term);
    });

    grid.innerHTML = '';
    count.textContent = projects.length
      ? filtered.length + ' of ' + projects.length + ' saved ' + (projects.length === 1 ? 'item' : 'items')
      : 'No saved work yet';
    if (!filtered.length) {
      empty(term ? 'No saved arguments match that search.' : 'No saved work yet. Analyze a draft in Studio to begin your history.');
      return;
    }
    filtered.forEach(function (project) { grid.appendChild(makeCard(project)); });
  }

  async function load() {
    if (!window.FractureAuth || typeof window.FractureAuth.listProjects !== 'function') {
      empty('Your saved-work connection is unavailable. Return to Studio and try again.');
      return;
    }
    // Check if user is authenticated
    const user = typeof window.FractureAuth.getUser === 'function' ? await window.FractureAuth.getUser() : null;
    const isGuest = typeof window.FractureAuth.hasGuestAccess === 'function' ? window.FractureAuth.hasGuestAccess() : false;
    if (!user && !isGuest) {
      empty('Sign in to view your saved work. Past work is only visible when you are logged in.');
      if (count) count.textContent = 'Not signed in';
      return;
    }
    if (isGuest && !user) {
      empty('Guest sessions do not save work history. Sign in to keep your reports across sessions.');
      if (count) count.textContent = 'Guest session';
      return;
    }
    count.textContent = 'Loading saved work';
    projects = await window.FractureAuth.listProjects();
    render();
  }

  if (search) search.addEventListener('input', render);
  if (refresh) refresh.addEventListener('click', load);
  window.addEventListener('DOMContentLoaded', load);
})();
