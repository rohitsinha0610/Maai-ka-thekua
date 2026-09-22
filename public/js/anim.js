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
    '.s-head',
    '.usp',
    '.tile',
    '.grid > .card',
    '.grid > .offer-card',
    '.ticket',
    '.banner-slide',
    '.gal-item',
    '.quotes',
    '.cta-card',
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
      if (el.matches('.tile')) el.classList.add('reveal-clip');
      else if (el.matches('.gal-item, .cta-card, .quotes')) el.classList.add('reveal-zoom');
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
  const progress = document.getElementById('progressBar');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('scrolled', window.scrollY > 40);
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.setProperty('--p', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
      }
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
    initHero(app);
    countUp(app);
    initMagnets(app);
    onScroll();
    // Late-loading images (lazy ones) still need the reveal pass.
    setTimeout(() => { fadeImages(app); applyReveals(app); onScroll(); }, 400);
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
      const card = rail.firstElementChild;
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
    // Dragging only starts after a few pixels of movement so buttons inside
    // the rail (add to cart) still receive their clicks.
    let down = false, startX = 0, startScroll = 0, moved = 0;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0;
      startX = e.clientX; startScroll = rail.scrollLeft;
    });
    rail.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.abs(dx);
      if (moved > 6) rail.classList.add('dragging');
      if (rail.classList.contains('dragging')) rail.scrollLeft = startScroll - dx;
    });
    const end = () => { down = false; rail.classList.remove('dragging'); };
    rail.addEventListener('pointerup', end);
    rail.addEventListener('pointerleave', end);
    // A drag should not trigger the link or button underneath.
    rail.addEventListener('click', (e) => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);

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

  /* ------------------------- hero motion --------------------------- */
  function initHero(root) {
    const media = root.querySelector('[data-tilt]');
    if (!media || reduced || !window.matchMedia('(pointer: fine)').matches) return;
    const hero = media.closest('.hero');
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        media.style.setProperty('--mx', x.toFixed(3));
        media.style.setProperty('--my', y.toFixed(3));
      });
    });
    hero.addEventListener('pointerleave', () => {
      media.style.setProperty('--mx', 0);
      media.style.setProperty('--my', 0);
    });
  }

  function countUp(root) {
    if (reduced) return;
    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      if (isNaN(to)) return;
      const start = performance.now() + 650;
      const dur = 1400;
      el.textContent = (0).toFixed(dec) + suffix;
      (function tick(now) {
        const t = Math.min(1, Math.max(0, (now - start) / dur));
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (to * eased).toFixed(dec) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      })(performance.now());
    });
  }

  function initMagnets(root) {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;
    root.querySelectorAll('[data-magnet]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--bx', ((e.clientX - r.left) / r.width - 0.5) * 10 + 'px');
        el.style.setProperty('--by', ((e.clientY - r.top) / r.height - 0.5) * 8 + 'px');
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--bx', '0px');
        el.style.setProperty('--by', '0px');
      });
    });
  }

  /* ------------------- testimonials (auto-advancing) --------------- */
  MKT.initQuotes = function (root) {
    root.querySelectorAll('[data-quotes]').forEach((box) => {
      const slides = [].slice.call(box.querySelectorAll('.q-slide'));
      const tabs = [].slice.call(box.querySelectorAll('.q-tab'));
      if (slides.length < 2) { box.classList.add('single'); return; }
      let cur = 0;
      const show = (i) => {
        cur = (i + slides.length) % slides.length;
        slides.forEach((sl, k) => sl.classList.toggle('on', k === cur));
        tabs.forEach((t, k) => {
          t.classList.toggle('on', k === cur);
          t.setAttribute('aria-selected', k === cur ? 'true' : 'false');
          t.classList.remove('run');
        });
        void box.offsetWidth;                       // restart the timer bar
        if (!reduced) tabs[cur].classList.add('run');
      };
      tabs.forEach((t, k) => {
        t.addEventListener('click', () => show(k));
        // The timer bar finishing is what advances the slide, so hovering
        // (which pauses the bar) also pauses the carousel.
        t.addEventListener('animationend', (e) => { if (e.animationName === 'qFill') show(cur + 1); });
      });
      box.addEventListener('pointerenter', () => box.classList.add('paused'));
      box.addEventListener('pointerleave', () => box.classList.remove('paused'));
      box.addEventListener('focusin', () => box.classList.add('paused'));
      box.addEventListener('focusout', () => box.classList.remove('paused'));
      show(0);
    });
  };

  /* ---------------------------- lightbox --------------------------- */
  (function lightbox() {
    const box = document.getElementById('lightbox');
    if (!box) return;
    let items = [], idx = 0, opener = null;
    const ICON = {
      close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      prev: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
      next: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>'
    };
    function paint(dir) {
      const a = items[idx];
      const img = a.querySelector('img');
      box.innerHTML = '<button class="lb-btn lb-close" aria-label="Close">' + ICON.close + '</button>'
        + (items.length > 1 ? '<button class="lb-btn lb-prev" aria-label="Previous">' + ICON.prev + '</button><button class="lb-btn lb-next" aria-label="Next">' + ICON.next + '</button>' : '')
        + '<figure class="lb-fig"><img alt=""><figcaption></figcaption></figure>'
        + '<span class="lb-count">' + (idx + 1) + ' / ' + items.length + '</span>';
      const big = box.querySelector('.lb-fig img');
      big.src = a.getAttribute('href');
      big.alt = img ? img.alt : '';
      box.querySelector('figcaption').textContent = img ? img.alt : '';
      if (dir) big.classList.add(dir > 0 ? 'from-r' : 'from-l');
      box.querySelector('.lb-close').onclick = close;
      const pv = box.querySelector('.lb-prev'), nx = box.querySelector('.lb-next');
      if (pv) pv.onclick = (e) => { e.stopPropagation(); go(-1); };
      if (nx) nx.onclick = (e) => { e.stopPropagation(); go(1); };
    }
    function go(d) { idx = (idx + d + items.length) % items.length; paint(d); }
    function open() {
      paint(0);
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const c = box.querySelector('.lb-close'); if (c) c.focus();
    }
    function close() {
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (opener) opener.focus();
    }
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lightbox]');
      if (!a) return;
      e.preventDefault();
      items = [].slice.call(document.querySelectorAll('[data-lightbox="' + a.dataset.lightbox + '"]'));
      idx = Math.max(0, items.indexOf(a));
      opener = a;
      open();
    });
    box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lb-fig')) close(); });
    document.addEventListener('keydown', (e) => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && items.length > 1) go(1);
      if (e.key === 'ArrowLeft' && items.length > 1) go(-1);
    });
  })();

  /* ------------------------- initial pass -------------------------- */
  fadeImages(document);
  applyReveals(document);
  MKT.applyReveals = applyReveals;
})();
