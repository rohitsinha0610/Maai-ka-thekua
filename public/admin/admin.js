/* =====================================================================
   Maai Ka Thekuaa — Admin Panel
   Everything on the customer website can be managed from here.
   ===================================================================== */
(function () {
  'use strict';

  const TOKEN_KEY = 'mkt_admin_token';
  const S = { admin: null, view: 'dashboard', settings: {}, categories: [], counts: {} };

  /* ------------------------------ utils ------------------------------ */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const money = (n) => ((S.settings.general && S.settings.general.currency) || '₹') +
    Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const dateStr = (s) => {
    if (!s) return '—';
    const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'));
    return isNaN(d) ? s : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  function toast(msg, type) {
    const w = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    w.appendChild(el);
    setTimeout(() => { el.style.opacity = 0; el.style.transition = '.3s'; }, 2600);
    setTimeout(() => el.remove(), 3000);
  }

  async function api(path, options = {}) {
    const opts = Object.assign({ headers: {} }, options);
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) opts.headers['Authorization'] = 'Bearer ' + t;
    const res = await fetch(path, opts);
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401 && S.admin) { localStorage.removeItem(TOKEN_KEY); S.admin = null; renderLogin(); throw new Error('Session expired, please login again'); }
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Request failed');
    return data;
  }

  function q(id) { return document.getElementById(id); }

  /* --------------------------- modal helpers ------------------------- */
  function closeModal() {
    q('modalRoot').innerHTML = '';
    const picker = q('pickerRoot');
    if (picker) picker.innerHTML = '';
  }
  window.closeModal = closeModal;

  function openModal(html, wide) {
    q('modalRoot').innerHTML = `<div class="backdrop" id="bd"><div class="modal ${wide ? 'wide' : ''}">
      <button class="close-x" onclick="closeModal()">✕</button>${html}</div></div>`;
    q('bd').addEventListener('mousedown', (e) => { if (e.target.id === 'bd') closeModal(); });
  }

  function confirmBox(message, onYes) {
    openModal(`<h3>Please confirm</h3><p>${esc(message)}</p>
      <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn danger" id="cfYes">Yes, continue</button></div>`);
    q('cfYes').onclick = async () => { closeModal(); await onYes(); };
  }

  /* --------------------------- media picker -------------------------- */
  function closePicker() { q('pickerRoot').innerHTML = ''; }
  window.closePicker = closePicker;

  /**
   * Opens the media library on its OWN overlay layer and calls cb(url) with
   * the chosen image. It must not touch #modalRoot: the form that asked for
   * an image is still sitting there, and wiping it would throw away every
   * field the user has typed.
   */
  async function openPicker(cb) {
    let files = [];
    try { files = (await api('/api/admin/media')).files; }
    catch (e) { return toast(e.message, 'err'); }

    const grid = files.length
      ? `<div class="media-grid">${files.map((f) => `
          <div class="media-item" data-pick="${esc(f.url)}" title="${esc(f.name)}">
            <img src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy"></div>`).join('')}</div>`
      : '<p class="muted" style="padding:20px 0">No images uploaded yet. Use “Upload new” below.</p>';

    q('pickerRoot').innerHTML = `<div class="backdrop" id="pbd" style="z-index:150">
      <div class="modal wide">
        <button class="close-x" onclick="closePicker()">✕</button>
        <h3>Media library</h3>
        <p class="muted" style="margin-top:-6px">Click an image to use it.</p>
        ${grid}
        <div class="modal-foot">
          <button type="button" class="btn ghost" onclick="closePicker()">Cancel</button>
          <button type="button" class="btn" id="pickerUpload">Upload new</button>
        </div>
      </div></div>`;

    q('pbd').addEventListener('mousedown', (e) => { if (e.target.id === 'pbd') closePicker(); });
    q('pickerRoot').querySelectorAll('[data-pick]').forEach((it) => {
      it.onclick = () => { const url = it.dataset.pick; closePicker(); cb(url); };
    });
    q('pickerUpload').onclick = () => pickImage((url) => { closePicker(); cb(url); });
  }

  /* --------------------------- image uploads ------------------------- */
  function pickImage(cb) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const r = await api('/api/admin/upload', { method: 'POST', body: { data: fr.result, name: f.name.replace(/\.[^.]+$/, '') } });
          cb(r.url);
          toast('Image uploaded', 'ok');
        } catch (e) { toast(e.message, 'err'); }
      };
      fr.readAsDataURL(f);
    };
    inp.click();
  }

  function imageField(name, label, value, hint) {
    return `<div class="field"><label>${esc(label)}</label>
      <div class="img-picker">
        <img class="preview" id="prev_${name}" src="${esc(value || '/uploads/placeholder.svg')}" alt="">
        <div>
          <button type="button" class="btn ghost sm" data-upload="${name}">Upload image</button>
          <button type="button" class="btn ghost sm" data-library="${name}">Media library</button>
          <input type="hidden" name="${name}" id="in_${name}" value="${esc(value || '')}">
          <div class="hint">${esc(hint || 'PNG, JPG, WEBP or SVG. Max 5 MB.')}</div>
        </div>
      </div></div>`;
  }

  function bindImageFields(scope) {
    scope.querySelectorAll('[data-upload]').forEach((b) => {
      b.onclick = () => pickImage((url) => {
        q('in_' + b.dataset.upload).value = url;
        q('prev_' + b.dataset.upload).src = url;
      });
    });
    scope.querySelectorAll('[data-library]').forEach((b) => {
      b.onclick = () => openPicker((url) => {
        const input = q('in_' + b.dataset.library);
        const prev = q('prev_' + b.dataset.library);
        if (input) input.value = url;
        if (prev) prev.src = url;
        toast('Image selected', 'ok');
      });
    });
  }

  /* ------------------------- generic CRUD form ----------------------- */
  /** fields: [{name,label,type,options,hint,full}] */
  function fieldHtml(f, v) {
    const val = v === undefined || v === null ? (f.def !== undefined ? f.def : '') : v;
    switch (f.type) {
      case 'textarea':
        return `<div class="field"><label>${esc(f.label)}</label><textarea name="${f.name}" ${f.rows ? `style="min-height:${f.rows * 22}px"` : ''} placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
      case 'select':
        return `<div class="field"><label>${esc(f.label)}</label><select name="${f.name}">
          ${f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
      case 'checkbox':
        return `<div class="switch"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''} id="cb_${f.name}"><label for="cb_${f.name}" style="margin:0">${esc(f.label)}</label></div>`;
      case 'image':
        return imageField(f.name, f.label, val, f.hint);
      case 'color':
        return `<div class="field"><label>${esc(f.label)}</label><div class="color-row">
          <input type="color" value="${esc(val || '#B23A18')}" onchange="this.nextElementSibling.value=this.value">
          <input type="text" name="${f.name}" value="${esc(val)}"></div></div>`;
      case 'number':
        return `<div class="field"><label>${esc(f.label)}</label><input type="number" step="${f.step || 'any'}" name="${f.name}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
      case 'date':
        return `<div class="field"><label>${esc(f.label)}</label><input type="date" name="${f.name}" value="${esc(val)}"></div>`;
      default:
        return `<div class="field"><label>${esc(f.label)}</label><input name="${f.name}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
    }
  }

  function formValues(form, fields) {
    const out = {};
    fields.forEach((f) => {
      const el = form.querySelector(`[name="${f.name}"]`);
      if (!el) return;
      if (f.type === 'checkbox') out[f.name] = el.checked ? 1 : 0;
      else if (f.type === 'number') out[f.name] = el.value === '' ? 0 : Number(el.value);
      else out[f.name] = el.value;
    });
    return out;
  }

  function crudModal({ title, fields, item, endpoint, after, extraHtml, wide }) {
    const isEdit = item && item.id;
    openModal(`<h3>${esc(title)}</h3>
      <form id="crudForm">
        <div id="crudErr"></div>
        ${fields.map((f) => fieldHtml(f, item ? item[f.name] : undefined)).join('')}
        ${extraHtml || ''}
        <div class="modal-foot">
          <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
          <button class="btn" type="submit">${isEdit ? 'Save changes' : 'Create'}</button>
        </div>
      </form>`, wide);
    bindImageFields(q('modalRoot'));
    q('crudForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const body = formValues(e.target, fields);
        await api(endpoint + (isEdit ? '/' + item.id : ''), { method: isEdit ? 'PUT' : 'POST', body });
        closeModal();
        toast('Saved successfully', 'ok');
        if (after) after();
      } catch (err) {
        q('crudErr').innerHTML = `<div class="pill red" style="display:block;margin-bottom:10px">${esc(err.message)}</div>`;
        btn.disabled = false;
      }
    };
  }

  async function del(endpoint, message, after) {
    confirmBox(message, async () => {
      try { await api(endpoint, { method: 'DELETE' }); toast('Deleted', 'ok'); after(); }
      catch (e) { toast(e.message, 'err'); }
    });
  }

  /* ---------------------- drag & drop reordering --------------------- */
  function makeSortable(container, onDrop) {
    let dragged = null;
    container.querySelectorAll('.row-item').forEach((row) => {
      row.draggable = true;
      row.ondragstart = () => { dragged = row; row.classList.add('dragging'); };
      row.ondragend = () => { row.classList.remove('dragging'); onDrop(); };
      row.ondragover = (e) => {
        e.preventDefault();
        if (!dragged || dragged === row) return;
        const rect = row.getBoundingClientRect();
        const after = (e.clientY - rect.top) / rect.height > 0.5;
        container.insertBefore(dragged, after ? row.nextSibling : row);
      };
    });
  }

  async function saveOrder(table, container, reload) {
    const ids = [...container.querySelectorAll('.row-item')].map((r) => r.dataset.id);
    try { await api(`/api/admin/${table}/reorder`, { method: 'POST', body: { ids } }); toast('Order saved', 'ok'); if (reload) reload(); }
    catch (e) { toast(e.message, 'err'); }
  }

  /* =============================== LOGIN ============================= */
  function renderLogin(msg) {
    q('root').innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <img src="/uploads/logo.svg" alt="Maai Ka Thekuaa">
      <h2>Admin Panel</h2>
      <p class="sub">Sign in to manage your store</p>
      <div id="loginErr">${msg ? `<div class="pill red" style="display:block;margin-bottom:12px">${esc(msg)}</div>` : ''}</div>
      <form id="loginForm">
        <div class="field"><label>Email or username</label><input name="identifier" required autocomplete="username" value="admin@maaikathekuaa.com"></div>
        <div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password" value=""></div>
        <button class="btn block" type="submit">Login</button>
      </form>
      <p style="margin-top:10px"><a href="/" class="muted" style="font-size:.85rem">← Back to website</a></p>
    </div></div>`;
    q('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        const r = await api('/api/admin/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        localStorage.setItem(TOKEN_KEY, r.token);
        S.admin = r.admin;
        await boot();
      } catch (err) {
        q('loginErr').innerHTML = `<div class="pill red" style="display:block;margin-bottom:12px">${esc(err.message)}</div>`;
        btn.disabled = false;
      }
    };
  }

  /* =============================== SHELL ============================= */
  const MENU = [
    { group: 'Overview' },
    { key: 'dashboard', label: 'Dashboard', ico: '📊' },
    { key: 'orders', label: 'Orders', ico: '🧾', count: 'pending_orders' },
    { group: 'Catalogue' },
    { key: 'products', label: 'Products', ico: '🍪' },
    { key: 'categories', label: 'Categories', ico: '🗂' },
    { key: 'inventory', label: 'Inventory', ico: '📦', count: 'low_stock' },
    { group: 'Customers' },
    { key: 'customers', label: 'Customers', ico: '👥' },
    { key: 'reviews', label: 'Reviews', ico: '⭐', count: 'pending_reviews' },
    { key: 'messages', label: 'Messages', ico: '✉', count: 'unread_messages' },
    { group: 'Marketing' },
    { key: 'coupons', label: 'Offers & Coupons', ico: '🎟' },
    { key: 'banners', label: 'Banners', ico: '🖼' },
    { group: 'Website (CMS)' },
    { key: 'branding', label: 'Branding & Colors', ico: '🎨' },
    { key: 'navbar', label: 'Navbar', ico: '🧭' },
    { key: 'homepage', label: 'Homepage Sections', ico: '🏠' },
    { key: 'cards', label: 'Cards & Gallery', ico: '🃏' },
    { key: 'story', label: 'Story (Maai Ki Kahani)', ico: '📖' },
    { key: 'pages', label: 'Policy Pages', ico: '📄' },
    { key: 'media', label: 'Media Library', ico: '🗃' },
    { group: 'Configuration' },
    { key: 'settings', label: 'Store Settings', ico: '⚙' },
    { key: 'account', label: 'Admin Account', ico: '🔐' }
  ];

  function renderShell() {
    const b = S.settings.branding || {};
    q('root').innerHTML = `
    <div class="layout">
      <aside class="sidebar" id="sidebar">
        <div class="logo"><img src="${esc(b.logo || '/uploads/logo.svg')}" alt=""><span>${esc(b.site_name || 'Maai Ka Thekuaa')}<br><small style="font-size:.7rem;opacity:.7">Admin Panel</small></span></div>
        <div id="menu"></div>
        <div style="margin-top:22px;padding:0 8px">
          <a class="btn ghost block sm" href="/" target="_blank">View website ↗</a>
          <button class="btn dark block sm" id="logoutBtn" style="margin-top:8px">Logout</button>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <button class="btn ghost sm burger" id="burger">☰</button>
          <h1 id="pageTitle">Dashboard</h1>
          <div class="spacer"></div>
          <span class="muted" style="font-size:.85rem">${esc(S.admin.name || S.admin.username)}</span>
        </div>
        <div class="content" id="view"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    </div>`;
    renderMenu();
    q('logoutBtn').onclick = async () => {
      try { await api('/api/admin/logout', { method: 'POST' }); } catch (e) {}
      localStorage.removeItem(TOKEN_KEY);
      S.admin = null;
      renderLogin('You have been logged out.');
    };
    q('burger').onclick = () => q('sidebar').classList.toggle('open');
  }

  function renderMenu() {
    q('menu').innerHTML = MENU.map((m) => {
      if (m.group) return `<div class="group">${esc(m.group)}</div>`;
      const c = m.count && S.counts[m.count] ? `<span class="cnt">${S.counts[m.count]}</span>` : '';
      return `<a class="nav ${S.view === m.key ? 'active' : ''}" data-view="${m.key}"><span class="ico">${m.ico}</span>${esc(m.label)}${c}</a>`;
    }).join('');
    q('menu').querySelectorAll('[data-view]').forEach((a) => {
      a.onclick = () => { go(a.dataset.view); q('sidebar').classList.remove('open'); };
    });
  }

  /* ---------------------- motion helpers ---------------------- */
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Counts a number up from zero. Keeps currency symbols and suffixes.
   *  Runs once per element - re-entry would read a half-counted value. */
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const text = el.textContent.trim();
    const m = text.match(/^([^\d-]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    const target = Number(m[2].replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;
    const decimals = (m[2].split('.')[1] || '').length;
    const start = performance.now();
    const dur = 750;
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = m[1] + val.toLocaleString('en-IN', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      }) + m[3];
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = text;
    };
    requestAnimationFrame(step);
  }

  /** Staggers entrance animations and runs the counters for a rendered view. */
  function animateView(el) {
    if (REDUCED) return;
    el.querySelectorAll('.card.stat').forEach((c, i) => c.style.setProperty('--d', (i * 60) + 'ms'));
    el.querySelectorAll('tbody tr').forEach((r, i) => r.style.setProperty('--d', Math.min(i * 35, 500) + 'ms'));
    el.querySelectorAll('.sort-list .row-item').forEach((r, i) => r.style.setProperty('--d', Math.min(i * 45, 600) + 'ms'));
    el.querySelectorAll('.bars .b .fill').forEach((b, i) => b.style.setProperty('--d', (i * 45) + 'ms'));
    el.querySelectorAll('.card.stat .value').forEach(countUp);
  }

  const VIEWS = {};
  function go(view) {
    S.view = view;
    location.hash = view;
    renderMenu();
    const item = MENU.find((m) => m.key === view);
    q('pageTitle').textContent = item ? item.label : 'Dashboard';
    const el = q('view');
    el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    Promise.resolve(VIEWS[view] ? VIEWS[view](el) : el.innerHTML = '<div class="empty">Not found</div>')
      .then(() => {
        if (!REDUCED) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
        animateView(el);
        // Tables that load after the first paint get their stagger too.
        setTimeout(() => animateView(el), 350);
      })
      .catch((e) => { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
  }

  /* ============================ DASHBOARD =========================== */
  VIEWS.dashboard = async (el) => {
    const d = await api('/api/admin/stats');
    S.counts = d.stats;
    renderMenu();
    const maxSale = Math.max(1, ...d.sales_chart.map((r) => r.amount));
    const statusColors = { Pending: '#7C6A5C', Confirmed: '#23528f', Preparing: '#E8892B', 'Out for Delivery': '#2d68c4', Shipped: '#2d68c4', Delivered: '#1a7f43', Cancelled: '#C0392B' };
    const totalStatus = d.status_chart.reduce((s, r) => s + r.n, 0) || 1;
    let acc = 0;
    const donut = d.status_chart.map((r) => {
      const frac = r.n / totalStatus;
      const dash = `${(frac * 314).toFixed(1)} 314`;
      const seg = `<circle r="50" cx="60" cy="60" fill="transparent" stroke="${statusColors[r.status] || '#999'}" stroke-width="18"
        stroke-dasharray="${dash}" stroke-dashoffset="${(-acc * 314).toFixed(1)}" transform="rotate(-90 60 60)"/>`;
      acc += frac;
      return seg;
    }).join('');

    el.innerHTML = `
    <div class="grid g4 section-gap">
      <div class="card stat"><span class="label">Total Orders</span><span class="value">${d.stats.total_orders}</span><span class="sub">${d.stats.today_orders} today</span></div>
      <div class="card stat gold"><span class="label">Total Sales</span><span class="value">${money(d.stats.total_sales)}</span><span class="sub">${money(d.stats.today_sales)} today</span></div>
      <div class="card stat"><span class="label">Pending Orders</span><span class="value">${d.stats.pending_orders}</span><span class="sub">${d.stats.completed_orders} delivered</span></div>
      <div class="card stat green"><span class="label">Customers</span><span class="value">${d.stats.total_customers}</span><span class="sub">${d.stats.total_products} products</span></div>
    </div>

    <div class="grid g4 section-gap">
      <div class="card stat dark"><span class="label">Active Products</span><span class="value">${d.stats.active_products}</span></div>
      <div class="card stat dark"><span class="label">Categories</span><span class="value">${d.stats.total_categories}</span></div>
      <div class="card stat dark"><span class="label">Pending Reviews</span><span class="value">${d.stats.pending_reviews}</span></div>
      <div class="card stat dark"><span class="label">Low Stock Items</span><span class="value">${d.stats.low_stock}</span></div>
    </div>

    <div class="grid g2 section-gap" style="grid-template-columns:1.6fr 1fr">
      <div class="card chart-box">
        <h3>Sales — last 14 days</h3>
        <div class="bars">
          ${d.sales_chart.length ? d.sales_chart.map((r) => `
            <div class="b" title="${esc(r.day)}: ${money(r.amount)}">
              <div class="fill" style="height:${Math.max(3, (r.amount / maxSale) * 165)}px"></div>
              <div class="lbl">${esc(r.day.slice(5))}</div>
            </div>`).join('') : '<p class="muted">No sales data yet.</p>'}
        </div>
      </div>
      <div class="card chart-box">
        <h3>Orders by status</h3>
        <svg viewBox="0 0 120 120" width="170" height="170" style="margin:0 auto">${donut}
          <circle r="34" cx="60" cy="60" fill="#fff"/>
          <text x="60" y="58" text-anchor="middle" font-size="17" font-family="Marcellus, serif" fill="#B23A18">${d.stats.total_orders}</text>
          <text x="60" y="72" text-anchor="middle" font-size="8" fill="#7C6A5C">orders</text>
        </svg>
        <div class="legend">${d.status_chart.map((r) => `<span><i style="background:${statusColors[r.status] || '#999'}"></i>${esc(r.status)} (${r.n})</span>`).join('')}</div>
      </div>
    </div>

    <div class="grid g2">
      <div class="card pad">
        <h3>Recent orders</h3>
        <div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${d.recent_orders.map((o) => `<tr>
          <td><b>${esc(o.order_code)}</b><div class="muted" style="font-size:.75rem">${dateStr(o.created_at)}</div></td>
          <td>${esc(o.customer_name)}</td><td>${money(o.total)}</td>
          <td><span class="pill ${o.status === 'Delivered' ? 'green' : o.status === 'Cancelled' ? 'red' : 'gold'}">${esc(o.status)}</span></td>
        </tr>`).join('') || '<tr><td colspan="4" class="muted">No orders yet</td></tr>'}</tbody></table></div>
        <button class="btn ghost sm" style="margin-top:12px" onclick="ADMIN.go('orders')">View all orders</button>
      </div>
      <div class="card pad">
        <h3>Best sellers</h3>
        <div class="table-wrap"><table><thead><tr><th>Product</th><th>Sold</th><th>Stock</th></tr></thead>
        <tbody>${d.best_sellers.map((p) => `<tr><td>${esc(p.name)}</td><td><b>${p.sold_count}</b></td>
          <td>${p.stock <= 5 ? `<span class="pill red">${p.stock}</span>` : p.stock}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">—</td></tr>'}</tbody></table></div>
        ${d.low_stock_items.length ? `<h3 style="margin-top:20px">Low stock alert</h3>
          <div class="table-wrap"><table><tbody>${d.low_stock_items.map((p) => `<tr><td>${esc(p.name)}</td><td class="right"><span class="pill red">${p.stock} left</span></td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>
    </div>`;
  };

  /* ============================== ORDERS ============================ */
  VIEWS.orders = async (el) => {
    let status = 'all', search = '';
    async function load() {
      const r = await api(`/api/admin/orders?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`);
      q('ordersBody').innerHTML = r.items.map((o) => `<tr>
        <td><b>${esc(o.order_code)}</b><div class="muted" style="font-size:.75rem">${dateStr(o.created_at)}</div></td>
        <td>${esc(o.customer_name)}<div class="muted" style="font-size:.78rem">${esc(o.phone)}</div></td>
        <td>${o.items.length} item(s)</td>
        <td><b>${money(o.total)}</b><div class="muted" style="font-size:.75rem">${esc(o.payment_method.toUpperCase())} · ${esc(o.payment_status)}</div></td>
        <td><span class="pill ${o.status === 'Delivered' ? 'green' : o.status === 'Cancelled' ? 'red' : o.status === 'Pending' ? 'grey' : 'gold'}">${esc(o.status)}</span></td>
        <td class="actions-cell">
          <button class="btn ghost sm" data-view-order="${o.id}">View</button>
          <button class="btn danger sm" data-del-order="${o.id}">Delete</button>
        </td></tr>`).join('') || '<tr><td colspan="6" class="muted">No orders found</td></tr>';

      q('ordersBody').querySelectorAll('[data-view-order]').forEach((b) => {
        b.onclick = () => openOrder(r.items.find((x) => String(x.id) === b.dataset.viewOrder), r.statuses, r.payment_statuses, load);
      });
      q('ordersBody').querySelectorAll('[data-del-order]').forEach((b) => {
        b.onclick = () => del('/api/admin/orders/' + b.dataset.delOrder, 'Delete this order permanently?', load);
      });
    }

    el.innerHTML = `
    <div class="toolbar">
      <select id="stFilter">
        ${['all', 'Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Shipped', 'Delivered', 'Cancelled']
        .map((s) => `<option value="${s}">${s === 'all' ? 'All statuses' : s}</option>`).join('')}
      </select>
      <input id="oSearch" placeholder="Search order ID, name or mobile…" style="flex:1;min-width:200px">
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="ordersBody"><tr><td colspan="6" class="muted">Loading…</td></tr></tbody>
    </table></div></div>`;

    q('stFilter').onchange = (e) => { status = e.target.value; load(); };
    let t;
    q('oSearch').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { search = e.target.value.trim(); load(); }, 300); };
    await load();
  };

  function openOrder(o, statuses, payStatuses, reload) {
    openModal(`<h3>Order ${esc(o.order_code)}</h3>
      <div class="grid g2">
        <div>
          <p class="muted" style="margin:0">Placed on ${dateStr(o.created_at)}</p>
          <h4 style="margin:14px 0 6px">Customer</h4>
          <p style="margin:0">${esc(o.customer_name)}<br>${esc(o.phone)}${o.email ? '<br>' + esc(o.email) : ''}</p>
          <h4 style="margin:14px 0 6px">Delivery address</h4>
          <p style="margin:0">${esc(o.address)}<br>${esc(o.city)}, ${esc(o.state)} — ${esc(o.pincode)}${o.landmark ? '<br>Landmark: ' + esc(o.landmark) : ''}</p>
          ${o.notes ? `<h4 style="margin:14px 0 6px">Notes</h4><p style="margin:0">${esc(o.notes)}</p>` : ''}
        </div>
        <div>
          <h4 style="margin:0 0 6px">Items</h4>
          <table><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}${i.weight ? ' <span class="muted">(' + esc(i.weight) + ')</span>' : ''}</td>
            <td class="right">${i.qty} × ${money(i.price)}</td><td class="right"><b>${money(i.line_total)}</b></td></tr>`).join('')}</tbody></table>
          <table style="margin-top:10px"><tbody>
            <tr><td>Subtotal</td><td class="right">${money(o.subtotal)}</td></tr>
            ${o.discount ? `<tr><td>Discount ${o.coupon_code ? '(' + esc(o.coupon_code) + ')' : ''}</td><td class="right">− ${money(o.discount)}</td></tr>` : ''}
            <tr><td>Delivery</td><td class="right">${money(o.delivery_charge)}</td></tr>
            ${o.tax ? `<tr><td>Tax</td><td class="right">${money(o.tax)}</td></tr>` : ''}
            <tr><td><b>Total</b></td><td class="right"><b>${money(o.total)}</b></td></tr>
          </tbody></table>
        </div>
      </div>
      <hr style="border:0;border-top:1px solid var(--a-line);margin:18px 0">
      <div class="fgrid3">
        <div class="field"><label>Order status</label><select id="oStatus">${statuses.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Payment status</label><select id="oPay">${payStatuses.map((s) => `<option ${s === o.payment_status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Internal notes</label><input id="oNotes" value="${esc(o.notes || '')}"></div>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" onclick="window.print()">Print</button>
        <button class="btn" id="saveOrder">Update order</button>
      </div>`, true);
    q('saveOrder').onclick = async () => {
      try {
        await api('/api/admin/orders/' + o.id, { method: 'PUT', body: { status: q('oStatus').value, payment_status: q('oPay').value, notes: q('oNotes').value } });
        closeModal(); toast('Order updated', 'ok'); reload();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  /* ============================= PRODUCTS =========================== */
  VIEWS.products = async (el) => {
    const cats = (await api('/api/admin/categories')).items;
    S.categories = cats;
    let filter = { search: '', category: '', status: '' };

    async function load() {
      const r = await api(`/api/admin/products?search=${encodeURIComponent(filter.search)}&category=${filter.category}&status=${filter.status}`);
      q('prodBody').innerHTML = r.items.map((p) => `<tr>
        <td><img class="thumb" src="${esc(p.image)}" alt=""></td>
        <td><b>${esc(p.name)}</b><div class="muted" style="font-size:.76rem">${esc(p.category || 'No category')} · ${esc(p.weight || '')}</div></td>
        <td>${money(p.effective_price)}${p.discount_percent ? `<div class="muted" style="font-size:.75rem;text-decoration:line-through">${money(p.price)}</div>` : ''}</td>
        <td>${p.stock <= p.low_stock_alert ? `<span class="pill red">${p.stock}</span>` : p.stock}</td>
        <td>${p.sold_count}</td>
        <td><span class="pill ${p.active ? 'green' : 'grey'}">${p.active ? 'Active' : 'Hidden'}</span>
            ${p.featured ? '<span class="pill gold">Featured</span>' : ''}</td>
        <td class="actions-cell">
          <button class="btn ghost sm" data-edit="${p.id}">Edit</button>
          <button class="btn danger sm" data-del="${p.id}">Delete</button>
        </td></tr>`).join('') || '<tr><td colspan="7" class="muted">No products</td></tr>';

      q('prodBody').querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = async () => {
          const item = (await api('/api/admin/products/' + b.dataset.edit)).item;
          productForm(item, load);
        };
      });
      q('prodBody').querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => del('/api/admin/products/' + b.dataset.del, 'Delete this product? This cannot be undone.', load);
      });
    }

    el.innerHTML = `
    <div class="toolbar">
      <button class="btn" id="addProd">+ Add Product</button>
      <input id="pSearch" placeholder="Search products…" style="flex:1;min-width:180px">
      <select id="pCat"><option value="">All categories</option>${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <select id="pStatus"><option value="">All</option><option value="active">Active only</option><option value="inactive">Hidden only</option><option value="low">Low stock</option></select>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th></th><th>Product</th><th>Price</th><th>Stock</th><th>Sold</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="prodBody"><tr><td colspan="7" class="muted">Loading…</td></tr></tbody>
    </table></div></div>`;

    q('addProd').onclick = () => productForm(null, load);
    let t;
    q('pSearch').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { filter.search = e.target.value.trim(); load(); }, 300); };
    q('pCat').onchange = (e) => { filter.category = e.target.value; load(); };
    q('pStatus').onchange = (e) => { filter.status = e.target.value; load(); };
    await load();
  };

  function productForm(item, reload) {
    const cats = S.categories;
    const images = item ? (item.images || []).filter((u) => u && !u.includes('placeholder')) : [];
    const opts = item ? (item.weight_options || []) : [];
    openModal(`<h3>${item ? 'Edit product' : 'Add product'}</h3>
      <form id="pForm">
        <div id="pErr"></div>
        <div class="fgrid2">
          <div class="field"><label>Product name *</label><input name="name" required value="${esc(item ? item.name : '')}"></div>
          <div class="field"><label>Category</label><select name="category_id">
            <option value="">— none —</option>
            ${cats.map((c) => `<option value="${c.id}" ${item && item.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select></div>
        </div>
        <div class="fgrid3">
          <div class="field"><label>Price (MRP) *</label><input type="number" step="0.01" name="price" required value="${item ? item.price : ''}"></div>
          <div class="field"><label>Discount price</label><input type="number" step="0.01" name="discount_price" value="${item ? item.discount_price : 0}"><div class="hint">0 = no discount</div></div>
          <div class="field"><label>Weight / quantity</label><input name="weight" value="${esc(item ? item.weight : '')}" placeholder="500 g"></div>
        </div>
        <div class="fgrid3">
          <div class="field"><label>Stock</label><input type="number" name="stock" value="${item ? item.stock : 0}"></div>
          <div class="field"><label>Low stock alert at</label><input type="number" name="low_stock_alert" value="${item ? item.low_stock_alert : 5}"></div>
          <div class="field"><label>Display order</label><input type="number" name="sort_order" value="${item ? item.sort_order : 0}"></div>
        </div>
        <div class="field"><label>Short description</label><input name="short_desc" value="${esc(item ? item.short_desc : '')}"></div>
        <div class="field"><label>Full description</label><textarea name="description">${esc(item ? item.description : '')}</textarea></div>
        <div class="fgrid2">
          <div class="field"><label>Ingredients</label><textarea name="ingredients">${esc(item ? item.ingredients : '')}</textarea></div>
          <div class="field"><label>Nutritional information</label><textarea name="nutrition">${esc(item ? item.nutrition : '')}</textarea></div>
        </div>

        <div class="field"><label>Weight options &amp; prices</label>
          <div id="wtRows">${opts.map((o, i) => wtRow(o, i)).join('')}</div>
          <button type="button" class="btn ghost sm" id="addWt">+ Add weight option</button>
          <div class="hint">Customers can choose these on the product page. Leave empty to use a single price.</div>
        </div>

        <div class="field"><label>Product images</label>
          <div class="multi-img" id="imgList">${images.map((u) => imgChip(u)).join('')}</div>
          <button type="button" class="btn ghost sm" id="addImg" style="margin-top:8px">+ Upload image</button>
          <button type="button" class="btn ghost sm" id="libImg" style="margin-top:8px">Media library</button>
        </div>

        <div class="switch"><input type="checkbox" name="active" id="pActive" ${!item || item.active ? 'checked' : ''}><label for="pActive" style="margin:0">Product is visible on the website</label></div>
        <div class="switch"><input type="checkbox" name="featured" id="pFeat" ${item && item.featured ? 'checked' : ''}><label for="pFeat" style="margin:0">Mark as featured / bestseller</label></div>

        <div class="modal-foot">
          <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
          <button class="btn" type="submit">${item ? 'Save changes' : 'Create product'}</button>
        </div>
      </form>`, true);

    function wtRow(o, i) {
      return `<div class="fgrid2 wt-row" style="align-items:end">
        <div class="field"><label>Label</label><input class="wt-label" value="${esc(o ? o.label : '')}" placeholder="500 g"></div>
        <div class="field" style="display:flex;gap:8px;align-items:flex-end">
          <div style="flex:1"><label>Price</label><input type="number" step="0.01" class="wt-price" value="${o ? o.price : ''}"></div>
          <button type="button" class="btn danger sm rm-wt" style="margin-bottom:14px">✕</button>
        </div></div>`;
    }
    function imgChip(u) { return `<div class="mi"><img src="${esc(u)}" alt=""><button type="button" class="rm-img">✕</button></div>`; }

    function bindWt() {
      q('wtRows').querySelectorAll('.rm-wt').forEach((b) => b.onclick = () => { b.closest('.wt-row').remove(); });
    }
    function bindImgs() {
      q('imgList').querySelectorAll('.rm-img').forEach((b) => b.onclick = () => b.closest('.mi').remove());
    }
    bindWt(); bindImgs();

    q('addWt').onclick = () => { q('wtRows').insertAdjacentHTML('beforeend', wtRow(null)); bindWt(); };
    q('addImg').onclick = () => pickImage((url) => { q('imgList').insertAdjacentHTML('beforeend', imgChip(url)); bindImgs(); });
    q('libImg').onclick = () => openPicker((url) => {
      q('imgList').insertAdjacentHTML('beforeend', imgChip(url));
      bindImgs();
      toast('Image added', 'ok');
    });

    async function submit(e) {
      e.preventDefault();
      const f = e.target;
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      const weight_options = [...q('wtRows').querySelectorAll('.wt-row')].map((r) => ({
        label: r.querySelector('.wt-label').value.trim(),
        price: Number(r.querySelector('.wt-price').value || 0)
      })).filter((o) => o.label);
      const images = [...q('imgList').querySelectorAll('img')].map((i) => i.getAttribute('src'));
      const body = {
        name: f.name.value, category_id: f.category_id.value || null,
        price: Number(f.price.value || 0), discount_price: Number(f.discount_price.value || 0),
        weight: f.weight.value, stock: Number(f.stock.value || 0),
        low_stock_alert: Number(f.low_stock_alert.value || 0), sort_order: Number(f.sort_order.value || 0),
        short_desc: f.short_desc.value, description: f.description.value,
        ingredients: f.ingredients.value, nutrition: f.nutrition.value,
        weight_options, images,
        active: f.active.checked ? 1 : 0, featured: f.featured.checked ? 1 : 0
      };
      try {
        await api('/api/admin/products' + (item ? '/' + item.id : ''), { method: item ? 'PUT' : 'POST', body });
        closeModal(); toast('Product saved', 'ok'); reload();
      } catch (err) {
        q('pErr').innerHTML = `<div class="pill red" style="display:block;margin-bottom:10px">${esc(err.message)}</div>`;
        btn.disabled = false;
      }
    }
    q('pForm').onsubmit = submit;
  }

  /* ============================ CATEGORIES ========================== */
  VIEWS.categories = async (el) => {
    async function load() {
      const r = await api('/api/admin/categories');
      q('catList').innerHTML = r.items.map((c) => `
        <div class="row-item" data-id="${c.id}">
          <span class="handle">⠿</span>
          <img src="${esc(c.image || '/uploads/placeholder.svg')}" alt="">
          <div class="grow"><b>${esc(c.name)}</b><div class="muted" style="font-size:.8rem">${esc(c.description || '')}</div></div>
          <span class="pill ${c.active ? 'green' : 'grey'}">${c.active ? 'Active' : 'Hidden'}</span>
          <button class="btn ghost sm" data-edit="${c.id}">Edit</button>
          <button class="btn danger sm" data-del="${c.id}">Delete</button>
        </div>`).join('') || '<div class="empty">No categories yet.</div>';

      const fields = [
        { name: 'name', label: 'Category name *' },
        { name: 'description', label: 'Short description', type: 'textarea' },
        { name: 'image', label: 'Category image', type: 'image' },
        { name: 'sort_order', label: 'Display order', type: 'number' },
        { name: 'active', label: 'Show this category on the website', type: 'checkbox', def: 1 }
      ];
      q('catList').querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = () => crudModal({ title: 'Edit category', fields, item: r.items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/categories', after: load });
      });
      q('catList').querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = () => del('/api/admin/categories/' + b.dataset.del, 'Delete this category? Products will stay but lose their category.', load);
      });
      makeSortable(q('catList'), () => saveOrder('categories', q('catList')));
      q('addCat').onclick = () => crudModal({ title: 'Add category', fields, item: null, endpoint: '/api/admin/categories', after: load });
    }
    el.innerHTML = `<div class="toolbar"><button class="btn" id="addCat">+ Add Category</button>
      <span class="muted">Drag the ⠿ handle to reorder categories on the website.</span></div>
      <div class="sort-list" id="catList"><div class="loading"><div class="spinner"></div></div></div>`;
    await load();
  };

  /* ============================ INVENTORY =========================== */
  VIEWS.inventory = async (el) => {
    async function load() {
      const r = await api('/api/admin/inventory');
      el.innerHTML = `
      <div class="grid g2" style="grid-template-columns:1.4fr 1fr">
        <div class="card pad">
          <h3>Stock levels</h3>
          <div class="table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Alert at</th><th>Adjust</th></tr></thead>
          <tbody>${r.items.map((p) => `<tr>
            <td>${esc(p.name)}${p.active ? '' : ' <span class="pill grey">Hidden</span>'}</td>
            <td>${p.stock <= p.low_stock_alert ? `<span class="pill red">${p.stock}</span>` : `<b>${p.stock}</b>`}</td>
            <td class="muted">${p.low_stock_alert}</td>
            <td class="actions-cell">
              <button class="btn ghost sm" data-inc="${p.id}">+10</button>
              <button class="btn ghost sm" data-dec="${p.id}">−10</button>
              <button class="btn sm" data-set="${p.id}" data-name="${esc(p.name)}" data-stock="${p.stock}">Set</button>
            </td></tr>`).join('')}</tbody></table></div>
        </div>
        <div class="card pad">
          <h3>Recent stock movements</h3>
          <div class="table-wrap"><table><tbody>${r.log.map((l) => `<tr>
            <td>${esc(l.product || '—')}<div class="muted" style="font-size:.75rem">${esc(l.reason)} · ${dateStr(l.created_at)}</div></td>
            <td class="right"><span class="pill ${l.change >= 0 ? 'green' : 'red'}">${l.change >= 0 ? '+' : ''}${l.change}</span></td>
            <td class="right muted">${l.resulting_stock}</td></tr>`).join('') || '<tr><td class="muted">No movements yet</td></tr>'}</tbody></table></div>
        </div>
      </div>`;

      const adjust = async (id, body) => {
        try { await api('/api/admin/inventory/' + id, { method: 'POST', body }); toast('Stock updated', 'ok'); load(); }
        catch (e) { toast(e.message, 'err'); }
      };
      el.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => adjust(b.dataset.inc, { change: 10, reason: 'Restocked (+10)' }));
      el.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => adjust(b.dataset.dec, { change: -10, reason: 'Adjusted (−10)' }));
      el.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => {
        openModal(`<h3>Set stock — ${esc(b.dataset.name)}</h3>
          <div class="field"><label>New stock quantity</label><input type="number" id="stkVal" value="${b.dataset.stock}"></div>
          <div class="field"><label>Reason</label><input id="stkReason" value="Manual stock update"></div>
          <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">Cancel</button>
          <button class="btn" id="stkSave">Save</button></div>`);
        q('stkSave').onclick = () => { closeModal(); adjust(b.dataset.set, { set: Number(q('stkVal').value), reason: q('stkReason').value }); };
      });
    }
    await load();
  };

  /* ============================ CUSTOMERS =========================== */
  VIEWS.customers = async (el) => {
    const r = await api('/api/admin/customers');
    el.innerHTML = `
    <div class="card pad section-gap">
      <h3>Registered customers (${r.items.length})</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Contact</th><th>Address</th><th>Orders</th><th>Total spent</th><th>Last order</th><th></th></tr></thead>
        <tbody>${r.items.map((c) => `<tr>
          <td><b>${esc(c.name)}</b>${c.blocked ? ' <span class="pill red">Blocked</span>' : ''}</td>
          <td>${esc(c.phone || '')}<div class="muted" style="font-size:.78rem">${esc(c.email || '')}</div></td>
          <td class="muted" style="max-width:240px">${esc(c.address || '—')}</td>
          <td>${c.order_count}</td><td><b>${money(c.total_spent)}</b></td>
          <td class="muted">${c.last_order ? dateStr(c.last_order) : '—'}</td>
          <td><button class="btn ghost sm" data-cust="${c.id}">View</button>
              <button class="btn ${c.blocked ? 'gold' : 'danger'} sm" data-block="${c.id}" data-val="${c.blocked ? 0 : 1}">${c.blocked ? 'Unblock' : 'Block'}</button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="muted">No registered customers yet</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card pad">
      <h3>Guest customers (ordered without an account)</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Mobile</th><th>Orders</th><th>Total</th><th>Last order</th></tr></thead>
        <tbody>${r.guests.map((g) => `<tr><td>${esc(g.name || '')}</td><td>${esc(g.phone || '')}</td>
          <td>${g.order_count}</td><td>${money(g.total_spent)}</td><td class="muted">${dateStr(g.last_order)}</td></tr>`).join('')
        || '<tr><td colspan="5" class="muted">No guest orders</td></tr>'}</tbody>
      </table></div>
    </div>`;

    el.querySelectorAll('[data-cust]').forEach((b) => {
      b.onclick = async () => {
        const d = await api('/api/admin/customers/' + b.dataset.cust);
        openModal(`<h3>${esc(d.item.name)}</h3>
          <p class="muted">${esc(d.item.phone || '')} · ${esc(d.item.email || '')}<br>
          ${esc([d.item.address, d.item.city, d.item.state, d.item.pincode].filter(Boolean).join(', '))}</p>
          <h4>Orders (${d.orders.length})</h4>
          <div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${d.orders.map((o) => `<tr><td>${esc(o.order_code)}</td><td class="muted">${dateStr(o.created_at)}</td>
            <td>${money(o.total)}</td><td><span class="pill">${esc(o.status)}</span></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No orders</td></tr>'}</tbody></table></div>`, true);
      };
    });
    el.querySelectorAll('[data-block]').forEach((b) => {
      b.onclick = async () => {
        try {
          await api('/api/admin/customers/' + b.dataset.block, { method: 'PUT', body: { blocked: Number(b.dataset.val) } });
          toast('Customer updated', 'ok'); go('customers');
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  };

  /* ============================= REVIEWS ============================ */
  VIEWS.reviews = async (el) => {
    let status = 'all';
    async function load() {
      const r = await api('/api/admin/reviews?status=' + status);
      q('revBody').innerHTML = r.items.map((v) => `<tr>
        <td><b>${esc(v.name)}</b><div class="muted" style="font-size:.76rem">${dateStr(v.created_at)}</div></td>
        <td>${esc(v.product_name || '—')}</td>
        <td>${'★'.repeat(v.rating)}${'☆'.repeat(5 - v.rating)}</td>
        <td style="max-width:340px">${v.title ? `<b>${esc(v.title)}</b><br>` : ''}${esc(v.comment)}</td>
        <td><span class="pill ${v.status === 'approved' ? 'green' : v.status === 'rejected' ? 'red' : 'gold'}">${esc(v.status)}</span>
            ${v.featured ? '<span class="pill gold">Featured</span>' : ''}</td>
        <td class="actions-cell">
          <button class="btn ghost sm" data-app="${v.id}">Approve</button>
          <button class="btn ghost sm" data-rej="${v.id}">Reject</button>
          <button class="btn gold sm" data-feat="${v.id}" data-val="${v.featured ? 0 : 1}">${v.featured ? 'Unfeature' : 'Feature'}</button>
          <button class="btn danger sm" data-del="${v.id}">Delete</button>
        </td></tr>`).join('') || '<tr><td colspan="6" class="muted">No reviews</td></tr>';

      const upd = async (id, body) => { await api('/api/admin/reviews/' + id, { method: 'PUT', body }); toast('Review updated', 'ok'); load(); };
      q('revBody').querySelectorAll('[data-app]').forEach((b) => b.onclick = () => upd(b.dataset.app, { status: 'approved' }));
      q('revBody').querySelectorAll('[data-rej]').forEach((b) => b.onclick = () => upd(b.dataset.rej, { status: 'rejected' }));
      q('revBody').querySelectorAll('[data-feat]').forEach((b) => b.onclick = () => upd(b.dataset.feat, { featured: Number(b.dataset.val) }));
      q('revBody').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/reviews/' + b.dataset.del, 'Delete this review?', load));
    }
    el.innerHTML = `<div class="toolbar">
      <select id="rFilter"><option value="all">All reviews</option><option value="pending">Pending approval</option>
      <option value="approved">Approved</option><option value="rejected">Rejected</option></select>
      <span class="muted">Featured reviews appear in the Testimonials section on the homepage.</span></div>
      <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Customer</th><th>Product</th><th>Rating</th><th>Review</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="revBody"></tbody></table></div></div>`;
    q('rFilter').onchange = (e) => { status = e.target.value; load(); };
    await load();
  };

  /* ============================ MESSAGES ============================ */
  VIEWS.messages = async (el) => {
    async function load() {
      const r = await api('/api/admin/messages');
      el.innerHTML = `<div class="card"><div class="table-wrap"><table>
        <thead><tr><th>From</th><th>Subject</th><th>Message</th><th>Received</th><th></th></tr></thead>
        <tbody>${r.items.map((m) => `<tr style="${m.read ? '' : 'background:#FFFBF2'}">
          <td><b>${esc(m.name)}</b><div class="muted" style="font-size:.78rem">${esc(m.phone || '')} ${esc(m.email || '')}</div></td>
          <td>${esc(m.subject || '—')}</td><td style="max-width:380px">${esc(m.message)}</td>
          <td class="muted">${dateStr(m.created_at)}</td>
          <td class="actions-cell">${m.read ? '' : `<button class="btn ghost sm" data-read="${m.id}">Mark read</button>`}
            <button class="btn danger sm" data-del="${m.id}">Delete</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="muted">No messages yet</td></tr>'}</tbody></table></div></div>`;
      el.querySelectorAll('[data-read]').forEach((b) => b.onclick = async () => { await api('/api/admin/messages/' + b.dataset.read, { method: 'PUT', body: {} }); load(); });
      el.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/messages/' + b.dataset.del, 'Delete this message?', load));
    }
    await load();
  };

  /* ============================= COUPONS ============================ */
  VIEWS.coupons = async (el) => {
    const fields = [
      { name: 'code', label: 'Coupon code *', placeholder: 'FESTIVE20' },
      { name: 'type', label: 'Discount type', type: 'select', options: [{ value: 'percent', label: 'Percentage (%)' }, { value: 'fixed', label: 'Fixed amount (₹)' }] },
      { name: 'value', label: 'Discount value *', type: 'number' },
      { name: 'min_order', label: 'Minimum order value', type: 'number' },
      { name: 'max_discount', label: 'Maximum discount (0 = no cap)', type: 'number' },
      { name: 'expiry', label: 'Expiry date', type: 'date' },
      { name: 'usage_limit', label: 'Usage limit (0 = unlimited)', type: 'number' },
      { name: 'description', label: 'Description shown to customers' },
      { name: 'active', label: 'Coupon is active', type: 'checkbox', def: 1 }
    ];
    async function load() {
      const r = await api('/api/admin/coupons');
      q('cpBody').innerHTML = r.items.map((c) => `<tr>
        <td><b>${esc(c.code)}</b><div class="muted" style="font-size:.78rem">${esc(c.description || '')}</div></td>
        <td>${c.type === 'percent' ? c.value + '%' : money(c.value)}</td>
        <td>${c.min_order ? money(c.min_order) : '—'}</td>
        <td>${c.used_count}${c.usage_limit ? ' / ' + c.usage_limit : ''}</td>
        <td class="muted">${esc(c.expiry || 'No expiry')}</td>
        <td><span class="pill ${c.active ? 'green' : 'grey'}">${c.active ? 'Active' : 'Off'}</span></td>
        <td class="actions-cell"><button class="btn ghost sm" data-edit="${c.id}">Edit</button>
          <button class="btn danger sm" data-del="${c.id}">Delete</button></td></tr>`).join('')
        || '<tr><td colspan="7" class="muted">No coupons yet</td></tr>';
      q('cpBody').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
        crudModal({ title: 'Edit coupon', fields, item: r.items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/coupons', after: load }));
      q('cpBody').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/coupons/' + b.dataset.del, 'Delete this coupon?', load));
    }
    el.innerHTML = `<div class="toolbar"><button class="btn" id="addCp">+ Create Coupon</button></div>
      <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
      <tbody id="cpBody"></tbody></table></div></div>`;
    q('addCp').onclick = () => crudModal({ title: 'Create coupon', fields, item: null, endpoint: '/api/admin/coupons', after: load });
    await load();
  };

  /* ============================= BANNERS ============================ */
  VIEWS.banners = async (el) => {
    const fields = [
      { name: 'image', label: 'Banner image', type: 'image', hint: 'Recommended size 1400 × 420 px' },
      { name: 'heading', label: 'Heading' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'button_text', label: 'Button text' },
      { name: 'button_link', label: 'Button link', placeholder: '/products' },
      { name: 'sort_order', label: 'Display order', type: 'number' },
      { name: 'active', label: 'Banner is active', type: 'checkbox', def: 1 }
    ];
    async function load() {
      const r = await api('/api/admin/banners');
      q('bnList').innerHTML = r.items.map((b) => `<div class="row-item" data-id="${b.id}">
        <span class="handle">⠿</span><img src="${esc(b.image || '/uploads/placeholder.svg')}" alt="">
        <div class="grow"><b>${esc(b.heading || 'Untitled banner')}</b>
          <div class="muted" style="font-size:.8rem">${esc(b.description || '')}</div></div>
        <span class="pill ${b.active ? 'green' : 'grey'}">${b.active ? 'Active' : 'Off'}</span>
        <button class="btn ghost sm" data-edit="${b.id}">Edit</button>
        <button class="btn danger sm" data-del="${b.id}">Delete</button></div>`).join('') || '<div class="empty">No banners yet.</div>';
      q('bnList').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
        crudModal({ title: 'Edit banner', fields, item: r.items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/banners', after: load }));
      q('bnList').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/banners/' + b.dataset.del, 'Delete this banner?', load));
      makeSortable(q('bnList'), () => saveOrder('banners', q('bnList')));
    }
    el.innerHTML = `<div class="toolbar"><button class="btn" id="addBn">+ Add Banner</button>
      <span class="muted">Drag to reorder. Banners appear in the Offers section of the homepage.</span></div>
      <div class="sort-list" id="bnList"></div>`;
    q('addBn').onclick = () => crudModal({ title: 'Add banner', fields, item: null, endpoint: '/api/admin/banners', after: load });
    await load();
  };

  /* ======================== BRANDING & COLORS ======================= */
  VIEWS.branding = async (el) => {
    const s = (await api('/api/admin/settings')).settings;
    S.settings = s;
    const b = s.branding || {}, t = s.theme || {}, seo = s.seo || {};
    el.innerHTML = `
    <div class="grid g2" style="align-items:start">
      <div class="card pad">
        <h3>Website name &amp; logo</h3>
        <p class="muted" style="font-size:.85rem">Changing these updates the navbar, footer, browser tab, admin panel and login page everywhere.</p>
        <form id="brandForm">
          <div class="field"><label>Website name</label><input name="site_name" value="${esc(b.site_name || '')}"></div>
          <div class="field"><label>Tagline</label><input name="tagline" value="${esc(b.tagline || '')}"></div>
          ${imageField('logo', 'Logo', b.logo, 'Wide logo works best (e.g. 520 × 130 px)')}
          ${imageField('favicon', 'Favicon (browser tab icon)', b.favicon, 'Square image — 64 × 64 px or larger')}
          <div class="field"><label>Brand description</label><textarea name="brand_description">${esc(b.brand_description || '')}</textarea></div>
          <div class="field"><label>Footer copyright note</label><input name="footer_note" value="${esc(b.footer_note || '')}"></div>
          <button class="btn block" type="submit">Save branding</button>
        </form>
      </div>
      <div>
        <div class="card pad section-gap">
          <h3>Website colors</h3>
          <p class="muted" style="font-size:.85rem">These colors apply instantly across the whole customer website.</p>
          <form id="themeForm">
            <div class="fgrid2">
              ${[['primary', 'Primary (subtle red)'], ['secondary', 'Secondary (saffron)'], ['accent', 'Accent'], ['background', 'Background (cream)'],
      ['surface', 'Card surface'], ['text', 'Text (dark brown)'], ['muted', 'Muted text'], ['button', 'Button'],
      ['button_text', 'Button text'], ['dark', 'Dark brown']]
        .map(([k, lab]) => `<div class="field"><label>${lab}</label><div class="color-row">
          <input type="color" value="${esc(t[k] || '#B23A18')}" onchange="this.nextElementSibling.value=this.value">
          <input type="text" name="${k}" value="${esc(t[k] || '')}"></div></div>`).join('')}
            </div>
            <div class="field"><label>Corner radius (px)</label><input name="radius" type="number" value="${esc(t.radius || 18)}"></div>
            <button class="btn block" type="submit">Save colors</button>
          </form>
        </div>
        <div class="card pad">
          <h3>SEO / browser title</h3>
          <form id="seoForm">
            <div class="field"><label>Browser title</label><input name="title" value="${esc(seo.title || '')}"></div>
            <div class="field"><label>Meta description</label><textarea name="description">${esc(seo.description || '')}</textarea><div class="hint">Shown under your link in Google results.</div></div>
            <button class="btn block" type="submit">Save SEO</button>
          </form>
        </div>
      </div>
    </div>`;
    bindImageFields(el);
    const saveGroup = (formId, group) => {
      q(formId).onsubmit = async (e) => {
        e.preventDefault();
        const body = {}; body[group] = Object.fromEntries(new FormData(e.target));
        try { const r = await api('/api/admin/settings', { method: 'PUT', body }); S.settings = r.settings; toast('Saved', 'ok'); if (group === 'branding') renderShell() || go('branding'); }
        catch (err) { toast(err.message, 'err'); }
      };
    };
    saveGroup('brandForm', 'branding');
    saveGroup('themeForm', 'theme');
    saveGroup('seoForm', 'seo');
  };

  /* ============================== NAVBAR ============================ */
  VIEWS.navbar = async (el) => {
    const fields = [
      { name: 'label', label: 'Menu label *' },
      { name: 'link', label: 'Link *', placeholder: '/products', hint: 'Internal links start with / — e.g. /products, /story, /contact' },
      { name: 'sort_order', label: 'Order', type: 'number' },
      { name: 'active', label: 'Show in menu', type: 'checkbox', def: 1 }
    ];
    async function load() {
      const r = await api('/api/admin/nav_items');
      q('navList').innerHTML = r.items.map((n) => `<div class="row-item" data-id="${n.id}">
        <span class="handle">⠿</span>
        <div class="grow"><b>${esc(n.label)}</b><div class="muted" style="font-size:.8rem">${esc(n.link)}</div></div>
        <span class="pill ${n.active ? 'green' : 'grey'}">${n.active ? 'Visible' : 'Hidden'}</span>
        <button class="btn ghost sm" data-edit="${n.id}">Edit</button>
        <button class="btn danger sm" data-del="${n.id}">Remove</button></div>`).join('') || '<div class="empty">No menu items.</div>';
      q('navList').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
        crudModal({ title: 'Edit menu item', fields, item: r.items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/nav_items', after: load }));
      q('navList').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/nav_items/' + b.dataset.del, 'Remove this menu item?', load));
      makeSortable(q('navList'), () => saveOrder('nav_items', q('navList')));
    }
    el.innerHTML = `<div class="toolbar"><button class="btn" id="addNav">+ Add Menu Item</button>
      <span class="muted">Drag to reorder the website navbar.</span></div>
      <div class="sort-list" id="navList"></div>`;
    q('addNav').onclick = () => crudModal({ title: 'Add menu item', fields, item: null, endpoint: '/api/admin/nav_items', after: load });
    await load();
  };

  /* ========================= HOMEPAGE SECTIONS ====================== */
  VIEWS.homepage = async (el) => {
    const types = ['hero', 'usp', 'categories', 'featured', 'bestsellers', 'offers', 'story', 'testimonials', 'gallery', 'cta', 'custom'];
    const fields = [
      { name: 'type', label: 'Section type *', type: 'select', options: types.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })) },
      { name: 'title', label: 'Heading' },
      { name: 'subtitle', label: 'Sub heading / description', type: 'textarea' },
      { name: 'body', label: 'Body text (custom sections)', type: 'textarea' },
      { name: 'image', label: 'Section image', type: 'image' },
      { name: 'button_text', label: 'Button text' },
      { name: 'button_link', label: 'Button link', hint: 'Use "whatsapp" to open a WhatsApp chat.' },
      { name: 'button2_text', label: 'Second button text' },
      { name: 'button2_link', label: 'Second button link' },
      { name: 'sort_order', label: 'Order', type: 'number' },
      { name: 'active', label: 'Section is visible', type: 'checkbox', def: 1 }
    ];
    async function load() {
      const r = await api('/api/admin/home_sections');
      q('hsList').innerHTML = r.items.map((s) => `<div class="row-item" data-id="${s.id}">
        <span class="handle">⠿</span>
        ${s.image ? `<img src="${esc(s.image)}" alt="">` : ''}
        <div class="grow"><b>${esc(s.title || s.type)}</b> <span class="pill">${esc(s.type)}</span>
          <div class="muted" style="font-size:.8rem">${esc((s.subtitle || '').slice(0, 90))}</div></div>
        <button class="btn ${s.active ? 'gold' : 'ghost'} sm" data-toggle="${s.id}" data-val="${s.active ? 0 : 1}">${s.active ? 'Disable' : 'Enable'}</button>
        <button class="btn ghost sm" data-edit="${s.id}">Edit</button>
        <button class="btn danger sm" data-del="${s.id}">Remove</button></div>`).join('');
      q('hsList').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
        crudModal({ title: 'Edit homepage section', fields, item: r.items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/home_sections', after: load, wide: true }));
      q('hsList').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/home_sections/' + b.dataset.del, 'Remove this homepage section?', load));
      q('hsList').querySelectorAll('[data-toggle]').forEach((b) => b.onclick = async () => {
        await api('/api/admin/home_sections/' + b.dataset.toggle, { method: 'PUT', body: { active: Number(b.dataset.val) } });
        toast('Section updated', 'ok'); load();
      });
      makeSortable(q('hsList'), () => saveOrder('home_sections', q('hsList')));
    }
    el.innerHTML = `<div class="toolbar"><button class="btn" id="addHs">+ Add Section</button>
      <span class="muted">Drag to reorder the homepage. Disable a section to hide it without deleting.</span></div>
      <div class="sort-list" id="hsList"></div>`;
    q('addHs').onclick = () => crudModal({ title: 'Add homepage section', fields, item: null, endpoint: '/api/admin/home_sections', after: load, wide: true });
    await load();
  };

  /* =========================== CARDS / GALLERY ====================== */
  VIEWS.cards = async (el) => {
    let key = 'usp';
    const fields = () => ([
      { name: 'section_key', label: 'Belongs to', type: 'select', def: key, options: [{ value: 'usp', label: 'Homepage — Why choose us' }, { value: 'about', label: 'About page — Our promise' }, { value: 'gallery', label: 'Gallery' }] },
      { name: 'title', label: 'Title' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'icon', label: 'Icon (emoji)', placeholder: '🪔' },
      { name: 'image', label: 'Image', type: 'image' },
      { name: 'button_text', label: 'Button text' },
      { name: 'button_link', label: 'Button link' },
      { name: 'sort_order', label: 'Order', type: 'number' },
      { name: 'active', label: 'Visible', type: 'checkbox', def: 1 }
    ]);
    async function load() {
      const r = await api('/api/admin/cards');
      const items = r.items.filter((c) => c.section_key === key);
      q('cdList').innerHTML = items.map((c) => `<div class="row-item" data-id="${c.id}">
        <span class="handle">⠿</span>
        ${c.image ? `<img src="${esc(c.image)}" alt="">` : `<div style="font-size:1.5rem;width:46px;text-align:center">${esc(c.icon || '✨')}</div>`}
        <div class="grow"><b>${esc(c.title || '(no title)')}</b><div class="muted" style="font-size:.8rem">${esc((c.description || '').slice(0, 100))}</div></div>
        <span class="pill ${c.active ? 'green' : 'grey'}">${c.active ? 'On' : 'Off'}</span>
        <button class="btn ghost sm" data-edit="${c.id}">Edit</button>
        <button class="btn danger sm" data-del="${c.id}">Delete</button></div>`).join('') || '<div class="empty">No cards in this section yet.</div>';
      q('cdList').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
        crudModal({ title: 'Edit card', fields: fields(), item: items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/cards', after: load }));
      q('cdList').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/cards/' + b.dataset.del, 'Delete this card?', load));
      makeSortable(q('cdList'), () => saveOrder('cards', q('cdList')));
    }
    el.innerHTML = `<div class="tabs" id="cdTabs">
        <button class="active" data-k="usp">Homepage — Why choose us</button>
        <button data-k="about">About — Our promise</button>
        <button data-k="gallery">Gallery images</button>
      </div>
      <div class="toolbar"><button class="btn" id="addCd">+ Add Card</button><span class="muted">Drag to reorder.</span></div>
      <div class="sort-list" id="cdList"></div>`;
    q('cdTabs').querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
      key = b.dataset.k;
      q('cdTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      load();
    });
    q('addCd').onclick = () => crudModal({ title: 'Add card', fields: fields(), item: { section_key: key, active: 1 }, endpoint: '/api/admin/cards', after: load });
    await load();
  };

  /* ============================== STORY ============================= */
  VIEWS.story = async (el) => {
    const s = (await api('/api/admin/settings')).settings;
    const meta = s.story_meta || {};
    const fields = [
      { name: 'type', label: 'Block type', type: 'select', options: [
        { value: 'paragraph', label: 'Paragraph (centered text)' },
        { value: 'image', label: 'Image + text block' },
        { value: 'founder', label: 'Founder / family block' },
        { value: 'quote', label: 'Highlighted quote' },
        { value: 'timeline', label: 'Timeline event' }] },
      { name: 'heading', label: 'Heading' },
      { name: 'body', label: 'Text', type: 'textarea', rows: 6 },
      { name: 'image', label: 'Image (for image / founder blocks)', type: 'image' },
      { name: 'meta', label: 'Year or caption', hint: 'For timeline events put the year here, e.g. 2019' },
      { name: 'sort_order', label: 'Order', type: 'number' },
      { name: 'active', label: 'Visible', type: 'checkbox', def: 1 }
    ];
    async function load() {
      const r = await api('/api/admin/story_sections');
      q('stList').innerHTML = r.items.map((x) => `<div class="row-item" data-id="${x.id}">
        <span class="handle">⠿</span>
        ${x.image ? `<img src="${esc(x.image)}" alt="">` : ''}
        <div class="grow"><span class="pill">${esc(x.type)}</span> <b>${esc(x.heading || x.meta || '')}</b>
          <div class="muted" style="font-size:.8rem">${esc((x.body || '').slice(0, 110))}</div></div>
        <span class="pill ${x.active ? 'green' : 'grey'}">${x.active ? 'On' : 'Off'}</span>
        <button class="btn ghost sm" data-edit="${x.id}">Edit</button>
        <button class="btn danger sm" data-del="${x.id}">Delete</button></div>`).join('') || '<div class="empty">No story blocks yet.</div>';
      q('stList').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
        crudModal({ title: 'Edit story block', fields, item: r.items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/story_sections', after: load, wide: true }));
      q('stList').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/story_sections/' + b.dataset.del, 'Delete this story block?', load));
      makeSortable(q('stList'), () => saveOrder('story_sections', q('stList')));
    }
    el.innerHTML = `
    <div class="card pad section-gap">
      <h3>Story page header</h3>
      <form id="stMeta">
        <div class="fgrid2">
          <div class="field"><label>Title</label><input name="title" value="${esc(meta.title || '')}"></div>
          <div class="field"><label>Subtitle</label><input name="subtitle" value="${esc(meta.subtitle || '')}"></div>
        </div>
        ${imageField('hero_image', 'Story hero image', meta.hero_image)}
        <div class="field"><label>Closing quote</label><input name="quote" value="${esc(meta.quote || '')}"></div>
        <button class="btn" type="submit">Save header</button>
      </form>
    </div>
    <div class="toolbar"><button class="btn" id="addSt">+ Add Story Block</button>
      <span class="muted">Drag to reorder the “Maai Ki Kahani” page.</span></div>
    <div class="sort-list" id="stList"></div>`;
    bindImageFields(el);
    q('stMeta').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/admin/settings', { method: 'PUT', body: { story_meta: Object.fromEntries(new FormData(e.target)) } }); toast('Saved', 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    };
    q('addSt').onclick = () => crudModal({ title: 'Add story block', fields, item: null, endpoint: '/api/admin/story_sections', after: load, wide: true });
    await load();
  };

  /* ============================== PAGES ============================= */
  VIEWS.pages = async (el) => {
    const fields = [
      { name: 'slug', label: 'URL slug *', hint: 'e.g. privacy → /page/privacy' },
      { name: 'title', label: 'Page title *' },
      { name: 'body', label: 'Page content', type: 'textarea', rows: 16 }
    ];
    async function load() {
      const r = await api('/api/admin/pages');
      q('pgList').innerHTML = r.items.map((p) => `<div class="row-item" data-id="${p.id}">
        <div class="grow"><b>${esc(p.title)}</b><div class="muted" style="font-size:.8rem">/page/${esc(p.slug)}</div></div>
        <a class="btn ghost sm" href="/page/${esc(p.slug)}" target="_blank">Preview</a>
        <button class="btn ghost sm" data-edit="${p.id}">Edit</button>
        <button class="btn danger sm" data-del="${p.id}">Delete</button></div>`).join('');
      q('pgList').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
        crudModal({ title: 'Edit page', fields, item: r.items.find((x) => String(x.id) === b.dataset.edit), endpoint: '/api/admin/pages', after: load, wide: true }));
      q('pgList').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del('/api/admin/pages/' + b.dataset.del, 'Delete this page?', load));
    }
    el.innerHTML = `<div class="toolbar"><button class="btn" id="addPg">+ Add Page</button>
      <span class="muted">Privacy Policy, Terms and Refund pages are linked in the website footer.</span></div>
      <div class="sort-list" id="pgList"></div>`;
    q('addPg').onclick = () => crudModal({ title: 'Add page', fields, item: null, endpoint: '/api/admin/pages', after: load, wide: true });
    await load();
  };

  /* ============================== MEDIA ============================= */
  VIEWS.media = async (el) => {
    async function load() {
      const r = await api('/api/admin/media');
      el.innerHTML = `<div class="toolbar"><button class="btn" id="upBtn">+ Upload image</button>
        <span class="muted">${r.files.length} file(s). Click an image to copy its URL.</span></div>
        <div class="card pad"><div class="media-grid">
        ${r.files.map((f) => `<div class="media-item"><img src="${esc(f.url)}" data-copy="${esc(f.url)}" alt="">
          <button class="rm" data-rm="${esc(f.name)}">✕</button></div>`).join('') || '<p class="muted">No uploads yet.</p>'}
        </div></div>`;
      q('upBtn').onclick = () => pickImage(() => load());
      el.querySelectorAll('[data-copy]').forEach((i) => i.onclick = () => {
        const url = i.dataset.copy;
        if (navigator.clipboard) navigator.clipboard.writeText(location.origin + url).catch(() => {});
        openModal(`<h3>Image</h3>
          <img src="${esc(url)}" alt="" style="max-height:420px;margin:0 auto;border-radius:12px">
          <div class="field" style="margin-top:16px"><label>Image URL (copied to clipboard)</label>
            <input value="${esc(url)}" readonly onclick="this.select()"></div>
          <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">Close</button></div>`);
      });
      el.querySelectorAll('[data-rm]').forEach((b) => b.onclick = (e) => {
        e.stopPropagation();
        del2(b.dataset.rm, load);
      });
    }
    function del2(name, after) {
      confirmBox('Delete this image permanently?', async () => {
        try { await api('/api/admin/media', { method: 'DELETE', body: { name } }); toast('Deleted', 'ok'); after(); }
        catch (e) { toast(e.message, 'err'); }
      });
    }
    await load();
  };

  /* ============================= SETTINGS =========================== */
  VIEWS.settings = async (el) => {
    const d = await api('/api/admin/settings');
    const s = d.settings; S.settings = s;
    const c = s.contact || {}, so = s.social || {}, dl = s.delivery || {}, g = s.general || {}, ab = s.about || {}, fo = s.footer || {};
    el.innerHTML = `
    <div class="tabs" id="setTabs">
      <button class="active" data-t="store">Store &amp; Contact</button>
      <button data-t="social">Social Media</button>
      <button data-t="delivery">Delivery</button>
      <button data-t="general">General &amp; Payments</button>
      <button data-t="about">About Page</button>
      <button data-t="footer">Footer</button>
    </div>

    <div class="card pad set-pane" id="pane_store">
      <h3>Store &amp; contact details</h3>
      <form id="fContact">
        <div class="fgrid2">
          <div class="field"><label>Phone</label><input name="phone" value="${esc(c.phone || '')}"></div>
          <div class="field"><label>WhatsApp number</label><input name="whatsapp" value="${esc(c.whatsapp || '')}"><div class="hint">Digits with country code, e.g. 919876543210</div></div>
        </div>
        <div class="field"><label>Email</label><input name="email" value="${esc(c.email || '')}"></div>
        <div class="field"><label>Store address</label><textarea name="address">${esc(c.address || '')}</textarea></div>
        <div class="field"><label>Google Maps embed URL</label><input name="map_embed" value="${esc(c.map_embed || '')}"><div class="hint">Google Maps → Share → Embed a map → copy the src URL</div></div>
        <div class="field"><label>Business hours</label><input name="hours" value="${esc(c.hours || '')}"></div>
        <button class="btn" type="submit">Save contact details</button>
      </form>
    </div>

    <div class="card pad set-pane hidden" id="pane_social">
      <h3>Social media links</h3>
      <form id="fSocial">
        <div class="fgrid2">
          <div class="field"><label>Instagram</label><input name="instagram" value="${esc(so.instagram || '')}"></div>
          <div class="field"><label>Facebook</label><input name="facebook" value="${esc(so.facebook || '')}"></div>
          <div class="field"><label>YouTube</label><input name="youtube" value="${esc(so.youtube || '')}"></div>
          <div class="field"><label>X / Twitter</label><input name="x" value="${esc(so.x || '')}"></div>
        </div>
        <div class="field"><label>WhatsApp channel / community link</label><input name="whatsapp_channel" value="${esc(so.whatsapp_channel || '')}"></div>
        <button class="btn" type="submit">Save social links</button>
      </form>
    </div>

    <div class="card pad set-pane hidden" id="pane_delivery">
      <h3>Delivery settings</h3>
      <form id="fDelivery">
        <div class="fgrid2">
          <div class="field"><label>Delivery charge (₹)</label><input type="number" name="charge" value="${esc(dl.charge || 0)}"></div>
          <div class="field"><label>Free delivery above (₹)</label><input type="number" name="free_above" value="${esc(dl.free_above || 0)}"><div class="hint">0 = never free</div></div>
        </div>
        <div class="field"><label>Serviceable pincodes</label><input name="serviceable_pincodes" value="${esc(dl.serviceable_pincodes || '')}"><div class="hint">Comma separated. Leave empty to deliver everywhere.</div></div>
        <div class="field"><label>Serviceable cities (display only)</label><input name="serviceable_cities" value="${esc(dl.serviceable_cities || '')}"></div>
        <div class="field"><label>Delivery time message</label><input name="eta" value="${esc(dl.eta || '')}"></div>
        <button class="btn" type="submit">Save delivery settings</button>
      </form>
    </div>

    <div class="card pad set-pane hidden" id="pane_general">
      <h3>General, tax &amp; payment</h3>
      <form id="fGeneral">
        <div class="fgrid3">
          <div class="field"><label>Currency symbol</label><input name="currency" value="${esc(g.currency || '₹')}"></div>
          <div class="field"><label>Currency code</label><input name="currency_code" value="${esc(g.currency_code || 'INR')}"></div>
          <div class="field"><label>GST / tax %</label><input type="number" name="gst_percent" value="${esc(g.gst_percent || 0)}"></div>
        </div>
        <div class="switch"><input type="checkbox" name="tax_inclusive" id="gTax" ${g.tax_inclusive ? 'checked' : ''}><label for="gTax" style="margin:0">Prices already include tax (do not add tax at checkout)</label></div>
        <div class="switch"><input type="checkbox" name="cod_enabled" id="gCod" ${g.cod_enabled !== false ? 'checked' : ''}><label for="gCod" style="margin:0">Allow Cash on Delivery</label></div>
        <div class="switch"><input type="checkbox" name="online_payment_enabled" id="gOnline" ${g.online_payment_enabled ? 'checked' : ''}><label for="gOnline" style="margin:0">Enable online payment ${d.payment_configured ? '' : '(add gateway keys in the .env file first)'}</label></div>
        <div class="switch"><input type="checkbox" name="whatsapp_order_enabled" id="gWa" ${g.whatsapp_order_enabled !== false ? 'checked' : ''}><label for="gWa" style="margin:0">Allow “Order via WhatsApp”</label></div>
        <div class="switch"><input type="checkbox" name="auto_approve_reviews" id="gRev" ${g.auto_approve_reviews ? 'checked' : ''}><label for="gRev" style="margin:0">Publish customer reviews automatically (without approval)</label></div>
        <div class="field"><label>Minimum order value (₹)</label><input type="number" name="min_order" value="${esc(g.min_order || 0)}"></div>
        <button class="btn" type="submit">Save general settings</button>
      </form>
      <p class="muted" style="font-size:.84rem;margin-top:14px">Payment gateway keys are stored in the server <code>.env</code> file and are never exposed to the browser.
      Gateway status: <b>${d.payment_configured ? 'configured' : 'not configured'}</b>.</p>
    </div>

    <div class="card pad set-pane hidden" id="pane_about">
      <h3>About page content</h3>
      <form id="fAbout">
        <div class="fgrid2">
          <div class="field"><label>Heading</label><input name="heading" value="${esc(ab.heading || '')}"></div>
          <div class="field"><label>Sub heading</label><input name="subheading" value="${esc(ab.subheading || '')}"></div>
        </div>
        <div class="field"><label>About text</label><textarea name="body" style="min-height:200px">${esc(ab.body || '')}</textarea></div>
        <div class="field"><label>Mission statement</label><textarea name="mission">${esc(ab.mission || '')}</textarea></div>
        ${imageField('image', 'About page image', ab.image)}
        <button class="btn" type="submit">Save About page</button>
      </form>
    </div>

    <div class="card pad set-pane hidden" id="pane_footer">
      <h3>Footer</h3>
      <form id="fFooter">
        <div class="field"><label>Footer about text</label><textarea name="about_text">${esc(fo.about_text || '')}</textarea></div>
        <div class="fgrid3">
          <div class="field"><label>Links column title</label><input name="quick_links_title" value="${esc(fo.quick_links_title || 'Quick Links')}"></div>
          <div class="field"><label>Categories column title</label><input name="categories_title" value="${esc(fo.categories_title || 'Categories')}"></div>
          <div class="field"><label>Contact column title</label><input name="contact_title" value="${esc(fo.contact_title || 'Get in Touch')}"></div>
        </div>
        <button class="btn" type="submit">Save footer</button>
      </form>
    </div>`;

    bindImageFields(el);
    q('setTabs').querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
      q('setTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      el.querySelectorAll('.set-pane').forEach((p) => p.classList.add('hidden'));
      q('pane_' + b.dataset.t).classList.remove('hidden');
    });

    const bindSave = (formId, group, bools) => {
      q(formId).onsubmit = async (e) => {
        e.preventDefault();
        const obj = Object.fromEntries(new FormData(e.target));
        (bools || []).forEach((k) => { obj[k] = !!e.target.querySelector(`[name="${k}"]`).checked; });
        const body = {}; body[group] = obj;
        try { const r = await api('/api/admin/settings', { method: 'PUT', body }); S.settings = r.settings; toast('Settings saved', 'ok'); }
        catch (err) { toast(err.message, 'err'); }
      };
    };
    bindSave('fContact', 'contact');
    bindSave('fSocial', 'social');
    bindSave('fDelivery', 'delivery');
    bindSave('fGeneral', 'general', ['tax_inclusive', 'cod_enabled', 'online_payment_enabled', 'whatsapp_order_enabled', 'auto_approve_reviews']);
    bindSave('fAbout', 'about');
    bindSave('fFooter', 'footer');
  };

  /* ============================== ACCOUNT =========================== */
  VIEWS.account = async (el) => {
    el.innerHTML = `<div class="grid g2" style="align-items:start">
      <div class="card pad">
        <h3>Admin details</h3>
        <form id="accForm">
          <div class="field"><label>Name</label><input name="name" value="${esc(S.admin.name || '')}"></div>
          <div class="field"><label>Username</label><input name="username" value="${esc(S.admin.username || '')}" required></div>
          <div class="field"><label>Email</label><input name="email" type="email" value="${esc(S.admin.email || '')}" required></div>
          <button class="btn block" type="submit">Save details</button>
        </form>
      </div>
      <div class="card pad">
        <h3>Change password</h3>
        <p class="muted" style="font-size:.85rem">Change the default password before going live. Other devices will be logged out.</p>
        <form id="pwForm">
          <div class="field"><label>Current password</label><input name="current_password" type="password" required></div>
          <div class="field"><label>New password</label><input name="new_password" type="password" minlength="6" required></div>
          <button class="btn block" type="submit">Update password</button>
        </form>
      </div>
    </div>`;
    q('accForm').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api('/api/admin/account', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); S.admin = r.admin; toast('Saved', 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    };
    q('pwForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/admin/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Password changed', 'ok'); e.target.reset(); }
      catch (err) { toast(err.message, 'err'); }
    };
  };

  /* ============================== BOOT ============================== */
  async function boot() {
    try {
      const me = await api('/api/admin/me');
      S.admin = me.admin;
    } catch (e) { return renderLogin(); }
    try { S.settings = (await api('/api/admin/settings')).settings; } catch (e) {}
    renderShell();
    const hash = location.hash.replace('#', '');
    go(VIEWS[hash] ? hash : 'dashboard');
  }

  window.ADMIN = { go, api, toast };
  boot();
})();
