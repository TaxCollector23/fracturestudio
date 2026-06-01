(function () {
  'use strict';

  const passwordInput = document.getElementById('adminPassword');
  const loadBtn = document.getElementById('adminLoadBtn');
  const message = document.getElementById('adminMessage');
  const usersRoot = document.getElementById('adminUsers');
  const count = document.getElementById('adminCount');

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function dateLabel(value) {
    if (!value) return 'Never recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function renderUsers(users) {
    if (!Array.isArray(users) || !users.length) {
      usersRoot.innerHTML = '<div class="admin-muted">No account profiles found yet. Once users log in, the trigger will populate this table.</div>';
      count.textContent = '0 accounts found.';
      return;
    }

    count.textContent = users.length.toLocaleString() + ' accounts found.';
    usersRoot.innerHTML = ''
      + '<table class="admin-table">'
      + '<thead><tr><th>Full Name</th><th>Email</th><th>Provider</th><th>Last Active</th><th>Account Created</th></tr></thead>'
      + '<tbody>'
      + users.map(function (user) {
        return '<tr>'
          + '<td>' + esc(user.fullName || 'Unnamed account') + '</td>'
          + '<td>' + esc(user.email || 'No email') + '</td>'
          + '<td>' + esc(user.provider || 'email') + '</td>'
          + '<td>' + esc(dateLabel(user.lastSeen || user.created)) + '</td>'
          + '<td>' + esc(dateLabel(user.created)) + '</td>'
          + '</tr>';
      }).join('')
      + '</tbody></table>';
  }

  async function loadUsers() {
    const password = passwordInput.value;
    message.textContent = 'Checking admin access...';
    loadBtn.disabled = true;

    try {
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: password })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Admin request failed.');
      renderUsers(payload.users || []);
      message.textContent = 'Account list loaded.';
    } catch (err) {
      usersRoot.innerHTML = '<div class="admin-muted">Unable to load accounts.</div>';
      count.textContent = 'No account data loaded.';
      message.textContent = err.message || 'Admin request failed.';
    } finally {
      passwordInput.value = '';
      loadBtn.disabled = false;
    }
  }

  if (loadBtn) loadBtn.addEventListener('click', loadUsers);
  if (passwordInput) {
    passwordInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') loadUsers();
    });
  }
})();
