/* =====================================================================
   Maai Ka Thekuaa — motion layer
   Scroll reveals, header state, image fade-in, add-to-cart flight.
   Everything here is progressive: if it fails, the site still works.
   ===================================================================== */
(function () {
  'use strict';
  const MKT = window.MKT;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------- scroll reveal ------------------------- */
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        observer.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' })
    : null;

  /** Elements worth revealing, in the order they appear on the page. */
  const REVEAL_SELECTOR = [
    '.section-head',
    '.grid > .card',
    '.grid > .cat-card',
    '.grid > .offer-card',
    '.banner-slide',
    '.gallery-grid img',
    '.story-block',
    '.story-para',
    '.story-quote',
    '.timeline',
    '.tl-item',
    '.pdp-gallery',
    '.pdp > div:last-child',
    '.form-card',
    '.contact-list',
    '.map-frame',
    '.order-card',
    '.prose',
    '.page-head',
    '.summary',
    '.tabs',
    '.info-list'
  ].join(',');

  function applyReveals(root) {
    if (reduced || !observer) return;
    const scope = root || document.getElementById('app');
    if (!scope) return;
    const nodes = scope.querySelectorAll(REVEAL_SELECTOR);
    let groupTop = -1;
    let index = 0;
    nodes.forEach((el) => {
      if (el.classList.contains('reveal') || el.closest('.hero')) return;
      // Stagger items that sit on the same row, restart on a new row.
      const top = Math.round(el.getBoundingClientRect().top / 40);
      if (top !== groupTop) { groupTop = top; index = 0; }
      el.classList.add('reveal');
      el.style.setProperty('--d', Math.min(index * 70, 350) + 'ms');
      index += 1;
      observer.observe(el);
    });

    // Order tracker bars fill one after another.
    scope.querySelectorAll('.tracker .step.done').forEach((s, i) => {
      s.style.setProperty('--d', (i * 140) + 'ms');
    });
  }

  /* ------------------------ images fade in ------------------------- */
  function fadeImages(root) {
    if (reduced) return;
    (root || document).querySelectorAll('img:not(.img-fade)').forEach((img) => {
      if (img.closest('.brand') || img.classList.contains('fly-img')) return;
      img.classList.add('img-fade');
      if (img.complete && img.naturalWidth) img.classList.add('loaded');
      else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
    });
  }

  /* ------------------------- header state -------------------------- */
  const header = document.querySelector('.site-header');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('scrolled', window.scrollY > 40);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --------------------- page transition on nav -------------------- */
  document.addEventListener('mkt:rendered', () => {
    const app = document.getElementById('app');
    if (!reduced) {
      app.classList.remove('page-enter');
      void app.offsetWidth;          // restart the animation
      app.classList.add('page-enter');
    }
    fadeImages(app);
    applyReveals(app);
    // Late-loading images (lazy ones) still need the reveal pass.
    setTimeout(() => { fadeImages(app); applyReveals(app); }, 400);
  });

  /* -------------------------- button ripple ------------------------ */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn || reduced || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.width = r.style.height = size + 'px';
    r.style.left = (e.clientX - rect.left - size / 2) + 'px';
    r.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(r);
    setTimeout(() => r.remove(), 620);
  });

  /* ------------------- fly-to-cart on add to cart ------------------ */
  function flyToCart(sourceImg) {
    if (reduced || !sourceImg) return;
    const cart = document.getElementById('btnCart');
    if (!cart) return;
    const from = sourceImg.getBoundingClientRect();
    const to = cart.getBoundingClientRect();
    const ghost = document.createElement('img');
    ghost.src = sourceImg.currentSrc || sourceImg.src;
    ghost.className = 'fly-img';
    ghost.style.left = from.left + 'px';
    ghost.style.top = from.top + 'px';
    ghost.style.width = from.width + 'px';
    ghost.style.height = from.height + 'px';
    ghost.style.opacity = '0.95';
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      ghost.style.left = (to.left + to.width / 2 - 14) + 'px';
      ghost.style.top = (to.top + to.height / 2 - 14) + 'px';
      ghost.style.width = '28px';
      ghost.style.height = '28px';
      ghost.style.opacity = '0.25';
      ghost.style.transform = 'rotate(180deg)';
    });
    setTimeout(() => {
      ghost.remove();
      cart.classList.add('shake');
      setTimeout(() => cart.classList.remove('shake'), 520);
    }, 850);
  }

  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add], #btnAdd, [data-buy]');
    if (!add) return;
    const card = add.closest('.p-card');
    const img = card ? card.querySelector('.p-img img') : document.getElementById('mainImg');
    flyToCart(img);
  }, true);

  /* ------------------------ cart badge pop ------------------------- */
  const badge = document.getElementById('cartCount');
  if (badge && 'MutationObserver' in window && !reduced) {
    new MutationObserver(() => {
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  /* --------------------- product image switching ------------------- */
  document.addEventListener('click', (e) => {
    if (reduced) return;
    if (!e.target.matches('.thumbs img')) return;
    const main = document.getElementById('mainImg');
    if (!main) return;
    main.classList.remove('swap');
    void main.offsetWidth;
    main.classList.add('swap');
  });

  /* ------------------ horizontal rail (story strip) ---------------- */
  MKT.initRail = function (rail) {
    if (!rail) return;
    const wrap = rail.closest('.rail-wrap');
    const prev = wrap.querySelector('[data-rail="prev"]');
    const next = wrap.querySelector('[data-rail="next"]');

    const step = () => {
      const card = rail.querySelector('.story-card');
      return card ? card.getBoundingClientRect().width + 20 : rail.clientWidth * 0.8;
    };
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      prev.classList.toggle('off', rail.scrollLeft <= 2);
      next.classList.toggle('off', rail.scrollLeft >= max);
      wrap.classList.toggle('no-nav', max <= 2);
    };

    prev.onclick = () => rail.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' });
    next.onclick = () => rail.scrollBy({ left: step(), behavior: reduced ? 'auto' : 'smooth' });
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    setTimeout(update, 60);

    // Drag to scroll with a mouse, the way it already works with a finger.
    let down = false, startX = 0, startScroll = 0, moved = 0;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0;
      startX = e.clientX; startScroll = rail.scrollLeft;
      rail.classList.add('dragging');
    });
    rail.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.abs(dx);
      rail.scrollLeft = startScroll - dx;
    });
    const end = () => { down = false; rail.classList.remove('dragging'); };
    rail.addEventListener('pointerup', end);
    rail.addEventListener('pointerleave', end);
    // A drag should not trigger the link on the last card.
    rail.addEventListener('click', (e) => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); } }, true);

    // Keyboard support.
    rail.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    });
  };

  /* --------------------- skeleton loader helper -------------------- */
  MKT.skeletonGrid = function (count, cls) {
    let out = '';
    for (let i = 0; i < (count || 8); i++) {
      out += `<div class="sk-card"><div class="sk sk-img"></div><div class="sk-body">
        <div class="sk sk-line w40"></div><div class="sk sk-line tall w90"></div>
        <div class="sk sk-line w70"></div><div class="sk sk-line w40"></div></div></div>`;
    }
    return `<div class="grid ${cls || 'g4'}">${out}</div>`;
  };

  /* ------------------------- initial pass -------------------------- */
  fadeImages(document);
  applyReveals(document);
  MKT.applyReveals = applyReveals;
})();
