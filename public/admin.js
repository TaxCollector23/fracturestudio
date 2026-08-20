(function () {
  'use strict';

  const passwordInput = document.getElementById('adminPassword');
  const loadBtn = document.getElementById('adminLoadBtn');
  const message = document.getElementById('adminMessage');
  const usersRoot = document.getElementById('adminUsers');
  const count = document.getElementById('adminCount');
  const searchInput = document.getElementById('adminSearch');
  const metricUsers = document.getElementById('metricUsers');
  const metricProjects = document.getElementById('metricProjects');
  const metricAverage = document.getElementById('metricAverage');
  const metricRecent = document.getElementById('metricRecent');

  let loadedUsers = [];
  let loadedSummary = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function dateLabel(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function shortDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }

  function scoreText(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value + '/100' : 'Not scored';
  }

  function compact(value, max) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
  }

  function minutesLabel(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 'Not tracked';
    if (number < 60) return Math.round(number) + ' min';
    const hours = Math.floor(number / 60);
    const minutes = Math.round(number % 60);
    return minutes ? hours + ' hr ' + minutes + ' min' : hours + ' hr';
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function projectText(project) {
    return String(project && (project.fullText || project.draft || '') || '');
  }

  function renderSummary(summary, users) {
    const totalUsers = summary?.totalUsers ?? users.length;
    const totalProjects = summary?.totalProjects ?? users.reduce((sum, user) => sum + safeNumber(user.projectCount), 0);
    const avg = typeof summary?.averageScore === 'number' ? Math.round(summary.averageScore) : null;
    const recent = summary?.activeLast7Days ?? users.filter(function (user) { return user.activeLast7Days; }).length;

    if (metricUsers) metricUsers.textContent = totalUsers.toLocaleString();
    if (metricProjects) metricProjects.textContent = totalProjects.toLocaleString();
    if (metricAverage) metricAverage.textContent = avg === null ? '—' : avg + '/100';
    if (metricRecent) metricRecent.textContent = recent.toLocaleString();
  }

  function searchMatches(user, query) {
    if (!query) return true;
    const latest = user.latestUpload || {};
    const allWritings = Array.isArray(user.allWritings) ? user.allWritings : (user.recentProjects || []);
    const haystack = [
      user.fullName,
      user.email,
      user.provider,
      latest.title,
      latest.verdict,
      latest.draft,
      latest.fullText,
      user.recentlyUsed,
      allWritings.map(function (project) {
        return [project.title, project.verdict, projectText(project)].join(' ');
      }).join(' ')
    ].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function renderUsers(users) {
    const query = searchInput ? searchInput.value.trim() : '';
    const filtered = users.filter(function (user) { return searchMatches(user, query); });

    if (!Array.isArray(users) || !users.length) {
      usersRoot.innerHTML = '<div class="admin-empty-state">No account profiles found yet. Once users log in, this dashboard will populate.</div>';
      count.textContent = '0 accounts found.';
      renderSummary(loadedSummary, []);
      return;
    }

    count.textContent = filtered.length.toLocaleString() + ' of ' + users.length.toLocaleString() + ' accounts shown.';

    if (!filtered.length) {
      usersRoot.innerHTML = '<div class="admin-empty-state">No users match that search.</div>';
      return;
    }

    usersRoot.innerHTML = filtered.map(renderUserCard).join('');
  }

  function renderUserCard(user) {
    const allWritings = Array.isArray(user.allWritings) ? user.allWritings : (user.recentProjects || []);
    const scoreClass = typeof user.averageScore === 'number' ? ' has-score' : '';
    const email = user.email || 'No email recorded';
    const name = user.fullName || 'Unnamed account';
    const recent = user.recentlyUsed || dateLabel(user.lastSeen || user.created);

    return '<article class="admin-user-card">'
      + '<div class="admin-user-main">'
      + '<div class="admin-user-avatar">' + esc(initials(name, email)) + '</div>'
      + '<div>'
      + '<h2>' + esc(name) + '</h2>'
      + '<p>' + esc(email) + '</p>'
      + '<div class="admin-user-tags">'
      + '<span>' + esc(user.provider || 'email') + '</span>'
      + '<span>' + esc(user.projectCount || 0) + ' saved</span>'
      + '<span>' + esc(recent) + '</span>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="admin-user-metrics">'
      + metricBlock('Avg score', scoreText(user.averageScore), scoreClass)
      + metricBlock('Best score', scoreText(user.bestScore), scoreClass)
      + metricBlock('Time spent', minutesLabel(user.minutesSpent), '')
      + metricBlock('Last active', shortDate(user.lastSeen), '')
      + '</div>'
      + renderAllWritings(allWritings, user)
      + '</article>';
  }

  function metricBlock(label, value, extraClass) {
    return '<div class="admin-user-metric' + esc(extraClass || '') + '"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }

  function initials(name, email) {
    const source = String(name || email || 'FS').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }

  function writingKey(user, project, index) {
    return encodeURIComponent([user.id || user.email || 'user', project.id || index].join('::'));
  }

  function renderAllWritings(projects, user) {
    if (!Array.isArray(projects) || !projects.length) {
      return '<div class="admin-latest-empty">No saved speeches, essays, or arguments yet.</div>';
    }

    return '<details class="admin-writing-library" open>'
      + '<summary><span>Saved writing archive</span><strong>' + esc(projects.length) + ' item' + (projects.length === 1 ? '' : 's') + '</strong></summary>'
      + '<div class="admin-writing-list">'
      + projects.map(function (project, index) { return renderWritingItem(project, user, index); }).join('')
      + '</div>'
      + '</details>';
  }

  function renderWritingItem(project, user, index) {
    const fullText = projectText(project);
    const preview = compact(fullText || project.verdict || 'No preview stored.', 300);
    const hasFullText = Boolean(fullText.trim());
    const key = writingKey(user, project, index);
    const label = index === 0 ? 'Latest saved writing' : 'Saved writing #' + (index + 1);

    return '<details class="admin-latest-work admin-writing-item" ' + (index === 0 ? 'open' : '') + '>'
      + '<summary><span>' + esc(label) + '</span><strong>' + esc(project.title || 'Untitled argument') + '</strong></summary>'
      + '<div class="admin-work-meta">'
      + '<span>Updated: ' + esc(dateLabel(project.updated)) + '</span>'
      + '<span>Created: ' + esc(dateLabel(project.created)) + '</span>'
      + '<span>Score: ' + esc(scoreText(project.score)) + '</span>'
      + '<span>Words: ' + esc(project.wordCount || 0) + '</span>'
      + '<span>Characters: ' + esc(project.characterCount || fullText.length || 0) + '</span>'
      + '</div>'
      + '<p>' + esc(preview) + '</p>'
      + (hasFullText
        ? '<details class="admin-full-draft">'
          + '<summary>Read full writing</summary>'
          + '<div class="admin-full-draft-actions"><button class="admin-copy-writing" type="button" data-writing-key="' + key + '">Copy text</button></div>'
          + '<pre>' + esc(fullText) + '</pre>'
          + '</details>'
        : '<div class="admin-latest-empty">No full text was stored for this item.</div>')
      + (project.verdict ? '<blockquote>' + esc(compact(project.verdict, 300)) + '</blockquote>' : '')
      + '</details>';
  }

  function writingForKey(key) {
    const cleanKey = decodeURIComponent(String(key || ''));
    for (const user of loadedUsers) {
      const projects = Array.isArray(user.allWritings) ? user.allWritings : (user.recentProjects || []);
      for (let index = 0; index < projects.length; index += 1) {
        const project = projects[index];
        const candidate = [user.id || user.email || 'user', project.id || index].join('::');
        if (candidate === cleanKey) return projectText(project);
      }
    }
    return '';
  }

  async function copyWriting(button) {
    const text = writingForKey(button.getAttribute('data-writing-key'));
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = original; }, 1400);
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = 'Copy text'; }, 1400);
    }
  }

  async function loadUsers() {
    const password = passwordInput.value;
    message.textContent = 'Checking admin access…';
    loadBtn.disabled = true;
    loadBtn.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: password })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Admin request failed.');
      loadedUsers = payload.users || [];
      loadedSummary = payload.summary || null;
      renderSummary(loadedSummary, loadedUsers);
      renderUsers(loadedUsers);
      message.textContent = 'Dashboard loaded.';
    } catch (err) {
      loadedUsers = [];
      loadedSummary = null;
      renderSummary(null, []);
      usersRoot.innerHTML = '<div class="admin-empty-state">Unable to load accounts. Check the admin password and Firebase server configuration.</div>';
      count.textContent = 'No account data loaded.';
      message.textContent = err.message || 'Admin request failed.';
    } finally {
      passwordInput.value = '';
      loadBtn.disabled = false;
      loadBtn.removeAttribute('aria-busy');
    }
  }

  if (loadBtn) loadBtn.addEventListener('click', loadUsers);
  if (usersRoot) {
    usersRoot.addEventListener('click', function (event) {
      const button = event.target.closest('.admin-copy-writing');
      if (button) copyWriting(button);
    });
  }
  if (searchInput) searchInput.addEventListener('input', function () { renderUsers(loadedUsers); });
  if (passwordInput) {
    passwordInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') loadUsers();
    });
  }
})();
