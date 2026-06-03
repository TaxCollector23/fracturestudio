/* shared.js — theme toggle, nav active state, shared utilities */
(function () {
  'use strict';

  const THEME_KEY = 'fracture_theme';
  const NOTICE_KEY = 'fracture_notice';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon  = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon)  icon.textContent  = theme === 'light' ? 'Light' : 'Dark';
    if (label) label.textContent = theme === 'light' ? 'Mode' : 'Mode';
  }

  function initTheme() {
    let stored;
    try { stored = localStorage.getItem(THEME_KEY); } catch (_) {}
    applyTheme(stored === 'light' ? 'light' : 'dark');
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  }

  function readNotice() {
    try {
      const notice = JSON.parse(localStorage.getItem(NOTICE_KEY) || 'null');
      if (!notice || !notice.title || !notice.createdAt) return null;
      if (Date.now() - Number(notice.createdAt) > 1000 * 60 * 60 * 6) return null;
      return notice;
    } catch (_) {
      return null;
    }
  }

  function renderNotice(notice) {
    if (!notice || document.getElementById('fractureSiteNotice')) return;
    const panel = document.createElement('aside');
    panel.id = 'fractureSiteNotice';
    panel.className = 'site-notice';
    panel.setAttribute('role', 'status');
    panel.innerHTML = '<div><strong></strong><span></span></div><a class="btn-sm"></a><button type="button" class="site-notice-close" aria-label="Dismiss notification">&times;</button>';
    panel.querySelector('strong').textContent = notice.title;
    panel.querySelector('span').textContent = notice.body || '';
    const link = panel.querySelector('a');
    link.href = notice.href || 'studio.html';
    link.textContent = 'View report';
    link.addEventListener('click', function () {
      try { localStorage.removeItem(NOTICE_KEY); } catch (_) {}
    });
    panel.querySelector('button').addEventListener('click', function () {
      try { localStorage.removeItem(NOTICE_KEY); } catch (_) {}
      panel.remove();
    });
    document.body.appendChild(panel);
  }


  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);
    if (window.FractureAuth && typeof window.FractureAuth.initAuthGate === 'function') {
      window.FractureAuth.initAuthGate();
    }
    renderNotice(readNotice());
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== NOTICE_KEY) return;
    const existing = document.getElementById('fractureSiteNotice');
    if (existing) existing.remove();
    renderNotice(readNotice());
  });
})();
