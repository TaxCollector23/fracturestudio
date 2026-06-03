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
    const haystack = [
      user.fullName,
      user.email,
      user.provider,
      latest.title,
      latest.verdict,
      latest.draft,
      latest.fullText,
      user.recentlyUsed
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
    const latest = user.latestUpload;
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
      + renderLatestUpload(latest, user)
      + renderRecentProjects(user.recentProjects)
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

  function renderLatestUpload(upload, user) {
    if (!upload) {
      return '<div class="admin-latest-empty">No uploaded work yet.</div>';
    }
    const fullText = upload.fullText || upload.draft || '';
    const preview = compact(fullText || upload.verdict || 'No preview stored.', 260);
    const hasFullText = Boolean(String(fullText || '').trim());
    const userKey = user ? esc(user.id || user.email || '') : '';

    return '<details class="admin-latest-work" open>'
      + '<summary><span>Latest saved speech / essay</span><strong>' + esc(upload.title || 'Untitled argument') + '</strong></summary>'
      + '<div class="admin-work-meta">'
      + '<span>Updated: ' + esc(dateLabel(upload.updated)) + '</span>'
      + '<span>Score: ' + esc(scoreText(upload.score)) + '</span>'
      + '<span>Words: ' + esc(upload.wordCount || 0) + '</span>'
      + '<span>Characters: ' + esc(upload.characterCount || String(fullText).length || 0) + '</span>'
      + '</div>'
      + '<p>' + esc(preview) + '</p>'
      + (hasFullText
        ? '<details class="admin-full-draft">'
          + '<summary>Read full latest writing</summary>'
          + '<div class="admin-full-draft-actions"><button class="admin-copy-writing" type="button" data-user-key="' + userKey + '">Copy text</button></div>'
          + '<pre>' + esc(fullText) + '</pre>'
          + '</details>'
        : '<div class="admin-latest-empty">No full text was stored for this item.</div>')
      + (upload.verdict ? '<blockquote>' + esc(compact(upload.verdict, 260)) + '</blockquote>' : '')
      + '</details>';
  }

  function renderRecentProjects(projects) {
    if (!Array.isArray(projects) || projects.length <= 1) return '';
    return '<div class="admin-recent-list"><div class="admin-recent-title">Recently used</div>'
      + projects.slice(0, 4).map(function (project) {
        return '<div class="admin-recent-row">'
          + '<span>' + esc(project.title || 'Untitled argument') + '</span>'
          + '<strong>' + esc(scoreText(project.score)) + '</strong>'
          + '<small>' + esc(shortDate(project.updated)) + '</small>'
          + '</div>';
      }).join('')
      + '</div>';
  }


  function latestWritingForUserKey(key) {
    const cleanKey = String(key || '');
    const user = loadedUsers.find(function (item) {
      return String(item.id || item.email || '') === cleanKey;
    });
    const latest = user && user.latestUpload ? user.latestUpload : null;
    return latest ? String(latest.fullText || latest.draft || '') : '';
  }

  async function copyLatestWriting(button) {
    const text = latestWritingForUserKey(button.getAttribute('data-user-key'));
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
      if (button) copyLatestWriting(button);
    });
  }
  if (searchInput) searchInput.addEventListener('input', function () { renderUsers(loadedUsers); });
  if (passwordInput) {
    passwordInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') loadUsers();
    });
  }
})();
