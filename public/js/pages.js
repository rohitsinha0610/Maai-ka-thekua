/* =====================================================================
   Maai Ka Thekuaa — page renderers
   ===================================================================== */
(function () {
  'use strict';
  const MKT = window.MKT;
  const api = MKT.api, esc = MKT.esc, money = MKT.money;

  /* ---------------------- shared components ---------------------- */
  function productCard(p) {
    const tag = !p.in_stock ? '<span class="p-tag grey">Out of stock</span>'
      : p.discount_percent ? `<span class="p-tag">${p.discount_percent}% OFF</span>`
        : p.featured ? '<span class="p-tag gold">Bestseller</span>' : '';
    return `
    <article class="card p-card">
      <a class="p-img" href="/product/${esc(p.slug)}" data-link>
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
        ${tag}
      </a>
      <div class="p-body">
        <div class="p-cat">${esc(p.category || 'Sweets')}</div>
        <a href="/product/${esc(p.slug)}" data-link><h3 class="p-name">${esc(p.name)}</h3></a>
        ${MKT.stars(p.rating, p.review_count)}
        <p class="p-desc">${esc(p.short_desc || '')}</p>
        <div class="p-meta">
          <span class="p-price">${money(p.effective_price)}</span>
          ${p.discount_percent ? `<span class="p-mrp">${money(p.price)}</span><span class="p-off">Save ${money(p.price - p.effective_price)}</span>` : ''}
          ${p.weight ? `<span class="muted" style="font-size:.8rem;margin-left:auto">${esc(p.weight)}</span>` : ''}
        </div>
        <div class="p-actions">
          <button class="btn ghost sm" data-add="${p.id}" ${p.in_stock ? '' : 'disabled'}>Add to Cart</button>
          <button class="btn sm" data-buy="${p.id}" ${p.in_stock ? '' : 'disabled'}>Buy Now</button>
        </div>
      </div>
    </article>`;
  }

  function bindProductButtons(scope, products) {
    const byId = {};
    products.forEach((p) => { byId[p.id] = p; });
    scope.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => MKT.addToCart(byId[b.dataset.add], 1);
    });
    scope.querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = () => { MKT.addToCart(byId[b.dataset.buy], 1); MKT.go('/checkout'); };
    });
  }

  function sectionHead(eyebrow, title, sub) {
    return `<div class="section-head">
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <h2>${esc(title || '')}</h2>
      <div class="motif-line"></div>
      ${sub ? `<p>${esc(sub)}</p>` : ''}
    </div>`;
  }

  /* ============================== HOME ============================== */
  MKT.route('/', async (app) => {
    const d = await api('/api/home');
    const parts = [];

    for (const s of d.sections) {
      switch (s.type) {
        case 'hero': {
          const cfg = s.config || {};
          parts.push(`
          <section class="hero"><div class="wrap"><div class="hero-inner">
            <div>
              ${cfg.badge ? `<div class="hero-badge">✨ ${esc(cfg.badge)}</div>` : ''}
              <h1>${esc(s.title)}</h1>
              <p class="lead">${esc(s.subtitle)}</p>
              <div class="hero-cta">
                ${s.button_text ? `<a class="btn" href="${esc(s.button_link || '/products')}" data-link>${esc(s.button_text)}</a>` : ''}
                ${s.button2_text ? `<a class="btn ghost" href="${esc(s.button2_link || '/story')}" data-link>${esc(s.button2_text)}</a>` : ''}
              </div>
              <div class="hero-stats">
                <div><strong>100%</strong><span>Homemade</span></div>
                <div><strong>Pure</strong><span>Desi Ghee &amp; Gur</span></div>
                <div><strong>4.8★</strong><span>Customer rating</span></div>
              </div>
            </div>
            <div class="hero-media"><img src="${esc(s.image || '/uploads/hero-thekua.svg')}" alt="Traditional Thekua"></div>
          </div></div></section>`);
          break;
        }
        case 'usp':
          if (!d.usp.length) break;
          parts.push(`<section class="section"><div class="wrap">
            ${sectionHead('Kyun hum', s.title, s.subtitle)}
            <div class="grid g4">${d.usp.map((c) => `
              <div class="card usp-card"><div class="ico">${esc(c.icon || '🪔')}</div>
              <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>
              ${c.button_text ? `<a class="btn ghost sm" style="margin-top:12px" href="${esc(c.button_link || '/products')}" data-link>${esc(c.button_text)}</a>` : ''}</div>`).join('')}</div>
          </div></section>`);
          break;
        case 'categories':
          if (!d.categories.length) break;
          parts.push(`<section class="section alt"><div class="wrap">
            ${sectionHead('Our range', s.title, s.subtitle)}
            <div class="grid g3">${d.categories.map((c) => `
              <a class="card cat-card" href="/products?category=${esc(c.slug)}" data-link>
                <img src="${esc(c.image || '/uploads/placeholder.svg')}" alt="${esc(c.name)}" loading="lazy">
                <div class="cat-body"><h3>${esc(c.name)}</h3><p>${esc(c.description || '')}</p></div>
              </a>`).join('')}</div>
          </div></section>`);
          break;
        case 'featured':
          if (!d.featured.length) break;
          parts.push(`<section class="section" id="featured"><div class="wrap">
            ${sectionHead('Handpicked', s.title, s.subtitle)}
            <div class="grid g4" data-products="featured">${d.featured.map(productCard).join('')}</div>
            ${s.button_text ? `<div class="text-center" style="margin-top:34px"><a class="btn ghost" href="${esc(s.button_link || '/products')}" data-link>${esc(s.button_text)}</a></div>` : ''}
          </div></section>`);
          break;
        case 'bestsellers':
          if (!d.bestsellers.length) break;
          parts.push(`<section class="section alt"><div class="wrap">
            ${sectionHead('Loved most', s.title, s.subtitle)}
            <div class="grid g4" data-products="best">${d.bestsellers.slice(0, 4).map(productCard).join('')}</div>
          </div></section>`);
          break;
        case 'offers': {
          if (!d.offers.length && !d.banners.length) break;
          parts.push(`<section class="section"><div class="wrap">
            ${sectionHead('Save more', s.title, s.subtitle)}
            ${d.banners.length ? `<div class="grid g2" style="margin-bottom:26px">${d.banners.map((b) => `
              <a class="banner-slide" href="${esc(b.button_link || '/products')}" data-link>
                <img src="${esc(b.image)}" alt="${esc(b.heading || '')}" loading="lazy">
                ${b.heading || b.description || b.button_text ? `<div class="banner-overlay">
                  ${b.heading ? `<h3>${esc(b.heading)}</h3>` : ''}
                  ${b.description ? `<p>${esc(b.description)}</p>` : ''}
                  ${b.button_text ? `<span class="btn sm">${esc(b.button_text)}</span>` : ''}
                </div>` : ''}</a>`).join('')}</div>` : ''}
            <div class="grid g3">${d.offers.map((o) => `
              <div class="offer-card">
                <div class="offer-code">${esc(o.code)}
                  <button class="copy-btn" data-copy="${esc(o.code)}">Copy</button></div>
                <p>${esc(o.description || ((o.type === 'percent' ? o.value + '% off' : money(o.value) + ' off') + (o.min_order ? ' above ' + money(o.min_order) : '')))}</p>
              </div>`).join('')}</div>
          </div></section>`);
          break;
        }
        case 'story': {
          if (!d.story.length) break;
          // A swipeable rail of story moments instead of a single button.
          const cards = d.story.map((x, i) => `
            <article class="story-card">
              ${x.image ? `<div class="sc-img"><img src="${esc(x.image)}" alt="${esc(x.heading || '')}" loading="lazy"></div>`
              : `<div class="sc-num">${String(i + 1).padStart(2, '0')}</div>`}
              <div class="sc-body">
                ${x.meta ? `<span class="sc-meta">${esc(x.meta)}</span>` : ''}
                ${x.heading ? `<h3>${esc(x.heading)}</h3>` : ''}
                <p>${esc(x.body || '')}</p>
              </div>
            </article>`).join('');
          parts.push(`<section class="section alt pattern-bg"><div class="wrap">
            ${sectionHead('Our story', s.title, s.subtitle)}
            <div class="rail-wrap">
              <button class="rail-btn prev" data-rail="prev" aria-label="Previous">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
              </button>
              <div class="rail" id="storyRail" tabindex="0">
                ${cards}
                <a class="story-card story-card--cta" href="${esc(s.button_link || '/story')}" data-link>
                  <div class="sc-body">
                    <h3>${esc(s.button_text || 'Read the full story')}</h3>
                    <p>Poori kahani padhiye — timeline, tasveerein aur maa ki recipe.</p>
                    <span class="btn sm">Open</span>
                  </div>
                </a>
              </div>
              <button class="rail-btn next" data-rail="next" aria-label="Next">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <div class="rail-hint muted">Swipe or drag to read →</div>
          </div></section>`);
          break;
        }
        case 'testimonials':
          if (!d.testimonials.length) break;
          parts.push(`<section class="section"><div class="wrap">
            ${sectionHead('Testimonials', s.title, s.subtitle)}
            <div class="grid g3">${d.testimonials.slice(0, 6).map((t) => `
              <div class="card tst-card">${MKT.stars(t.rating)}
                <p>“${esc(t.comment)}”</p>
                <div class="who">— ${esc(t.name)}</div>
                ${t.product_name ? `<div class="muted" style="font-size:.8rem">on ${esc(t.product_name)}</div>` : ''}
              </div>`).join('')}</div>
          </div></section>`);
          break;
        case 'gallery':
          if (!d.gallery.length) break;
          parts.push(`<section class="section alt"><div class="wrap">
            ${sectionHead('Gallery', s.title, s.subtitle)}
            <div class="gallery-grid">${d.gallery.map((g) => `<img src="${esc(g.image)}" alt="${esc(g.title || '')}" loading="lazy">`).join('')}</div>
          </div></section>`);
          break;
        case 'cta':
          parts.push(`<section class="section dark"><div class="wrap text-center">
            <h2>${esc(s.title)}</h2><p style="max-width:620px;margin:0 auto 26px">${esc(s.subtitle)}</p>
            <a class="btn wa" href="${s.button_link === 'whatsapp' ? MKT.waLink('Namaste! I would like to place an order.') : esc(s.button_link)}" target="_blank" rel="noopener">${esc(s.button_text || 'Chat on WhatsApp')}</a>
          </div></section>`);
          break;
        default:
          if (s.title || s.body) {
            parts.push(`<section class="section"><div class="wrap">
              ${sectionHead('', s.title, s.subtitle)}
              ${s.image ? `<img src="${esc(s.image)}" alt="" style="border-radius:var(--radius);margin:0 auto 24px;max-width:820px">` : ''}
              <div class="prose">${esc(s.body || '')}</div>
              ${s.button_text ? `<div class="text-center" style="margin-top:24px"><a class="btn" href="${esc(s.button_link || '#')}" data-link>${esc(s.button_text)}</a></div>` : ''}
            </div></section>`);
          }
      }
    }

    app.innerHTML = parts.join('');
    bindProductButtons(app, [].concat(d.featured, d.bestsellers));
    if (MKT.initRail) MKT.initRail(app.querySelector('#storyRail'));
    app.querySelectorAll('[data-copy]').forEach((b) => {
      b.onclick = () => {
        navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy);
        MKT.toast('Coupon ' + b.dataset.copy + ' copied', 'ok');
      };
    });
  });

  /* ============================ PRODUCTS ============================ */
  MKT.route('/products', async (app, params, query) => {
    const cats = (await api('/api/categories')).categories;
    const state = {
      search: query.search || '', category: query.category || '',
      min: query.min || '', max: query.max || '', sort: query.sort || 'default'
    };

    app.innerHTML = `
    <div class="wrap">
      <div class="page-head"><h1>Our Products</h1>
        <p>Handmade thekua and traditional sweets, made fresh in small batches.</p><div class="motif-line"></div></div>
      <div class="shop-layout" style="margin:26px 0 60px">
        <aside class="filters" id="filters">
          <div class="fgroup">
            <h4>Categories</h4>
            <button class="chip ${!state.category ? 'active' : ''}" data-cat="">All Products</button>
            ${cats.map((c) => `<button class="chip ${state.category === c.slug ? 'active' : ''}" data-cat="${esc(c.slug)}">${esc(c.name)} <span class="muted">(${c.product_count})</span></button>`).join('')}
          </div>
          <div class="fgroup">
            <h4>Price range</h4>
            <div class="range-row">
              <input type="number" id="fMin" placeholder="Min" value="${esc(state.min)}">
              <span>—</span>
              <input type="number" id="fMax" placeholder="Max" value="${esc(state.max)}">
            </div>
            <button class="btn sm block" id="applyPrice" style="margin-top:12px">Apply</button>
          </div>
          <div class="fgroup">
            <h4>Quick filters</h4>
            <button class="chip" data-sort="popular">Most popular</button>
            <button class="chip" data-sort="price_asc">Price: Low to High</button>
            <button class="chip" data-sort="price_desc">Price: High to Low</button>
            <button class="chip" data-sort="newest">Newest first</button>
          </div>
          <button class="btn ghost sm block" id="clearFilters">Clear all filters</button>
        </aside>
        <div>
          <div class="shop-toolbar">
            <button class="btn ghost sm filter-toggle" id="toggleFilters">Filters</button>
            <input type="search" id="listSearch" placeholder="Search products…" value="${esc(state.search)}" style="flex:1;min-width:180px">
            <select id="sortSel">
              <option value="default">Sort: Featured</option>
              <option value="popular">Popularity</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
          <div id="resultInfo" class="muted" style="margin-bottom:16px"></div>
          <div id="productGrid" class="grid g3"></div>
        </div>
      </div>
    </div>`;

    document.getElementById('sortSel').value = state.sort;

    async function load() {
      const grid = document.getElementById('productGrid');
      grid.innerHTML = MKT.skeletonGrid ? MKT.skeletonGrid(6, 'g3').replace(/^<div class="grid g3">|<\/div>$/g, '') : '';
      const qs = new URLSearchParams();
      if (state.search) qs.set('search', state.search);
      if (state.category) qs.set('category', state.category);
      if (state.min) qs.set('min', state.min);
      if (state.max) qs.set('max', state.max);
      if (state.sort) qs.set('sort', state.sort);
      qs.set('limit', '48');
      history.replaceState({}, '', '/products' + (qs.toString() ? '?' + qs.toString() : ''));
      const r = await api('/api/products?' + qs.toString());
      document.getElementById('resultInfo').textContent =
        r.total ? `Showing ${r.products.length} of ${r.total} products` : '';
      grid.innerHTML = r.products.length ? r.products.map(productCard).join('')
        : `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div><h3>No products found</h3>
           <p>Try a different category or search term.</p></div>`;
      bindProductButtons(grid, r.products);
    }

    app.querySelectorAll('[data-cat]').forEach((b) => {
      b.onclick = () => {
        state.category = b.dataset.cat;
        app.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x === b));
        load();
      };
    });
    app.querySelectorAll('[data-sort]').forEach((b) => {
      b.onclick = () => { state.sort = b.dataset.sort; document.getElementById('sortSel').value = state.sort; load(); };
    });
    document.getElementById('sortSel').onchange = (e) => { state.sort = e.target.value; load(); };
    document.getElementById('applyPrice').onclick = () => {
      state.min = document.getElementById('fMin').value;
      state.max = document.getElementById('fMax').value;
      load();
    };
    let t;
    document.getElementById('listSearch').oninput = (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 350);
    };
    document.getElementById('clearFilters').onclick = () => {
      state.search = ''; state.category = ''; state.min = ''; state.max = ''; state.sort = 'default';
      document.getElementById('listSearch').value = '';
      document.getElementById('fMin').value = ''; document.getElementById('fMax').value = '';
      document.getElementById('sortSel').value = 'default';
      app.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x.dataset.cat === ''));
      load();
    };
    document.getElementById('toggleFilters').onclick = () => document.getElementById('filters').classList.toggle('open');

    await load();
  });

  /* ========================= PRODUCT DETAIL ========================= */
  MKT.route('/product/:slug', async (app, params) => {
    const d = await api('/api/products/' + encodeURIComponent(params.slug));
    const p = d.product;
    const opts = p.weight_options || [];
    // Default to the option that matches the product's own pack size, else the first one.
    let defaultIdx = Math.max(0, opts.findIndex((o) => o.label === p.weight));
    let selected = opts.length ? opts[defaultIdx].label : p.weight;
    let qty = 1;

    const priceFor = (label) => {
      const o = opts.find((x) => x.label === label);
      return o && Number(o.price) > 0 ? Number(o.price) : p.effective_price;
    };

    app.innerHTML = `
    <div class="wrap">
      <div class="breadcrumb"><a href="/" data-link>Home</a> / <a href="/products" data-link>Products</a> /
        ${p.category ? `<a href="/products?category=${esc(p.category_slug)}" data-link>${esc(p.category)}</a> / ` : ''}
        <span>${esc(p.name)}</span></div>
      <section class="section" style="padding-top:26px">
        <div class="pdp">
          <div class="pdp-gallery">
            <div class="main-img"><img id="mainImg" src="${esc(p.images[0])}" alt="${esc(p.name)}"></div>
            <div class="thumbs">${p.images.map((im, i) => `<img src="${esc(im)}" class="${i === 0 ? 'active' : ''}" data-img="${esc(im)}" alt="">`).join('')}</div>
          </div>
          <div>
            <div class="p-cat">${esc(p.category || '')}</div>
            <h1>${esc(p.name)}</h1>
            ${MKT.stars(p.rating, p.review_count)}
            <p class="muted" style="margin-top:10px">${esc(p.short_desc || '')}</p>
            <div class="price-row">
              <span class="now" id="pdpPrice">${money(priceFor(selected))}</span>
              ${p.discount_percent ? `<span class="p-mrp">${money(p.price)}</span><span class="p-off">${p.discount_percent}% OFF</span>` : ''}
            </div>
            ${opts.length ? `<div><label style="font-size:.84rem;font-weight:600;color:var(--muted)">Choose weight</label>
              <div class="wt-options">${opts.map((o, i) => `<button class="wt ${i === defaultIdx ? 'active' : ''}" data-wt="${esc(o.label)}">${esc(o.label)} — ${money(o.price)}</button>`).join('')}</div></div>` : ''}
            <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
              <div class="qty"><button id="qMinus">−</button><span id="qVal">1</span><button id="qPlus">+</button></div>
              <span class="pill ${p.in_stock ? 'green' : 'red'}">${p.in_stock ? 'In stock (' + p.stock + ' left)' : 'Out of stock'}</span>
            </div>
            <div class="pdp-actions">
              <button class="btn ghost" id="btnAdd" ${p.in_stock ? '' : 'disabled'}>Add to Cart</button>
              <button class="btn" id="btnBuy" ${p.in_stock ? '' : 'disabled'}>Buy Now</button>
              <a class="btn wa" href="${MKT.waLink('Namaste! I want to order: ' + p.name)}" target="_blank" rel="noopener">Order on WhatsApp</a>
            </div>
            <div class="info-list">
              ${p.weight ? `<div><b>Net weight</b><span>${esc(p.weight)}</span></div>` : ''}
              <div><b>Availability</b><span>${p.in_stock ? 'Ready to ship' : 'Currently unavailable'}</span></div>
              <div><b>Delivery</b><span>${esc((MKT.settings.delivery || {}).eta || 'Delivered across India')}</span></div>
              <div><b>Shelf life</b><span>15–20 days in an airtight container</span></div>
            </div>
          </div>
        </div>

        <div style="margin-top:56px">
          <div class="tabs">
            <button class="active" data-tab="desc">Description</button>
            <button data-tab="ing">Ingredients</button>
            <button data-tab="nut">Nutrition</button>
            <button data-tab="rev">Reviews (${d.reviews.length})</button>
          </div>
          <div id="tabDesc" class="tab-body">${esc(p.description || p.short_desc || '')}</div>
          <div id="tabIng" class="tab-body hidden">${esc(p.ingredients || 'Ingredient details coming soon.')}</div>
          <div id="tabNut" class="tab-body hidden">${esc(p.nutrition || 'Nutritional information coming soon.')}</div>
          <div id="tabRev" class="hidden">
            <div class="grid g2" style="align-items:start">
              <div>
                ${d.reviews.length ? d.reviews.map((r) => `
                  <div class="review"><div class="rhead"><strong>${esc(r.name)}</strong><span class="rdate">${MKT.dateStr(r.created_at)}</span></div>
                  ${MKT.stars(r.rating)}${r.title ? `<div style="font-weight:600;margin-top:4px">${esc(r.title)}</div>` : ''}
                  <p style="margin:6px 0 0">${esc(r.comment)}</p></div>`).join('')
        : '<p class="muted">No reviews yet. Be the first to review this product.</p>'}
              </div>
              <div class="form-card">
                <h3>Write a review</h3>
                <div id="revMsg"></div>
                <form id="reviewForm">
                  <div class="field"><label>Your name</label><input name="name" value="${esc(MKT.user ? MKT.user.name : '')}" required></div>
                  <div class="field"><label>Rating</label>
                    <div class="rating-input" id="ratingInput">${[1, 2, 3, 4, 5].map((i) => `<span data-r="${i}" class="${i <= 5 ? 'on' : ''}">★</span>`).join('')}</div>
                  </div>
                  <div class="field"><label>Title</label><input name="title" placeholder="Sum it up in a few words"></div>
                  <div class="field"><label>Your review</label><textarea name="comment" required placeholder="How did it taste?"></textarea></div>
                  <button class="btn block" type="submit">Submit review</button>
                </form>
              </div>
            </div>
          </div>
        </div>

        ${d.related.length ? `<div style="margin-top:64px">
          ${sectionHead('You may also like', 'Related Products', '')}
          <div class="grid g4" id="relatedGrid">${d.related.map(productCard).join('')}</div></div>` : ''}
      </section>
    </div>`;

    app.querySelectorAll('[data-img]').forEach((t) => {
      t.onclick = () => {
        document.getElementById('mainImg').src = t.dataset.img;
        app.querySelectorAll('[data-img]').forEach((x) => x.classList.toggle('active', x === t));
      };
    });
    app.querySelectorAll('[data-wt]').forEach((b) => {
      b.onclick = () => {
        selected = b.dataset.wt;
        app.querySelectorAll('[data-wt]').forEach((x) => x.classList.toggle('active', x === b));
        document.getElementById('pdpPrice').textContent = money(priceFor(selected));
      };
    });
    document.getElementById('qMinus').onclick = () => { qty = Math.max(1, qty - 1); document.getElementById('qVal').textContent = qty; };
    document.getElementById('qPlus').onclick = () => { qty = Math.min(p.stock || 99, qty + 1); document.getElementById('qVal').textContent = qty; };
    document.getElementById('btnAdd').onclick = () => MKT.addToCart(p, qty, selected);
    document.getElementById('btnBuy').onclick = () => { MKT.addToCart(p, qty, selected); MKT.go('/checkout'); };

    const tabs = { desc: 'tabDesc', ing: 'tabIng', nut: 'tabNut', rev: 'tabRev' };
    app.querySelectorAll('[data-tab]').forEach((b) => {
      b.onclick = () => {
        app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
        Object.keys(tabs).forEach((k) => document.getElementById(tabs[k]).classList.toggle('hidden', k !== b.dataset.tab));
      };
    });

    let rating = 5;
    const ri = document.getElementById('ratingInput');
    ri.querySelectorAll('span').forEach((s) => {
      s.onclick = () => {
        rating = Number(s.dataset.r);
        ri.querySelectorAll('span').forEach((x) => x.classList.toggle('on', Number(x.dataset.r) <= rating));
      };
    });
    document.getElementById('reviewForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const msg = document.getElementById('revMsg');
      try {
        const r = await api('/api/reviews', { method: 'POST', body: Object.assign(fd, { product_id: p.id, rating }) });
        msg.innerHTML = `<div class="success-msg">${esc(r.message)}</div>`;
        e.target.reset();
      } catch (err) {
        msg.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      }
    };

    if (d.related.length) bindProductButtons(document.getElementById('relatedGrid'), d.related);
  });

  /* ============================= STORY ============================= */
  MKT.route('/story', async (app) => {
    const d = await api('/api/story');
    const meta = d.meta || {};
    const timeline = d.sections.filter((s) => s.type === 'timeline');
    const rest = d.sections.filter((s) => s.type !== 'timeline');

    app.innerHTML = `
    <section class="section alt pattern-bg" style="padding-bottom:40px"><div class="wrap">
      <div class="story-hero">
        <div>
          <div class="eyebrow" style="color:var(--accent);letter-spacing:3px;text-transform:uppercase;font-size:.74rem;font-weight:700">Our Story</div>
          <h1>${esc(meta.title || 'Maai Ki Kahani')}</h1>
          <p style="font-size:1.1rem">${esc(meta.subtitle || '')}</p>
          <a class="btn" href="/products" data-link>Taste the story</a>
        </div>
        <div><img src="${esc(meta.hero_image || '/uploads/story-founder.svg')}" alt="Maai Ki Kahani"></div>
      </div>
    </div></section>

    <section class="section"><div class="wrap">
      ${rest.map((s) => {
      if (s.type === 'quote') return `<div class="story-quote">${esc(s.body)}</div>`;
      if (s.type === 'image' || s.type === 'founder') {
        return `<div class="story-block">
              <div class="story-img"><img src="${esc(s.image || '/uploads/story-kitchen.svg')}" alt="${esc(s.heading)}" loading="lazy"></div>
              <div>${s.meta ? `<span class="meta-label">${esc(s.meta)}</span>` : ''}
                <h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></div>
            </div>`;
      }
      return `<div class="story-para">${s.heading ? `<h3>${esc(s.heading)}</h3>` : ''}<p>${esc(s.body)}</p></div>`;
    }).join('')}
    </div></section>

    ${timeline.length ? `<section class="section alt"><div class="wrap">
      ${sectionHead('Our journey', 'Kahani ka safar', 'घर की रसोई से आपके घर तक')}
      <div class="timeline">${timeline.map((t) => `
        <div class="tl-item"><div class="dot"></div>
          <div class="tl-year">${esc(t.meta || '')}</div>
          <h4>${esc(t.heading)}</h4><p>${esc(t.body)}</p></div>`).join('')}</div>
    </div></section>` : ''}

    <section class="section dark"><div class="wrap text-center">
      <h2>${esc(meta.quote || 'Maai Ka Thekuaa — स्वाद जो घर की याद दिलाए। ❤️')}</h2>
      <a class="btn gold" href="/products" data-link style="margin-top:14px">Order Now</a>
    </div></section>`;
  });

  /* ============================= ABOUT ============================= */
  MKT.route('/about', async (app) => {
    const d = await api('/api/about');
    const a = d.about || {};
    app.innerHTML = `
    <div class="wrap">
      <div class="page-head"><h1>${esc(a.heading || 'About Us')}</h1>
        <div class="motif-line"></div><p>${esc(a.subheading || '')}</p></div>
    </div>
    <section class="section" style="padding-top:30px"><div class="wrap">
      <div class="story-hero">
        <div><img src="${esc(a.image || '/uploads/story-kitchen.svg')}" alt="About us" style="border-radius:var(--radius);box-shadow:var(--shadow)"></div>
        <div class="prose" style="margin:0;text-align:left">${esc(a.body || '')}</div>
      </div>
    </div></section>
    ${d.cards.length ? `<section class="section alt"><div class="wrap">
      ${sectionHead('What we stand for', 'Our Promise', '')}
      <div class="grid g4">${d.cards.map((c) => `
        <div class="card usp-card"><div class="ico">${esc(c.icon || '✨')}</div>
        <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>
        ${c.button_text ? `<a class="btn ghost sm" style="margin-top:12px" href="${esc(c.button_link || '/products')}" data-link>${esc(c.button_text)}</a>` : ''}</div>`).join('')}</div>
    </div></section>` : ''}
    <section class="section"><div class="wrap text-center" style="max-width:760px">
      ${sectionHead('Our mission', 'Mission', '')}
      <p style="font-size:1.1rem;line-height:1.9">${esc(a.mission || '')}</p>
      <a class="btn" href="/products" data-link style="margin-top:10px">Explore our sweets</a>
    </div></section>`;
  });

  /* ============================ CONTACT ============================ */
  MKT.route('/contact', async (app) => {
    const c = MKT.settings.contact || {};
    const s = MKT.settings.social || {};
    app.innerHTML = `
    <div class="wrap">
      <div class="page-head"><h1>Contact Us</h1><div class="motif-line"></div>
        <p>Questions, bulk orders or festival hampers — we would love to hear from you.</p></div>
      <section class="section" style="padding-top:30px"><div class="contact-grid">
        <div>
          <div class="card" style="padding:26px">
            <div class="contact-list">
              ${c.phone ? `<div><div class="ci">📞</div><div><b>Phone</b><br><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></div></div>` : ''}
              ${c.whatsapp ? `<div><div class="ci">💬</div><div><b>WhatsApp</b><br><a href="${MKT.waLink('Namaste!')}" target="_blank" rel="noopener">Chat with us</a></div></div>` : ''}
              ${c.email ? `<div><div class="ci">✉</div><div><b>Email</b><br><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></div>` : ''}
              ${c.address ? `<div><div class="ci">📍</div><div><b>Address</b><br>${esc(c.address)}</div></div>` : ''}
              ${c.hours ? `<div><div class="ci">🕘</div><div><b>Hours</b><br>${esc(c.hours)}</div></div>` : ''}
            </div>
            <div class="social-row">
              ${['instagram', 'facebook', 'youtube'].filter((k) => s[k]).map((k) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${k[0].toUpperCase()}</a>`).join('')}
            </div>
          </div>
          ${c.map_embed ? `<iframe class="map-frame" style="margin-top:20px" src="${esc(c.map_embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Our location"></iframe>` : ''}
        </div>
        <div class="form-card">
          <h3>Send us a message</h3>
          <div id="contactMsg"></div>
          <form id="contactForm">
            <div class="form-grid">
              <div class="field"><label>Your name *</label><input name="name" required></div>
              <div class="field"><label>Mobile number</label><input name="phone"></div>
            </div>
            <div class="field"><label>Email</label><input name="email" type="email"></div>
            <div class="field"><label>Subject</label><input name="subject"></div>
            <div class="field"><label>Message *</label><textarea name="message" required></textarea></div>
            <button class="btn block" type="submit">Send message</button>
          </form>
        </div>
      </div></section>
    </div>`;
    document.getElementById('contactForm').onsubmit = async (e) => {
      e.preventDefault();
      const box = document.getElementById('contactMsg');
      try {
        const r = await api('/api/contact', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        box.innerHTML = `<div class="success-msg">${esc(r.message)}</div>`;
        e.target.reset();
      } catch (err) { box.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
  });

  /* ============================== CART ============================== */
  function cartLines() {
    return MKT.cart.map((i, idx) => `
      <div class="cart-item">
        <img src="${esc(i.image)}" alt="${esc(i.name)}">
        <div>
          <h4><a href="/product/${esc(i.slug)}" data-link>${esc(i.name)}</a></h4>
          <div class="ci-meta">${i.weight ? esc(i.weight) + ' • ' : ''}${money(i.price)} each</div>
          <button class="link-btn" data-remove="${idx}" style="margin-top:6px">Remove</button>
        </div>
        <div class="ci-right" style="text-align:right">
          <div class="qty" style="margin-bottom:8px"><button data-dec="${idx}">−</button><span>${i.qty}</span><button data-inc="${idx}">+</button></div>
          <strong>${money(i.price * i.qty)}</strong>
        </div>
      </div>`).join('');
  }

  MKT.route('/cart', async (app) => {
    if (!MKT.cart.length) {
      app.innerHTML = `<div class="wrap"><div class="empty"><div class="big">🛒</div><h2>Your cart is empty</h2>
        <p>Add some fresh, handmade thekua to get started.</p><a class="btn" href="/products" data-link>Shop Now</a></div></div>`;
      return;
    }
    const del = MKT.settings.delivery || {};
    app.innerHTML = `
    <div class="wrap">
      <div class="page-head"><h1>Your Cart</h1><div class="motif-line"></div></div>
      <section class="section" style="padding-top:24px"><div class="cart-layout">
        <div class="card" style="padding:8px 24px 24px">${cartLines()}</div>
        <div class="summary">
          <h3>Order Summary</h3>
          <div class="coupon-row">
            <input id="couponInput" placeholder="Coupon code" value="${esc(localStorage.getItem('mkt_coupon') || '')}">
            <button class="btn sm" id="applyCoupon">Apply</button>
          </div>
          <div id="couponMsg"></div>
          <div id="totals"></div>
          <a class="btn block" href="/checkout" data-link style="margin-top:18px">Proceed to Checkout</a>
          <a class="btn ghost block" href="/products" data-link style="margin-top:10px">Continue Shopping</a>
          <p class="note" style="margin-top:14px">${esc(del.free_above ? 'Free delivery on orders above ' + money(del.free_above) : '')}</p>
        </div>
      </div></section>
    </div>`;

    async function refreshTotals() {
      const box = document.getElementById('totals');
      box.innerHTML = '<div class="muted">Calculating…</div>';
      try {
        const r = await api('/api/quote', {
          method: 'POST',
          body: { items: MKT.cart.map((i) => ({ product_id: i.product_id, qty: i.qty, weight: i.weight })), coupon_code: localStorage.getItem('mkt_coupon') || '' }
        });
        const t = r.totals;
        box.innerHTML = `
          <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
          ${t.discount ? `<div class="row" style="color:#1a7f43"><span>Discount${r.coupon ? ' (' + esc(r.coupon.code) + ')' : ''}</span><span>− ${money(t.discount)}</span></div>` : ''}
          <div class="row"><span>Delivery</span><span>${t.delivery_charge ? money(t.delivery_charge) : 'FREE'}</span></div>
          ${t.tax ? `<div class="row"><span>Tax</span><span>${money(t.tax)}</span></div>` : ''}
          <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>`;
        const sum = box.closest('.summary');
        if (sum) { sum.classList.remove('updated'); void sum.offsetWidth; sum.classList.add('updated'); }
        if (localStorage.getItem('mkt_coupon') && !r.coupon) {
          document.getElementById('couponMsg').innerHTML = '<div class="error-msg">Coupon not applicable on this order.</div>';
        }
      } catch (e) {
        box.innerHTML = `<div class="error-msg">${esc(e.message)}</div>`;
      }
    }

    function rebind() {
      const container = app.querySelector('.cart-layout .card');
      container.innerHTML = cartLines();
      bind();
      MKT.renderCartCount();
      refreshTotals();
      if (!MKT.cart.length) MKT.render();
    }
    function bind() {
      app.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => { MKT.cart[b.dataset.inc].qty++; MKT.saveCart(); rebind(); });
      app.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => {
        const i = MKT.cart[b.dataset.dec];
        i.qty = Math.max(1, i.qty - 1); MKT.saveCart(); rebind();
      });
      app.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => {
        const row = b.closest('.cart-item');
        const drop = () => { MKT.cart.splice(Number(b.dataset.remove), 1); MKT.saveCart(); rebind(); };
        if (row && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          row.classList.add('removing');
          setTimeout(drop, 320);
        } else drop();
      });
    }
    bind();
    document.getElementById('applyCoupon').onclick = async () => {
      const code = document.getElementById('couponInput').value.trim().toUpperCase();
      const msg = document.getElementById('couponMsg');
      if (!code) { localStorage.removeItem('mkt_coupon'); msg.innerHTML = ''; return refreshTotals(); }
      try {
        const r = await api('/api/coupons/validate', { method: 'POST', body: { code, subtotal: MKT.cartTotal() } });
        localStorage.setItem('mkt_coupon', r.coupon.code);
        msg.innerHTML = `<div class="success-msg">Coupon applied — you saved ${money(r.discount)}</div>`;
        refreshTotals();
      } catch (e) {
        localStorage.removeItem('mkt_coupon');
        msg.innerHTML = `<div class="error-msg">${esc(e.message)}</div>`;
        refreshTotals();
      }
    };
    refreshTotals();
  });

  /* ============================ CHECKOUT ============================ */
  MKT.route('/checkout', async (app) => {
    if (!MKT.cart.length) return MKT.go('/cart', true);
    const u = MKT.user || {};
    const gen = MKT.settings.general || {};
    app.innerHTML = `
    <div class="wrap">
      <div class="page-head"><h1>Checkout</h1><div class="motif-line"></div></div>
      <section class="section" style="padding-top:24px"><div class="cart-layout">
        <div class="form-card">
          <h3>Delivery details</h3>
          ${MKT.user ? '' : '<p class="note">Already have an account? <button class="link-btn" id="loginLink">Login</button> to autofill your details.</p>'}
          <div id="coErr"></div>
          <form id="checkoutForm">
            <div class="form-grid">
              <div class="field"><label>Full name *</label><input name="customer_name" required value="${esc(u.name || '')}"></div>
              <div class="field"><label>Mobile number *</label><input name="phone" required value="${esc(u.phone || '')}"></div>
            </div>
            <div class="field"><label>Email</label><input name="email" type="email" value="${esc(u.email || '')}"></div>
            <div class="field"><label>Address *</label><textarea name="address" required style="min-height:80px">${esc(u.address || '')}</textarea></div>
            <div class="form-grid">
              <div class="field"><label>City *</label><input name="city" required value="${esc(u.city || '')}"></div>
              <div class="field"><label>State *</label><input name="state" required value="${esc(u.state || '')}"></div>
            </div>
            <div class="form-grid">
              <div class="field"><label>Pincode *</label><input name="pincode" required value="${esc(u.pincode || '')}"></div>
              <div class="field"><label>Landmark</label><input name="landmark" value="${esc(u.landmark || '')}"></div>
            </div>
            <div class="field"><label>Order notes</label><textarea name="notes" style="min-height:70px" placeholder="Any special instructions?"></textarea></div>

            <h3 style="margin-top:20px">Payment method</h3>
            <div class="wt-options" id="payOptions">
              ${gen.cod_enabled !== false ? '<button type="button" class="wt active" data-pay="cod">Cash on Delivery</button>' : ''}
              ${gen.online_payment_enabled ? '<button type="button" class="wt" data-pay="online">Pay Online</button>' : '<button type="button" class="wt" data-pay="online" disabled title="Payment gateway not configured yet">Pay Online (coming soon)</button>'}
              ${gen.whatsapp_order_enabled !== false ? '<button type="button" class="wt" data-pay="whatsapp">Order via WhatsApp</button>' : ''}
            </div>
            <p class="note">Online payment is ready for a gateway to be plugged in from the Admin Panel settings.</p>
            <button class="btn block" type="submit" style="margin-top:16px">Place Order</button>
          </form>
        </div>
        <div class="summary">
          <h3>Order Summary</h3>
          ${MKT.cart.map((i) => `<div class="row"><span>${esc(i.name)}${i.weight ? ' (' + esc(i.weight) + ')' : ''} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
          <div id="coTotals" style="margin-top:10px"></div>
        </div>
      </div></section>
    </div>`;

    if (!MKT.user) document.getElementById('loginLink').onclick = () => MKT.openAuth();
    let payment = 'cod';
    app.querySelectorAll('[data-pay]').forEach((b) => {
      b.onclick = () => {
        if (b.disabled) return;
        payment = b.dataset.pay;
        app.querySelectorAll('[data-pay]').forEach((x) => x.classList.toggle('active', x === b));
      };
    });

    const items = MKT.cart.map((i) => ({ product_id: i.product_id, qty: i.qty, weight: i.weight }));
    try {
      const r = await api('/api/quote', { method: 'POST', body: { items, coupon_code: localStorage.getItem('mkt_coupon') || '' } });
      const t = r.totals;
      document.getElementById('coTotals').innerHTML = `
        <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
        ${t.discount ? `<div class="row" style="color:#1a7f43"><span>Discount</span><span>− ${money(t.discount)}</span></div>` : ''}
        <div class="row"><span>Delivery</span><span>${t.delivery_charge ? money(t.delivery_charge) : 'FREE'}</span></div>
        ${t.tax ? `<div class="row"><span>Tax</span><span>${money(t.tax)}</span></div>` : ''}
        <div class="row total"><span>To Pay</span><span>${money(t.total)}</span></div>`;
    } catch (e) { document.getElementById('coTotals').innerHTML = `<div class="error-msg">${esc(e.message)}</div>`; }

    document.getElementById('checkoutForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const err = document.getElementById('coErr');
      btn.disabled = true; btn.textContent = 'Placing order…';
      try {
        const body = Object.assign(Object.fromEntries(new FormData(e.target)), {
          items, coupon_code: localStorage.getItem('mkt_coupon') || '', payment_method: payment
        });
        const r = await api('/api/orders', { method: 'POST', body });
        MKT.cart = []; MKT.saveCart(); localStorage.removeItem('mkt_coupon');
        sessionStorage.setItem('mkt_last_order', JSON.stringify({ order: r.order, whatsapp_url: r.whatsapp_url }));
        if (payment === 'whatsapp' && r.whatsapp_url) window.open(r.whatsapp_url, '_blank');
        MKT.go('/order-success');
      } catch (e2) {
        err.innerHTML = `<div class="error-msg">${esc(e2.message)}</div>`;
        btn.disabled = false; btn.textContent = 'Place Order';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  });

  /* ========================= ORDER SUCCESS ========================= */
  MKT.route('/order-success', async (app) => {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem('mkt_last_order') || 'null'); } catch (e) {}
    if (!data) return MKT.go('/', true);
    const o = data.order;
    app.innerHTML = `
    <div class="wrap"><section class="section">
      <div class="card" style="max-width:720px;margin:0 auto;padding:40px;text-align:center">
        <div style="font-size:3.4rem">🎉</div>
        <h1>Dhanyavaad, ${esc(o.customer_name)}!</h1>
        <p class="muted">Your order has been placed successfully. We will confirm it on ${esc(o.phone)} shortly.</p>
        <div class="card" style="padding:22px;text-align:left;margin:24px 0">
          <div class="order-head"><div><b>Order ID</b><br><span style="font-family:var(--serif);font-size:1.3rem;color:var(--primary)">${esc(o.order_code)}</span></div>
            <span class="pill">${esc(o.status)}</span></div>
          <div style="margin-top:16px">
            ${o.items.map((i) => `<div class="row" style="display:flex;justify-content:space-between;padding:6px 0"><span>${esc(i.name)} ${i.weight ? '(' + esc(i.weight) + ')' : ''} × ${i.qty}</span><span>${money(i.line_total)}</span></div>`).join('')}
          </div>
          <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">
          <div style="display:flex;justify-content:space-between"><span>Delivery</span><span>${o.delivery_charge ? money(o.delivery_charge) : 'FREE'}</span></div>
          ${o.discount ? `<div style="display:flex;justify-content:space-between;color:#1a7f43"><span>Discount</span><span>− ${money(o.discount)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.15rem;margin-top:8px"><span>Total</span><span>${money(o.total)}</span></div>
          <div class="muted" style="margin-top:10px;font-size:.88rem">Payment: ${esc(o.payment_method.toUpperCase())} — ${esc(o.payment_status)}</div>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          ${data.whatsapp_url ? `<a class="btn wa" href="${esc(data.whatsapp_url)}" target="_blank" rel="noopener">Send order on WhatsApp</a>` : ''}
          <a class="btn ghost" href="/track?code=${esc(o.order_code)}" data-link>Track Order</a>
          <a class="btn" href="/products" data-link>Continue Shopping</a>
        </div>
      </div>
    </section></div>`;
  });

  /* ============================ MY ORDERS ========================== */
  function statusPill(s) {
    const map = { Delivered: 'green', Cancelled: 'red', 'Out for Delivery': 'blue', Shipped: 'blue', Pending: 'grey' };
    return `<span class="pill ${map[s] || ''}">${esc(s)}</span>`;
  }
  function tracker(status) {
    const steps = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
    if (status === 'Cancelled') return '<div class="pill red" style="margin-top:14px">This order was cancelled</div>';
    const idx = steps.indexOf(status === 'Shipped' ? 'Out for Delivery' : status);
    return `<div class="tracker">${steps.map((s, i) => `<div class="step ${i <= idx ? 'done' : ''}"><div class="bar"></div>${esc(s)}</div>`).join('')}</div>`;
  }

  function orderCard(o) {
    return `<div class="card order-card">
      <div class="order-head">
        <div><b style="font-family:var(--serif);font-size:1.15rem;color:var(--primary)">${esc(o.order_code)}</b>
          <div class="muted" style="font-size:.84rem">${MKT.dateStr(o.created_at)} • ${o.items ? o.items.length : 0} item(s)</div></div>
        <div style="text-align:right">${statusPill(o.status)}
          <div style="font-weight:700;margin-top:6px">${money(o.total)}</div>
          <div class="muted" style="font-size:.78rem">${esc(o.payment_method.toUpperCase())} — ${esc(o.payment_status)}</div></div>
      </div>
      ${tracker(o.status)}
      <div style="margin-top:14px">${(o.items || []).map((i) => `
        <div style="display:flex;gap:12px;align-items:center;padding:8px 0">
          <img src="${esc(i.image || '/uploads/placeholder.svg')}" style="width:52px;height:52px;border-radius:10px;object-fit:cover">
          <div style="flex:1"><b>${esc(i.name)}</b><div class="muted" style="font-size:.82rem">${i.weight ? esc(i.weight) + ' • ' : ''}Qty ${i.qty}</div></div>
          <div>${money(i.line_total)}</div>
        </div>`).join('')}</div>
      <div class="muted" style="font-size:.85rem;margin-top:10px">Deliver to: ${esc(o.address)}, ${esc(o.city)}, ${esc(o.state)} - ${esc(o.pincode)}</div>
    </div>`;
  }

  MKT.route('/orders', async (app) => {
    if (!MKT.user) {
      app.innerHTML = `<div class="wrap"><div class="empty"><div class="big">🔐</div><h2>Please login</h2>
        <p>Login to see your order history, or track a single order with its Order ID.</p>
        <button class="btn" id="loginNow">Login</button> <a class="btn ghost" href="/track" data-link>Track an order</a></div></div>`;
      document.getElementById('loginNow').onclick = () => MKT.openAuth();
      return;
    }
    const r = await api('/api/my/orders');
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><h1>My Orders</h1><div class="motif-line"></div></div>
      <section class="section" style="padding-top:24px">
        ${r.orders.length ? r.orders.map(orderCard).join('')
        : `<div class="empty"><div class="big">📦</div><h3>No orders yet</h3><a class="btn" href="/products" data-link>Start shopping</a></div>`}
      </section></div>`;
  });

  /* ============================== TRACK ============================= */
  MKT.route('/track', async (app, params, query) => {
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><h1>Track Your Order</h1><div class="motif-line"></div>
        <p>Enter your Order ID and the mobile number used while ordering.</p></div>
      <section class="section" style="padding-top:24px">
        <div class="form-card" style="max-width:520px;margin:0 auto">
          <div id="trackErr"></div>
          <form id="trackForm">
            <div class="field"><label>Order ID</label><input name="code" required value="${esc(query.code || '')}" placeholder="MKT202601011001"></div>
            <div class="field"><label>Mobile number</label><input name="phone" required placeholder="10-digit mobile"></div>
            <button class="btn block" type="submit">Track Order</button>
          </form>
        </div>
        <div id="trackResult" style="margin-top:26px"></div>
      </section></div>`;
    document.getElementById('trackForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const err = document.getElementById('trackErr');
      err.innerHTML = '';
      try {
        const r = await api('/api/orders/track/' + encodeURIComponent(fd.code.trim()) + '?phone=' + encodeURIComponent(fd.phone.trim()));
        document.getElementById('trackResult').innerHTML = orderCard(r.order);
      } catch (e2) { err.innerHTML = `<div class="error-msg">${esc(e2.message)}</div>`; }
    };
  });

  /* ============================= ACCOUNT =========================== */
  MKT.route('/account', async (app) => {
    if (!MKT.user) { MKT.openAuth(); return MKT.go('/', true); }
    const u = MKT.user;
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><h1>My Account</h1><div class="motif-line"></div></div>
      <section class="section" style="padding-top:24px"><div class="grid g2" style="align-items:start">
        <div class="form-card">
          <h3>Profile details</h3>
          <div id="profMsg"></div>
          <form id="profileForm">
            <div class="field"><label>Name</label><input name="name" value="${esc(u.name || '')}" required></div>
            <div class="field"><label>Email</label><input value="${esc(u.email || '')}" disabled></div>
            <div class="field"><label>Mobile</label><input value="${esc(u.phone || '')}" disabled></div>
            <div class="field"><label>Address</label><textarea name="address">${esc(u.address || '')}</textarea></div>
            <div class="form-grid">
              <div class="field"><label>City</label><input name="city" value="${esc(u.city || '')}"></div>
              <div class="field"><label>State</label><input name="state" value="${esc(u.state || '')}"></div>
            </div>
            <div class="form-grid">
              <div class="field"><label>Pincode</label><input name="pincode" value="${esc(u.pincode || '')}"></div>
              <div class="field"><label>Landmark</label><input name="landmark" value="${esc(u.landmark || '')}"></div>
            </div>
            <button class="btn block" type="submit">Save changes</button>
          </form>
        </div>
        <div>
          <div class="form-card" style="margin-bottom:20px">
            <h3>Change password</h3>
            <div id="pwMsg"></div>
            <form id="pwForm">
              <div class="field"><label>Current password</label><input name="current_password" type="password" required></div>
              <div class="field"><label>New password</label><input name="new_password" type="password" minlength="6" required></div>
              <button class="btn ghost block" type="submit">Update password</button>
            </form>
          </div>
          <div class="form-card">
            <h3>Quick links</h3>
            <a class="btn ghost block" href="/orders" data-link style="margin-bottom:10px">My Orders</a>
            <button class="btn dark block" id="logoutBtn">Logout</button>
          </div>
        </div>
      </div></section></div>`;

    document.getElementById('profileForm').onsubmit = async (e) => {
      e.preventDefault();
      const box = document.getElementById('profMsg');
      try {
        const r = await api('/api/auth/profile', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) });
        MKT.user = r.user;
        box.innerHTML = '<div class="success-msg">Profile updated.</div>';
      } catch (err) { box.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
    document.getElementById('pwForm').onsubmit = async (e) => {
      e.preventDefault();
      const box = document.getElementById('pwMsg');
      try {
        await api('/api/auth/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
        box.innerHTML = '<div class="success-msg">Password updated.</div>';
        e.target.reset();
      } catch (err) { box.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
    document.getElementById('logoutBtn').onclick = () => MKT.logout();
  });

  /* =========================== POLICY PAGES ======================== */
  MKT.route('/page/:slug', async (app, params) => {
    const r = await api('/api/pages/' + encodeURIComponent(params.slug));
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><h1>${esc(r.page.title)}</h1><div class="motif-line"></div></div>
      <section class="section" style="padding-top:20px"><div class="prose">${esc(r.page.body)}</div></section>
    </div>`;
  });
})();
