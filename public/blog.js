(function () {
  'use strict';

  function initFilters() {
    const filters = Array.from(document.querySelectorAll('.blog-filter'));
    const cards = Array.from(document.querySelectorAll('.blog-card'));
    const empty = document.getElementById('blogEmpty');

    if (!filters.length || !cards.length) return;

    function setFilter(filter) {
      let visibleCount = 0;

      cards.forEach((card) => {
        const matches = filter === 'all' || card.dataset.category === filter;
        card.hidden = !matches;
        if (matches) visibleCount += 1;
      });

      filters.forEach((button) => {
        const active = button.dataset.filter === filter;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      if (empty) empty.classList.toggle('active', visibleCount === 0);
    }

    filters.forEach((button) => {
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      button.addEventListener('click', () => setFilter(button.dataset.filter || 'all'));
    });
  }

  function initCardReveal() {
    const cards = document.querySelectorAll('.blog-card');
    if (!cards.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(16px)';
      card.style.transitionDelay = `${Math.min(index * 35, 220)}ms`;
      observer.observe(card);
    });
  }

  function normalizeTitle(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function initClickableCards() {
    const posts = window.FractureBlogPosts || [];
    const cards = Array.from(document.querySelectorAll('.blog-card'));
    const byTitle = new Map(posts.map((post) => [normalizeTitle(post.title), post]));

    cards.forEach((card) => {
      const title = card.querySelector('.blog-title');
      const post = byTitle.get(normalizeTitle(title && title.textContent));
      if (!post) return;

      const href = 'blog-post.html?post=' + encodeURIComponent(post.slug);
      const link = card.querySelector('.blog-link');
      if (link) {
        link.href = href;
        link.textContent = 'Read article';
      }

      card.dataset.post = post.slug;
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';

      card.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) return;
        window.location.href = href;
      });

      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        window.location.href = href;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initClickableCards();
    initCardReveal();
  });
})();
