'use strict';
/** Public (customer-facing) read APIs + review/contact submission. */
const db = require('../db');
const { V } = require('../lib/http');
const M = require('../lib/models');

function publicSettings() {
  const s = db.allSettings();
  // Only expose non-sensitive settings groups.
  return {
    branding: s.branding || {},
    theme: s.theme || {},
    contact: s.contact || {},
    social: s.social || {},
    delivery: s.delivery || {},
    general: s.general || {},
    seo: s.seo || {},
    footer: s.footer || {}
  };
}

function register(route) {
  /* ---------------- bootstrap (branding + nav + settings) ---------------- */
  route('GET', '/api/bootstrap', () => ({
    ok: true,
    settings: publicSettings(),
    nav: db.all('SELECT id, label, link FROM nav_items WHERE active = 1 ORDER BY sort_order, id'),
    pages: db.all('SELECT slug, title FROM pages ORDER BY id')
  }));

  /* ---------------- homepage ---------------- */
  route('GET', '/api/home', () => {
    const sections = db.all('SELECT * FROM home_sections WHERE active = 1 ORDER BY sort_order, id')
      .map((s) => Object.assign(s, { config: M.parseJson(s.config, {}) }));
    const categories = db.all('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, id');
    const featured = db.all(M.PRODUCT_SELECT + ' WHERE p.active = 1 AND p.featured = 1 ORDER BY p.sort_order, p.id LIMIT 8')
      .map((p) => M.shapeProduct(p));
    const bestsellers = db.all(M.PRODUCT_SELECT + ' WHERE p.active = 1 ORDER BY p.sold_count DESC, p.id DESC LIMIT 8')
      .map((p) => M.shapeProduct(p));
    const banners = db.all('SELECT * FROM banners WHERE active = 1 ORDER BY sort_order, id');
    const testimonials = db.all(
      "SELECT r.id, r.name, r.rating, r.title, r.comment, r.created_at, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.status='approved' AND r.featured=1 ORDER BY r.id DESC LIMIT 12");
    const gallery = db.all("SELECT * FROM cards WHERE section_key = 'gallery' AND active = 1 ORDER BY sort_order, id");
    const usp = db.all("SELECT * FROM cards WHERE section_key = 'usp' AND active = 1 ORDER BY sort_order, id");
    const story = db.all('SELECT * FROM story_sections WHERE active = 1 ORDER BY sort_order, id LIMIT 12');
    const offers = db.all("SELECT code, type, value, min_order, description, expiry FROM coupons WHERE active = 1 ORDER BY id DESC LIMIT 6");
    return { ok: true, sections, categories, featured, bestsellers, banners, testimonials, gallery, usp, story, offers };
  });

  /* ---------------- categories ---------------- */
  route('GET', '/api/categories', () => ({
    ok: true,
    categories: db.all('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, id').map((c) => {
      const n = db.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ? AND active = 1', [c.id]);
      return Object.assign(c, { product_count: n ? n.n : 0 });
    })
  }));

  /* ---------------- product listing ---------------- */
  route('GET', '/api/products', ({ query }) => {
    const where = ['p.active = 1'];
    const params = [];
    if (query.search) {
      where.push('(p.name LIKE ? OR p.short_desc LIKE ? OR p.description LIKE ? OR p.ingredients LIKE ?)');
      const q = '%' + String(query.search).slice(0, 60) + '%';
      params.push(q, q, q, q);
    }
    if (query.category) {
      where.push('(c.slug = ? OR CAST(p.category_id AS TEXT) = ?)');
      params.push(query.category, String(query.category));
    }
    if (query.min) { where.push('COALESCE(NULLIF(p.discount_price,0), p.price) >= ?'); params.push(Number(query.min)); }
    if (query.max) { where.push('COALESCE(NULLIF(p.discount_price,0), p.price) <= ?'); params.push(Number(query.max)); }
    if (query.featured === '1') where.push('p.featured = 1');
    if (query.in_stock === '1') where.push('p.stock > 0');

    const sortMap = {
      'price_asc': 'COALESCE(NULLIF(p.discount_price,0), p.price) ASC',
      'price_desc': 'COALESCE(NULLIF(p.discount_price,0), p.price) DESC',
      'popular': 'p.sold_count DESC, p.id DESC',
      'newest': 'p.id DESC',
      'name': 'p.name ASC',
      'default': 'p.featured DESC, p.sort_order ASC, p.id DESC'
    };
    const order = sortMap[query.sort] || sortMap.default;

    const limit = Math.min(Math.max(parseInt(query.limit || '24', 10), 1), 100);
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const offset = (page - 1) * limit;

    const whereSql = ' WHERE ' + where.join(' AND ');
    const total = db.get(
      'SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id' + whereSql, params);
    const rows = db.all(
      M.PRODUCT_SELECT + whereSql + ` ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params);
    return {
      ok: true,
      products: rows.map((p) => M.shapeProduct(p)),
      total: total ? total.n : 0,
      page, limit,
      pages: Math.ceil((total ? total.n : 0) / limit)
    };
  });

  /* ---------------- single product ---------------- */
  route('GET', '/api/products/:slug', ({ params }) => {
    const p = M.getProductBySlug(params.slug, { full: true })
      || (/^\d+$/.test(params.slug) ? M.getProductById(Number(params.slug), { full: true }) : null);
    if (!p || !p.active) throw Object.assign(new Error('Product not found'), { status: 404 });
    const related = db.all(
      M.PRODUCT_SELECT + ' WHERE p.active = 1 AND p.id <> ? AND (p.category_id = ? OR ? IS NULL) ORDER BY RANDOM() LIMIT 4',
      [p.id, p.category_id, p.category_id]).map((r) => M.shapeProduct(r));
    const reviews = db.all(
      "SELECT id, name, rating, title, comment, created_at FROM reviews WHERE product_id = ? AND status='approved' ORDER BY id DESC",
      [p.id]);
    return { ok: true, product: p, related, reviews };
  });

  /* ---------------- story ---------------- */
  route('GET', '/api/story', () => ({
    ok: true,
    meta: db.getSetting('story_meta', {}),
    sections: db.all('SELECT * FROM story_sections WHERE active = 1 ORDER BY sort_order, id')
  }));

  /* ---------------- about ---------------- */
  route('GET', '/api/about', () => ({
    ok: true,
    about: db.getSetting('about', {}),
    cards: db.all("SELECT * FROM cards WHERE section_key = 'about' AND active = 1 ORDER BY sort_order, id")
  }));

  /* ---------------- static pages ---------------- */
  route('GET', '/api/pages/:slug', ({ params }) => {
    const page = db.get('SELECT * FROM pages WHERE slug = ?', [params.slug]);
    if (!page) throw Object.assign(new Error('Page not found'), { status: 404 });
    return { ok: true, page };
  });

  /* ---------------- reviews ---------------- */
  route('POST', '/api/reviews', async ({ req }) => {
    const { readJson } = require('../lib/http');
    const auth = require('../lib/auth');
    auth.rateLimit(req, 'review', 5, 10 * 60 * 1000);
    const body = await readJson(req);
    const actor = auth.currentActor(req);
    const productId = V.int(body.product_id, 'Product', { required: true, min: 1 });
    if (!db.get('SELECT id FROM products WHERE id = ?', [productId])) throw Object.assign(new Error('Product not found'), { status: 404 });
    const name = V.str(body.name || (actor && actor.user && actor.user.name), 'Name', { required: true, max: 80 });
    const rating = V.int(body.rating, 'Rating', { required: true, min: 1, max: 5 });
    const title = V.str(body.title, 'Title', { max: 120 });
    const comment = V.str(body.comment, 'Review', { max: 2000 });
    const autoApprove = !!db.getSetting('general', {}).auto_approve_reviews;
    const r = db.run(
      'INSERT INTO reviews(product_id, user_id, name, rating, title, comment, status) VALUES(?,?,?,?,?,?,?)',
      [productId, actor && actor.user ? actor.user.id : null, name, rating, title, comment, autoApprove ? 'approved' : 'pending']);
    return { ok: true, id: r.lastId, status: autoApprove ? 'approved' : 'pending', message: autoApprove ? 'Thank you for your review!' : 'Thank you! Your review will appear after approval.' };
  });

  /* ---------------- contact form ---------------- */
  route('POST', '/api/contact', async ({ req }) => {
    const { readJson } = require('../lib/http');
    require('../lib/auth').rateLimit(req, 'contact', 5, 10 * 60 * 1000);
    const b = await readJson(req);
    const name = V.str(b.name, 'Name', { required: true, max: 80 });
    const email = V.email(b.email, 'Email', false);
    const phone = V.phone(b.phone, 'Mobile number', false);
    const subject = V.str(b.subject, 'Subject', { max: 150 });
    const message = V.str(b.message, 'Message', { required: true, max: 3000 });
    if (!email && !phone) throw Object.assign(new Error('Please provide an email or a mobile number'), { status: 400 });
    db.run('INSERT INTO contact_messages(name, email, phone, subject, message) VALUES(?,?,?,?,?)',
      [name, email, phone, subject, message]);
    return { ok: true, message: 'Dhanyavaad! We have received your message and will reply soon.' };
  });

  /* ---------------- coupon validation ---------------- */
  route('POST', '/api/coupons/validate', async ({ req }) => {
    const { readJson } = require('../lib/http');
    require('../lib/auth').rateLimit(req, 'coupon', 20, 10 * 60 * 1000);
    const b = await readJson(req);
    const code = V.str(b.code, 'Coupon code', { required: true, max: 40 }).toUpperCase();
    const subtotal = V.num(b.subtotal, 'Subtotal', { min: 0 });
    const c = db.get('SELECT * FROM coupons WHERE UPPER(code) = ? AND active = 1', [code]);
    if (!c) throw Object.assign(new Error('Invalid coupon code'), { status: 400 });
    if (c.expiry && new Date(c.expiry).getTime() < Date.now() - 86400000) {
      throw Object.assign(new Error('This coupon has expired'), { status: 400 });
    }
    if (c.usage_limit > 0 && c.used_count >= c.usage_limit) {
      throw Object.assign(new Error('This coupon usage limit has been reached'), { status: 400 });
    }
    if (subtotal < c.min_order) {
      throw Object.assign(new Error(`Minimum order value for this coupon is ₹${c.min_order}`), { status: 400 });
    }
    let discount = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value;
    if (c.max_discount > 0) discount = Math.min(discount, c.max_discount);
    discount = Math.min(Math.round(discount * 100) / 100, subtotal);
    return { ok: true, coupon: { code: c.code, type: c.type, value: c.value, description: c.description }, discount };
  });
}

module.exports = { register, publicSettings };
