/* shared.js — theme toggle, nav active state, shared utilities */
(function () {
  'use strict';

  const THEME_KEY = 'fracture_theme';

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

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);
    if (window.FractureAuth && typeof window.FractureAuth.initAuthGate === 'function') {
      window.FractureAuth.initAuthGate();
    }
  });
})();
