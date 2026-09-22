/* =====================================================================
   Maai Ka Thekuaa — frontend core
   Handles API calls, site settings, routing, cart state, auth and layout.
   ===================================================================== */
(function () {
  'use strict';

  const MKT = window.MKT = {
    settings: {}, nav: [], pages: [], user: null,
    cart: [], routes: {}, currentPath: '/'
  };

  /* ------------------------------ API ------------------------------ */
  async function api(path, options = {}) {
    const opts = Object.assign({ headers: {} }, options);
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const token = localStorage.getItem('mkt_token');
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, opts);
    let data = {};
    try { data = await res.json(); } catch (e) { /* non json */ }
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }
  MKT.api = api;

  /* ---------------------------- helpers ---------------------------- */
  const esc = MKT.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const money = MKT.money = (n) => {
    const cur = (MKT.settings.general && MKT.settings.general.currency) || '₹';
    return cur + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  MKT.stars = function (rating, count) {
    const r = Math.round(Number(rating) || 0);
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= r ? '★' : '☆';
    return `<div class="stars">${s}${count !== undefined ? `<span>(${count})</span>` : ''}</div>`;
  };

  MKT.toast = function (msg, type) {
    const wrap = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; el.style.transition = '.3s'; }, 2600);
    setTimeout(() => el.remove(), 3000);
  };

  MKT.waLink = function (text) {
    const num = String((MKT.settings.contact && MKT.settings.contact.whatsapp) || '').replace(/\D/g, '');
    if (!num) return '#';
    return 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  MKT.dateStr = (s) => {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /* ----------------------------- cart ------------------------------ */
  function loadCart() {
    try { MKT.cart = JSON.parse(localStorage.getItem('mkt_cart') || '[]'); }
    catch (e) { MKT.cart = []; }
  }
  function saveCart() {
    localStorage.setItem('mkt_cart', JSON.stringify(MKT.cart));
    renderCartCount();
  }
  MKT.saveCart = saveCart;

  MKT.addToCart = function (product, qty, weight) {
    qty = Math.max(1, parseInt(qty || 1, 10));
    const opts = product.weight_options || [];
    const chosen = weight || (opts.length ? opts[0].label : product.weight);
    let price = product.effective_price;
    const found = opts.find((o) => o.label === chosen);
    if (found && Number(found.price) > 0) price = Number(found.price);
    const key = product.id + '|' + (chosen || '');
    const line = MKT.cart.find((i) => i.key === key);
    if (line) line.qty += qty;
    else MKT.cart.push({ key, product_id: product.id, name: product.name, slug: product.slug, image: product.image, weight: chosen || '', price, qty });
    saveCart();
    MKT.toast(product.name + ' added to cart', 'ok');
  };

  MKT.cartTotal = () => MKT.cart.reduce((s, i) => s + i.price * i.qty, 0);
  MKT.cartCount = () => MKT.cart.reduce((s, i) => s + i.qty, 0);

  function renderCartCount() {
    const el = document.getElementById('cartCount');
    const n = MKT.cartCount();
    el.textContent = n;
    el.classList.toggle('hidden', n === 0);
  }
  MKT.renderCartCount = renderCartCount;

  /* --------------------------- routing ----------------------------- */
  MKT.route = function (pattern, handler) { MKT.routes[pattern] = handler; };

  MKT.go = function (path, replace) {
    if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
    render();
  };

  function matchRoute(pathname) {
    if (MKT.routes[pathname]) return { handler: MKT.routes[pathname], params: {} };
    for (const pattern of Object.keys(MKT.routes)) {
      if (!pattern.includes(':')) continue;
      const keys = [];
      const rx = new RegExp('^' + pattern.replace(/:([A-Za-z_]+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      const m = rx.exec(pathname);
      if (m) {
        const params = {};
        keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { handler: MKT.routes[pattern], params };
      }
    }
    return null;
  }

  async function render() {
    const app = document.getElementById('app');
    const url = new URL(location.href);
    let pathname = url.pathname.replace(/\/+$/, '') || '/';
    MKT.currentPath = pathname;
    const query = Object.fromEntries(url.searchParams);
    const match = matchRoute(pathname);
    highlightNav(pathname);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (!match) {
      app.innerHTML = `<div class="wrap"><div class="empty"><div class="big">🪔</div><h2>Page not found</h2>
        <p>The page you are looking for does not exist.</p><a class="btn" href="/" data-link>Back to Home</a></div></div>`;
      return;
    }
    app.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>';
    try {
      await match.handler(app, match.params, query);
      document.dispatchEvent(new CustomEvent('mkt:rendered', { detail: { path: pathname } }));
    } catch (e) {
      app.innerHTML = `<div class="wrap"><div class="empty"><div class="big">😔</div><h2>Could not load this page</h2>
        <p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div></div>`;
    }
  }
  MKT.render = render;

  function highlightNav(pathname) {
    document.querySelectorAll('#navLinks a').forEach((a) => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === pathname || (href !== '/' && pathname.startsWith(href)));
    });
  }

  /* ------------------------ layout rendering ----------------------- */
  function applyTheme() {
    const t = MKT.settings.theme || {};
    const root = document.documentElement.style;
    const map = { primary: '--primary', secondary: '--secondary', accent: '--accent', background: '--bg', surface: '--surface', text: '--text', muted: '--muted', button: '--button', button_text: '--button-text', dark: '--dark' };
    Object.keys(map).forEach((k) => { if (t[k]) root.setProperty(map[k], t[k]); });
    if (t.radius) root.setProperty('--radius', parseInt(t.radius, 10) + 'px');

    const b = MKT.settings.branding || {};
    document.getElementById('brandLogo').src = b.logo || '/uploads/logo.svg';
    document.getElementById('brandLogo').alt = b.site_name || 'Maai Ka Thekuaa';
    if (b.favicon) document.getElementById('favicon').href = b.favicon;
    const seo = MKT.settings.seo || {};
    document.title = seo.title || (b.site_name || 'Maai Ka Thekuaa') + (b.tagline ? ' — ' + b.tagline : '');
  }

  function renderNav() {
    const nav = MKT.nav.length ? MKT.nav : [{ label: 'Home', link: '/' }];
    document.getElementById('navLinks').innerHTML = nav
      .map((n) => `<a href="${esc(n.link)}" ${n.link.startsWith('/') ? 'data-link' : 'target="_blank" rel="noopener"'}>${esc(n.label)}</a>`).join('');

    const b = MKT.settings.branding || {};
    document.getElementById('drawer').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <img src="${esc(b.logo || '/uploads/logo.svg')}" alt="" style="height:46px">
        <button class="icon-btn" id="drawerClose" aria-label="Close">✕</button>
      </div>
      ${nav.map((n) => `<a href="${esc(n.link)}" ${n.link.startsWith('/') ? 'data-link' : 'target="_blank" rel="noopener"'}>${esc(n.label)}</a>`).join('')}
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <a href="/cart" data-link>Cart (<span id="drawerCart">${MKT.cartCount()}</span>)</a>
      <a href="/orders" data-link>My Orders</a>
      <a href="#" id="drawerLogin">${MKT.user ? 'My Account' : 'Login / Register'}</a>
      <a class="btn wa block" style="margin-top:18px" href="${MKT.waLink('Namaste! I would like to order from Maai Ka Thekuaa.')}" target="_blank" rel="noopener">Chat on WhatsApp</a>`;
    document.getElementById('drawerClose').onclick = closeDrawer;
    document.getElementById('drawerLogin').onclick = (e) => { e.preventDefault(); closeDrawer(); MKT.openAuth(); };
  }

  const ROSETTE = '<svg class="sep" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><ellipse cx="12" cy="5.5" rx="2.2" ry="4.2"/><ellipse cx="12" cy="18.5" rx="2.2" ry="4.2"/><ellipse cx="5.5" cy="12" rx="4.2" ry="2.2"/><ellipse cx="18.5" cy="12" rx="4.2" ry="2.2"/><circle cx="12" cy="12" r="2"/></g></svg>';

  function renderKeywordStrip() {
    const el = document.getElementById('kwStrip');
    if (!el) return;
    const b = MKT.settings.branding || {};
    const words = [b.tagline].concat((MKT.footerCategories || []).map((c) => c.name)).filter(Boolean);
    if (!words.length) { el.hidden = true; return; }
    const run = words.map((w) => `<span>${esc(w)}</span>${ROSETTE}`).join('');
    el.innerHTML = `<div class="kw-track">${run}${run}${run}${run}</div>`;
  }

  function renderTopbar() {
    const d = MKT.settings.delivery || {};
    const c = MKT.settings.contact || {};
    const truck = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h11v10H2z"/><path d="M13 9h5l4 4v3h-9"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
    const phone = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
    document.getElementById('topbar').innerHTML =
      `<div class="tb-in"><span class="tb-item">${truck}<span>${esc(d.free_above ? 'Free delivery on orders above ' + money(d.free_above) : (d.eta || 'Delivered fresh across India'))}</span></span>
       ${c.phone ? `<a class="tb-item tb-phone" href="tel:${esc(c.phone)}">${phone}<span>${esc(c.phone)}</span></a>` : ''}</div>`;
  }

  function renderFooter() {
    const b = MKT.settings.branding || {};
    const c = MKT.settings.contact || {};
    const s = MKT.settings.social || {};
    const f = MKT.settings.footer || {};
    const cats = MKT.footerCategories || [];
    const socialIcon = (name) => ({
      instagram: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm6.9-11.1a1.55 1.55 0 1 1-1.55-1.55A1.55 1.55 0 0 1 18.9 5.2z"/></svg>',
      facebook: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"/></svg>',
      youtube: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12s0-3.3-.4-4.9a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.6 2.6 0 0 0-1.8 1.8C2 8.7 2 12 2 12s0 3.3.4 4.9a2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.3a2.6 2.6 0 0 0 1.8-1.8C22 15.3 22 12 22 12zM10 15V9l5.2 3z"/></svg>',
      x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.6 7.5L21.7 21h-5.9l-4.6-6-5.3 6H3l7-8L2.6 3h6l4.2 5.5zm-1 16h1.7L8.1 4.7H6.3z"/></svg>'
    })[name] || '';
    const socials = ['instagram', 'facebook', 'youtube', 'x']
      .filter((k) => s[k]).map((k) => `<a href="${esc(s[k])}" target="_blank" rel="noopener" title="${k}">${socialIcon(k)}</a>`).join('');

    document.getElementById('footer').innerHTML = `
    <div class="foot-mark" aria-hidden="true">${esc(b.site_name || 'Maai Ka Thekuaa')}</div>
    <div class="wrap">
      <div class="footer-grid">
        <div class="fbrand">
          <img src="${esc(b.logo || '/uploads/logo.svg')}" alt="${esc(b.site_name || '')}">
          <p style="margin-top:16px">${esc(f.about_text || b.brand_description || '')}</p>
          <div class="social-row">${socials}</div>
        </div>
        <div>
          <h4>${esc(f.quick_links_title || 'Quick Links')}</h4>
          ${(MKT.nav.length ? MKT.nav : []).map((n) => `<a href="${esc(n.link)}" ${n.link.startsWith('/') ? 'data-link' : ''}>${esc(n.label)}</a>`).join('')}
          <a href="/orders" data-link>My Orders</a>
          <a href="/track" data-link>Track Order</a>
        </div>
        <div>
          <h4>${esc(f.categories_title || 'Categories')}</h4>
          ${cats.map((c2) => `<a href="/products?category=${esc(c2.slug)}" data-link>${esc(c2.name)}</a>`).join('')}
        </div>
        <div>
          <h4>${esc(f.contact_title || 'Get in Touch')}</h4>
          <p>${esc(c.address || '')}</p>
          ${c.phone ? `<a href="tel:${esc(c.phone)}">📞 ${esc(c.phone)}</a>` : ''}
          ${c.email ? `<a href="mailto:${esc(c.email)}">✉ ${esc(c.email)}</a>` : ''}
          ${c.whatsapp ? `<a href="${MKT.waLink('Namaste!')}" target="_blank" rel="noopener">💬 WhatsApp us</a>` : ''}
          <p style="margin-top:10px">${esc(c.hours || '')}</p>
        </div>
      </div>
      <div class="footer-bottom">
        <span>${esc(b.footer_note || '© ' + new Date().getFullYear() + ' ' + (b.site_name || 'Maai Ka Thekuaa'))}</span>
        <span>
          ${MKT.pages.map((p) => `<a href="/page/${esc(p.slug)}" data-link style="display:inline;padding:0 10px">${esc(p.title)}</a>`).join('|')}
        </span>
      </div>
    </div>`;

    const wa = document.getElementById('waFloat');
    const link = MKT.waLink('Namaste! I would like to order from ' + (b.site_name || 'Maai Ka Thekuaa') + '.');
    wa.href = link;
    wa.style.display = link === '#' ? 'none' : 'grid';
  }
  MKT.renderFooter = renderFooter;
  MKT.renderNav = renderNav;

  /* ------------------------- auth modal ---------------------------- */
  MKT.closeModal = function () { document.getElementById('modalRoot').innerHTML = ''; };

  MKT.openModal = function (html) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal-backdrop" id="mb"><div class="modal">
      <button class="close-x" onclick="MKT.closeModal()">✕</button>${html}</div></div>`;
    document.getElementById('mb').addEventListener('click', (e) => { if (e.target.id === 'mb') MKT.closeModal(); });
  };

  MKT.openAuth = function (mode) {
    if (MKT.user) return MKT.go('/account');
    mode = mode || 'login';
    MKT.openModal(`
      <h3 style="text-align:center">Welcome to ${esc((MKT.settings.branding || {}).site_name || 'Maai Ka Thekuaa')}</h3>
      <div class="tab-switch">
        <button id="tabLogin" class="${mode === 'login' ? 'active' : ''}">Login</button>
        <button id="tabReg" class="${mode === 'register' ? 'active' : ''}">Register</button>
      </div>
      <div id="authErr" class="error-msg hidden"></div>
      <form id="loginForm" class="${mode === 'login' ? '' : 'hidden'}">
        <div class="field"><label>Email or Mobile number</label><input name="identifier" required autocomplete="username"></div>
        <div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn block" type="submit">Login</button>
        <p class="note" style="text-align:center;margin-top:14px">Demo account — anjali@example.com / demo123</p>
      </form>
      <form id="regForm" class="${mode === 'register' ? '' : 'hidden'}">
        <div class="field"><label>Full name</label><input name="name" required></div>
        <div class="field"><label>Email</label><input name="email" type="email" required></div>
        <div class="field"><label>Mobile number</label><input name="phone" required></div>
        <div class="field"><label>Password</label><input name="password" type="password" minlength="6" required autocomplete="new-password"></div>
        <button class="btn block" type="submit">Create account</button>
      </form>`);

    const err = document.getElementById('authErr');
    const show = (which) => {
      document.getElementById('loginForm').classList.toggle('hidden', which !== 'login');
      document.getElementById('regForm').classList.toggle('hidden', which !== 'register');
      document.getElementById('tabLogin').classList.toggle('active', which === 'login');
      document.getElementById('tabReg').classList.toggle('active', which === 'register');
      err.classList.add('hidden');
    };
    document.getElementById('tabLogin').onclick = () => show('login');
    document.getElementById('tabReg').onclick = () => show('register');

    const submit = async (form, url) => {
      const fd = Object.fromEntries(new FormData(form));
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const r = await api(url, { method: 'POST', body: fd });
        localStorage.setItem('mkt_token', r.token);
        MKT.user = r.user;
        MKT.closeModal();
        MKT.toast('Welcome, ' + r.user.name + '!', 'ok');
        renderNav();
        if (MKT.currentPath === '/checkout') render();
      } catch (e2) {
        err.textContent = e2.message; err.classList.remove('hidden');
      } finally { btn.disabled = false; }
    };
    document.getElementById('loginForm').onsubmit = (e) => { e.preventDefault(); submit(e.target, '/api/auth/login'); };
    document.getElementById('regForm').onsubmit = (e) => { e.preventDefault(); submit(e.target, '/api/auth/register'); };
  };

  MKT.logout = async function () {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    localStorage.removeItem('mkt_token');
    MKT.user = null;
    renderNav();
    MKT.toast('Logged out');
    MKT.go('/');
  };

  /* --------------------------- drawer ------------------------------ */
  function openDrawer() {
    document.getElementById('drawer').classList.add('open');
    document.getElementById('overlay').classList.add('open');
  }
  function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
  }

  /* --------------------------- startup ----------------------------- */
  MKT.start = async function () {
    loadCart();
    renderCartCount();

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-link]');
      if (a && a.getAttribute('href') && a.getAttribute('href').startsWith('/')) {
        e.preventDefault();
        closeDrawer();
        MKT.go(a.getAttribute('href'));
      }
    });
    window.addEventListener('popstate', render);

    document.getElementById('btnMenu').onclick = openDrawer;
    document.getElementById('overlay').onclick = closeDrawer;
    document.getElementById('btnUser').onclick = () => { MKT.user ? MKT.go('/account') : MKT.openAuth(); };
    document.getElementById('btnSearch').onclick = () => {
      const p = document.getElementById('searchPanel');
      p.classList.toggle('open');
      if (p.classList.contains('open')) document.getElementById('searchInput').focus();
    };
    document.getElementById('searchForm').onsubmit = (e) => {
      e.preventDefault();
      const q = document.getElementById('searchInput').value.trim();
      document.getElementById('searchPanel').classList.remove('open');
      MKT.go('/products' + (q ? '?search=' + encodeURIComponent(q) : ''));
    };

    const toTop = document.getElementById('toTop');
    if (toTop) {
      toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          toTop.classList.toggle('show', window.scrollY > 900);
          ticking = false;
        });
      });
    }

    try {
      const boot = await api('/api/bootstrap');
      MKT.settings = boot.settings; MKT.nav = boot.nav; MKT.pages = boot.pages;
    } catch (e) { console.error(e); }

    try { const cats = await api('/api/categories'); MKT.footerCategories = cats.categories; } catch (e) { MKT.footerCategories = []; }
    try { const me = await api('/api/auth/me'); MKT.user = me.user; } catch (e) { MKT.user = null; }

    applyTheme();
    renderKeywordStrip();
    renderTopbar();
    renderNav();
    renderFooter();
    render();
  };
})();
