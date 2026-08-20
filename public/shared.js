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



  function initHomeLoadAnimations() {
    if (!document.body.classList.contains('home-page')) return;
    const revealSelectors = [
      '.stat-row',
      '.compare-col',
      '.feature-card',
      '.step',
      '.testimonial',
      '.section-title',
      '.section-sub'
    ];
    const elements = revealSelectors.flatMap(function (selector) {
      return Array.from(document.querySelectorAll(selector));
    });
    elements.forEach(function (element, index) {
      element.classList.add(index < 4 ? 'load-scale' : 'load-reveal-soft');
      element.style.animationDelay = Math.min(index * 0.055, 0.9) + 's';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);
    if (window.FractureAuth && typeof window.FractureAuth.initAuthGate === 'function') {
      window.FractureAuth.initAuthGate();
    }
    renderNotice(readNotice());
    initHomeLoadAnimations();
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== NOTICE_KEY) return;
    const existing = document.getElementById('fractureSiteNotice');
    if (existing) existing.remove();
    renderNotice(readNotice());
    initHomeLoadAnimations();
  });
})();

/* ── v1 rework: page transitions, smooth scroll, scroll reveal ────────── */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function smoothScrollTo(target) {
    var nav = document.querySelector('.nav');
    var offset = (nav ? nav.offsetHeight : 0) + 18;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: reduce ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;

    // In-page anchor → fancy smooth scroll with fixed-nav offset
    if (href.charAt(0) === '#' && href.length > 1) {
      var target = null;
      try { target = document.querySelector(href); } catch (_) {}
      if (target) {
        e.preventDefault();
        smoothScrollTo(target);
        if (history.replaceState) history.replaceState(null, '', href);
      }
      return;
    }

    // Let the browser handle new-tab / modified / non-left / external / special links
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

    var url;
    try { url = new URL(a.href); } catch (_) { return; }
    if (url.host !== window.location.host) return;
    // Same page, different hash only → ignore (anchor branch handles real targets)
    if (url.pathname === window.location.pathname && url.hash) return;

    if (reduce) return;
    // Page-exit transition, then navigate
    e.preventDefault();
    document.body.classList.add('fracture-exit');
    setTimeout(function () { window.location.href = a.href; }, 230);
  });

  // Reset exit state when restored from bfcache (back/forward)
  window.addEventListener('pageshow', function () {
    document.body.classList.remove('fracture-exit');
  });

  function initReveal() {
    // Home page already runs its own entrance animation
    if (document.body.classList.contains('home-page')) return;

    var selectors = [
      '.feature-card', '.step', '.testimonial', '.compare-col', '.stat-row',
      '.marketing-card', '.mission-grid', '.mission-text-block', '.cta-box',
      '.section-title', '.section-sub', '.studio-header', '.panel',
      '.reb-section', '.pastwork-card', '.blog-card'
    ];
    var els = [];
    selectors.forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
        if (els.indexOf(el) === -1) els.push(el);
      });
    });
    if (!els.length) return;

    if (!('IntersectionObserver' in window) || reduce) {
      els.forEach(function (el) { el.classList.add('in-view'); });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in-view');
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    els.forEach(function (el, i) {
      el.setAttribute('data-reveal', '');
      el.style.transitionDelay = Math.min((i % 6) * 0.05, 0.3) + 's';
      obs.observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', initReveal);
})();
