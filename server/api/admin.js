'use strict';
/**
 * Admin API. Every route below (except /api/admin/login) calls requireAdmin(),
 * which rejects customer tokens and anonymous requests with 401.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const auth = require('../lib/auth');
const { readJson, V } = require('../lib/http');
const M = require('../lib/models');
const { STATUSES, PAY_STATUSES } = require('./orders');

/* ------------------------------------------------------------------ */
/* Generic CRUD factory                                                */
/* ------------------------------------------------------------------ */

const TEXT = (max = 2000) => (v, f) => V.str(v, f, { max });
const NUM = (opts = {}) => (v, f) => V.num(v, f, opts);
const INT = (opts = {}) => (v, f) => V.int(v, f, opts);
const BOOL = () => (v) => V.bool(v);
const JSONF = () => (v) => (typeof v === 'string' ? v : JSON.stringify(v || {}));

const CRUD = {
  categories: {
    order: 'sort_order, id',
    fields: { name: TEXT(80), description: TEXT(600), image: TEXT(500), sort_order: INT(), active: BOOL() },
    required: ['name'],
    beforeSave(data, id) {
      data.slug = M.uniqueSlug('categories', V.slug(data.slug || data.name), id);
      return data;
    }
  },
  banners: {
    order: 'sort_order, id',
    fields: { image: TEXT(500), heading: TEXT(200), description: TEXT(600), button_text: TEXT(60), button_link: (v, f) => V.link(v, f, 300), active: BOOL(), sort_order: INT() }
  },
  nav_items: {
    order: 'sort_order, id',
    fields: { label: TEXT(60), link: (v, f) => V.link(v, f, 300), sort_order: INT(), active: BOOL() },
    required: ['label', 'link']
  },
  home_sections: {
    order: 'sort_order, id',
    fields: {
      type: TEXT(40), title: TEXT(200), subtitle: TEXT(400), body: TEXT(6000), image: TEXT(500),
      button_text: TEXT(60), button_link: (v, f) => V.link(v, f, 300), button2_text: TEXT(60), button2_link: (v, f) => V.link(v, f, 300),
      config: JSONF(), sort_order: INT(), active: BOOL()
    },
    required: ['type']
  },
  story_sections: {
    order: 'sort_order, id',
    fields: { type: TEXT(30), heading: TEXT(200), body: TEXT(8000), image: TEXT(500), meta: TEXT(120), sort_order: INT(), active: BOOL() }
  },
  cards: {
    order: 'sort_order, id',
    fields: { section_key: TEXT(40), title: TEXT(200), description: TEXT(1500), image: TEXT(500), icon: TEXT(40), button_text: TEXT(60), button_link: (v, f) => V.link(v, f, 300), sort_order: INT(), active: BOOL() },
    required: ['section_key']
  },
  coupons: {
    order: 'id DESC',
    fields: { code: TEXT(40), type: TEXT(10), value: NUM({ min: 0 }), min_order: NUM({ min: 0 }), max_discount: NUM({ min: 0 }), expiry: TEXT(30), usage_limit: INT({ min: 0 }), description: TEXT(300), active: BOOL() },
    required: ['code'],
    beforeSave(data) {
      data.code = String(data.code || '').toUpperCase().replace(/\s+/g, '');
      if (data.type && !['percent', 'fixed'].includes(data.type)) throw Object.assign(new Error('Coupon type must be percent or fixed'), { status: 400 });
      return data;
    }
  },
  pages: {
    order: 'id',
    fields: { slug: TEXT(60), title: TEXT(200), body: TEXT(60000) },
    required: ['slug', 'title']
  }
};

function buildData(spec, body, id) {
  const data = {};
  for (const key of Object.keys(spec.fields)) {
    if (body[key] === undefined) continue;
    data[key] = spec.fields[key](body[key], key.replace(/_/g, ' '));
  }
  for (const req of spec.required || []) {
    if ((data[req] === undefined || data[req] === '') && id === undefined) {
      throw Object.assign(new Error(`${req.replace(/_/g, ' ')} is required`), { status: 400 });
    }
  }
  if (spec.beforeSave) {
    if (body.slug !== undefined) data.slug = body.slug;
    return spec.beforeSave(data, id);
  }
  return data;
}

function registerCrud(route, table) {
  const spec = CRUD[table];
  route('GET', `/api/admin/${table}`, ({ req }) => {
    auth.requireAdmin(req);
    return { ok: true, items: db.all(`SELECT * FROM ${table} ORDER BY ${spec.order}`) };
  });
  route('POST', `/api/admin/${table}`, async ({ req }) => {
    auth.requireAdmin(req);
    const data = buildData(spec, await readJson(req));
    const keys = Object.keys(data);
    if (!keys.length) throw Object.assign(new Error('Nothing to save'), { status: 400 });
    const r = db.run(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, keys.map((k) => data[k]));
    return { ok: true, id: r.lastId, item: db.get(`SELECT * FROM ${table} WHERE id = ?`, [r.lastId]) };
  });
  route('PUT', `/api/admin/${table}/:id`, async ({ req, params }) => {
    auth.requireAdmin(req);
    const id = V.int(params.id, 'id', { required: true });
    if (!db.get(`SELECT id FROM ${table} WHERE id = ?`, [id])) throw Object.assign(new Error('Item not found'), { status: 404 });
    const data = buildData(spec, await readJson(req), id);
    const keys = Object.keys(data);
    if (keys.length) {
      db.run(`UPDATE ${table} SET ${keys.map((k) => k + '=?').join(',')} WHERE id = ?`, [...keys.map((k) => data[k]), id]);
    }
    return { ok: true, item: db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]) };
  });
  route('DELETE', `/api/admin/${table}/:id`, ({ req, params }) => {
    auth.requireAdmin(req);
    db.run(`DELETE FROM ${table} WHERE id = ?`, [V.int(params.id, 'id', { required: true })]);
    return { ok: true };
  });
  route('POST', `/api/admin/${table}/reorder`, async ({ req }) => {
    auth.requireAdmin(req);
    const b = await readJson(req);
    const ids = Array.isArray(b.ids) ? b.ids : [];
    ids.forEach((id, i) => db.run(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [i, V.int(id, 'id')]));
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Uploads (base64 JSON upload - no extra dependencies)                */
/* ------------------------------------------------------------------ */

const ALLOWED_IMG = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico' };

function saveUpload(dataUrl, nameHint) {
  const m = /^data:([\w./+-]+);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) throw Object.assign(new Error('Invalid image data'), { status: 400 });
  const mime = m[1];
  const ext = ALLOWED_IMG[mime];
  if (!ext) throw Object.assign(new Error('Only PNG, JPG, WEBP, GIF, SVG or ICO images are allowed'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > config.MAX_UPLOAD_MB * 1024 * 1024) {
    throw Object.assign(new Error(`Image is too large (max ${config.MAX_UPLOAD_MB} MB)`), { status: 413 });
  }
  if (ext === '.svg' && /<script|onload=|javascript:/i.test(buf.toString('utf8'))) {
    throw Object.assign(new Error('This SVG contains scripts and was rejected'), { status: 400 });
  }
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  const safe = String(nameHint || 'img').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'img';
  const file = `${safe}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(config.UPLOAD_DIR, file), buf);
  return '/uploads/' + file;
}

/* ------------------------------------------------------------------ */

function register(route) {
  /* ---------------- auth ---------------- */
  route('POST', '/api/admin/login', async ({ req, res }) => {
    auth.rateLimit(req, 'adminlogin', 8, 15 * 60 * 1000);
    const b = await readJson(req);
    const id = V.str(b.identifier || b.email || b.username, 'Email or username', { required: true, max: 200 });
    const password = V.str(b.password, 'Password', { required: true, max: 200 });
    const a = db.get('SELECT * FROM admins WHERE lower(email) = ? OR lower(username) = ?', [id.toLowerCase(), id.toLowerCase()]);
    if (!a || !a.active || !auth.verifyPassword(password, a.salt, a.password_hash)) {
      throw Object.assign(new Error('Invalid admin credentials'), { status: 401 });
    }
    auth.rateLimitReset(req, 'adminlogin');
    db.run("UPDATE admins SET last_login = datetime('now') WHERE id = ?", [a.id]);
    const s = auth.createSession('admin', a.id);
    auth.setSessionCookie(req, res, s.token);
    return { ok: true, token: s.token, admin: { id: a.id, name: a.name, username: a.username, email: a.email, role: a.role } };
  });

  route('POST', '/api/admin/logout', ({ req, res }) => {
    auth.destroySession(auth.tokenFromReq(req));
    auth.clearSessionCookie(res);
    return { ok: true };
  });

  route('GET', '/api/admin/me', ({ req }) => {
    const actor = auth.currentActor(req);
    if (!actor || actor.type !== 'admin') throw Object.assign(new Error('Not authenticated'), { status: 401 });
    return { ok: true, admin: actor.admin };
  });

  route('POST', '/api/admin/password', async ({ req }) => {
    const admin = auth.requireAdmin(req);
    const b = await readJson(req);
    const current = V.str(b.current_password, 'Current password', { required: true });
    const next = V.str(b.new_password, 'New password', { required: true, min: 6, max: 100 });
    const row = db.get('SELECT * FROM admins WHERE id = ?', [admin.id]);
    if (!auth.verifyPassword(current, row.salt, row.password_hash)) throw Object.assign(new Error('Current password is incorrect'), { status: 401 });
    const salt = auth.makeSalt();
    db.run('UPDATE admins SET salt=?, password_hash=? WHERE id=?', [salt, auth.hashPassword(next, salt), admin.id]);
    db.run("DELETE FROM sessions WHERE actor_type='admin' AND actor_id=? AND token<>?", [admin.id, auth.tokenFromReq(req)]);
    return { ok: true, message: 'Password changed successfully' };
  });

  route('PUT', '/api/admin/account', async ({ req }) => {
    const admin = auth.requireAdmin(req);
    const b = await readJson(req);
    const name = V.str(b.name, 'Name', { max: 80 });
    const username = V.str(b.username, 'Username', { required: true, max: 50 });
    const email = V.email(b.email, 'Email', true);
    if (db.get('SELECT id FROM admins WHERE (lower(email)=? OR lower(username)=?) AND id<>?', [email, username.toLowerCase(), admin.id])) {
      throw Object.assign(new Error('Another admin already uses this email or username'), { status: 409 });
    }
    db.run('UPDATE admins SET name=?, username=?, email=? WHERE id=?', [name || admin.name, username, email, admin.id]);
    return { ok: true, admin: db.get('SELECT id,name,username,email,role FROM admins WHERE id=?', [admin.id]) };
  });

  /* ---------------- dashboard ---------------- */
  route('GET', '/api/admin/stats', ({ req }) => {
    auth.requireAdmin(req);
    const one = (sql, p) => { const r = db.get(sql, p || []); return r ? Object.values(r)[0] || 0 : 0; };
    const today = new Date().toISOString().slice(0, 10);
    const revenueSql = "status <> 'Cancelled'";
    const stats = {
      total_orders: one('SELECT COUNT(*) FROM orders'),
      today_orders: one("SELECT COUNT(*) FROM orders WHERE date(created_at) = ?", [today]),
      total_sales: one(`SELECT COALESCE(SUM(total),0) FROM orders WHERE ${revenueSql}`),
      today_sales: one(`SELECT COALESCE(SUM(total),0) FROM orders WHERE ${revenueSql} AND date(created_at) = ?`, [today]),
      pending_orders: one("SELECT COUNT(*) FROM orders WHERE status IN ('Pending','Confirmed','Preparing')"),
      completed_orders: one("SELECT COUNT(*) FROM orders WHERE status = 'Delivered'"),
      cancelled_orders: one("SELECT COUNT(*) FROM orders WHERE status = 'Cancelled'"),
      total_products: one('SELECT COUNT(*) FROM products'),
      active_products: one('SELECT COUNT(*) FROM products WHERE active = 1'),
      total_customers: one('SELECT COUNT(*) FROM users'),
      total_categories: one('SELECT COUNT(*) FROM categories'),
      pending_reviews: one("SELECT COUNT(*) FROM reviews WHERE status = 'pending'"),
      unread_messages: one('SELECT COUNT(*) FROM contact_messages WHERE read = 0'),
      low_stock: one('SELECT COUNT(*) FROM products WHERE stock <= low_stock_alert')
    };
    const recent_orders = db.all('SELECT id, order_code, customer_name, total, status, payment_status, created_at FROM orders ORDER BY id DESC LIMIT 8');
    const best_sellers = db.all('SELECT id, name, sold_count, price, stock FROM products ORDER BY sold_count DESC, id DESC LIMIT 6');
    const low_stock_items = db.all('SELECT id, name, stock, low_stock_alert FROM products WHERE stock <= low_stock_alert ORDER BY stock ASC LIMIT 10');
    const sales_chart = db.all(
      `SELECT date(created_at) AS day, COALESCE(SUM(total),0) AS amount, COUNT(*) AS orders
       FROM orders WHERE ${revenueSql} AND date(created_at) >= date('now','-13 day')
       GROUP BY day ORDER BY day`);
    const status_chart = db.all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
    const category_chart = db.all(
      `SELECT c.name AS name, COALESCE(SUM(oi.qty),0) AS qty
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       GROUP BY c.id ORDER BY qty DESC LIMIT 8`);
    return { ok: true, stats, recent_orders, best_sellers, low_stock_items, sales_chart, status_chart, category_chart };
  });

  /* ---------------- products ---------------- */
  route('GET', '/api/admin/products', ({ req, query }) => {
    auth.requireAdmin(req);
    const where = [];
    const params = [];
    if (query.search) { where.push('p.name LIKE ?'); params.push('%' + query.search + '%'); }
    if (query.category) { where.push('p.category_id = ?'); params.push(query.category); }
    if (query.status === 'active') where.push('p.active = 1');
    if (query.status === 'inactive') where.push('p.active = 0');
    if (query.status === 'low') where.push('p.stock <= p.low_stock_alert');
    const sql = M.PRODUCT_SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY p.id DESC';
    return { ok: true, items: db.all(sql, params).map((p) => M.shapeProduct(p, { full: true })) };
  });

  route('GET', '/api/admin/products/:id', ({ req, params }) => {
    auth.requireAdmin(req);
    const p = M.getProductById(V.int(params.id, 'id'), { full: true });
    if (!p) throw Object.assign(new Error('Product not found'), { status: 404 });
    return { ok: true, item: p };
  });

  async function saveProduct(req, id) {
    auth.requireAdmin(req);
    const b = await readJson(req);
    const name = V.str(b.name, 'Product name', { required: id === undefined, max: 150 });
    const data = {
      name: name || undefined,
      category_id: b.category_id ? V.int(b.category_id, 'Category') : (b.category_id === null || b.category_id === '' ? null : undefined),
      price: b.price !== undefined ? V.num(b.price, 'Price', { min: 0, required: true }) : undefined,
      discount_price: b.discount_price !== undefined ? V.num(b.discount_price, 'Discount price', { min: 0 }) : undefined,
      short_desc: b.short_desc !== undefined ? V.str(b.short_desc, 'Short description', { max: 400 }) : undefined,
      description: b.description !== undefined ? V.str(b.description, 'Description', { max: 8000 }) : undefined,
      ingredients: b.ingredients !== undefined ? V.str(b.ingredients, 'Ingredients', { max: 2000 }) : undefined,
      nutrition: b.nutrition !== undefined ? V.str(b.nutrition, 'Nutrition', { max: 2000 }) : undefined,
      weight: b.weight !== undefined ? V.str(b.weight, 'Weight', { max: 60 }) : undefined,
      weight_options: b.weight_options !== undefined ? JSON.stringify(Array.isArray(b.weight_options) ? b.weight_options : []) : undefined,
      stock: b.stock !== undefined ? V.int(b.stock, 'Stock', { min: 0, max: 1000000 }) : undefined,
      low_stock_alert: b.low_stock_alert !== undefined ? V.int(b.low_stock_alert, 'Low stock alert', { min: 0 }) : undefined,
      active: b.active !== undefined ? V.bool(b.active) : undefined,
      featured: b.featured !== undefined ? V.bool(b.featured) : undefined,
      sort_order: b.sort_order !== undefined ? V.int(b.sort_order, 'Sort order') : undefined
    };
    if (data.price !== undefined && data.discount_price !== undefined && data.discount_price > 0 && data.discount_price >= data.price) {
      throw Object.assign(new Error('Discount price must be lower than the normal price'), { status: 400 });
    }
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    if (name) data.slug = M.uniqueSlug('products', V.slug(b.slug || name), id);

    let productId = id;
    if (id === undefined) {
      const keys = Object.keys(data);
      const r = db.run(`INSERT INTO products(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, keys.map((k) => data[k]));
      productId = r.lastId;
    } else {
      if (!db.get('SELECT id FROM products WHERE id = ?', [id])) throw Object.assign(new Error('Product not found'), { status: 404 });
      const keys = Object.keys(data);
      if (keys.length) db.run(`UPDATE products SET ${keys.map((k) => k + '=?').join(',')} WHERE id = ?`, [...keys.map((k) => data[k]), id]);
    }

    if (Array.isArray(b.images)) {
      db.run('DELETE FROM product_images WHERE product_id = ?', [productId]);
      b.images.slice(0, 8).forEach((url, i) => {
        const clean = V.str(url, 'Image', { max: 500 });
        if (clean) db.run('INSERT INTO product_images(product_id, url, sort_order) VALUES(?,?,?)', [productId, clean, i]);
      });
    }
    return { ok: true, item: M.getProductById(productId, { full: true }) };
  }

  route('POST', '/api/admin/products', ({ req }) => saveProduct(req, undefined));
  route('PUT', '/api/admin/products/:id', ({ req, params }) => saveProduct(req, V.int(params.id, 'id')));

  route('DELETE', '/api/admin/products/:id', ({ req, params }) => {
    auth.requireAdmin(req);
    db.run('DELETE FROM products WHERE id = ?', [V.int(params.id, 'id')]);
    return { ok: true };
  });

  /* ---------------- inventory ---------------- */
  route('POST', '/api/admin/inventory/:id', async ({ req, params }) => {
    auth.requireAdmin(req);
    const id = V.int(params.id, 'id');
    const b = await readJson(req);
    const p = db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!p) throw Object.assign(new Error('Product not found'), { status: 404 });
    let stock = p.stock;
    if (b.set !== undefined) stock = V.int(b.set, 'Stock', { min: 0 });
    else if (b.change !== undefined) stock = Math.max(0, p.stock + V.int(b.change, 'Change'));
    const reason = V.str(b.reason, 'Reason', { max: 200 }) || 'Manual adjustment';
    db.run('UPDATE products SET stock = ? WHERE id = ?', [stock, id]);
    db.run('INSERT INTO inventory_log(product_id, change, resulting_stock, reason) VALUES(?,?,?,?)', [id, stock - p.stock, stock, reason]);
    return { ok: true, stock };
  });

  route('GET', '/api/admin/inventory', ({ req }) => {
    auth.requireAdmin(req);
    return {
      ok: true,
      items: db.all('SELECT id, name, stock, low_stock_alert, active, price FROM products ORDER BY stock ASC'),
      log: db.all('SELECT l.*, p.name AS product FROM inventory_log l LEFT JOIN products p ON p.id = l.product_id ORDER BY l.id DESC LIMIT 60')
    };
  });

  /* ---------------- orders ---------------- */
  route('GET', '/api/admin/orders', ({ req, query }) => {
    auth.requireAdmin(req);
    const where = [];
    const params = [];
    if (query.status && query.status !== 'all') { where.push('status = ?'); params.push(query.status); }
    if (query.search) {
      where.push('(order_code LIKE ? OR customer_name LIKE ? OR phone LIKE ?)');
      const q = '%' + query.search + '%';
      params.push(q, q, q);
    }
    const sql = 'SELECT * FROM orders' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY id DESC LIMIT 300';
    return { ok: true, items: db.all(sql, params).map(M.orderWithItems), statuses: STATUSES, payment_statuses: PAY_STATUSES };
  });

  route('GET', '/api/admin/orders/:id', ({ req, params }) => {
    auth.requireAdmin(req);
    const o = M.orderWithItems(db.get('SELECT * FROM orders WHERE id = ?', [V.int(params.id, 'id')]));
    if (!o) throw Object.assign(new Error('Order not found'), { status: 404 });
    return { ok: true, item: o };
  });

  route('PUT', '/api/admin/orders/:id', async ({ req, params }) => {
    auth.requireAdmin(req);
    const id = V.int(params.id, 'id');
    const b = await readJson(req);
    const o = db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!o) throw Object.assign(new Error('Order not found'), { status: 404 });
    const sets = [];
    const vals = [];
    if (b.status !== undefined) {
      const st = V.oneOf(b.status, STATUSES, 'Order status');
      sets.push('status = ?'); vals.push(st);
      // Restock on cancellation
      if (st === 'Cancelled' && o.status !== 'Cancelled') {
        for (const it of db.all('SELECT * FROM order_items WHERE order_id = ?', [id])) {
          if (!it.product_id) continue;
          db.run('UPDATE products SET stock = stock + ?, sold_count = MAX(sold_count - ?,0) WHERE id = ?', [it.qty, it.qty, it.product_id]);
          const p = db.get('SELECT stock FROM products WHERE id = ?', [it.product_id]);
          db.run('INSERT INTO inventory_log(product_id, change, resulting_stock, reason) VALUES(?,?,?,?)', [it.product_id, it.qty, p ? p.stock : 0, 'Cancelled ' + o.order_code]);
        }
      }
    }
    if (b.payment_status !== undefined) { sets.push('payment_status = ?'); vals.push(V.oneOf(b.payment_status, PAY_STATUSES, 'Payment status')); }
    if (b.notes !== undefined) { sets.push('notes = ?'); vals.push(V.str(b.notes, 'Notes', { max: 1000 })); }
    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      db.run(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    }
    return { ok: true, item: M.orderWithItems(db.get('SELECT * FROM orders WHERE id = ?', [id])) };
  });

  route('DELETE', '/api/admin/orders/:id', ({ req, params }) => {
    auth.requireAdmin(req);
    db.run('DELETE FROM orders WHERE id = ?', [V.int(params.id, 'id')]);
    return { ok: true };
  });

  /* ---------------- customers ---------------- */
  route('GET', '/api/admin/customers', ({ req, query }) => {
    auth.requireAdmin(req);
    const rows = db.all(`
      SELECT u.id, u.name, u.email, u.phone, u.address, u.city, u.state, u.pincode,
             u.blocked, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
        (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.user_id = u.id AND o.status <> 'Cancelled') AS total_spent,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order
      FROM users u ORDER BY u.id DESC`);
    const guests = db.all(`
      SELECT customer_name AS name, phone, email, COUNT(*) AS order_count,
             COALESCE(SUM(total),0) AS total_spent, MAX(created_at) AS last_order
      FROM orders WHERE user_id IS NULL GROUP BY phone ORDER BY last_order DESC`);
    return {
      ok: true,
      items: rows.map((u) => ({
        id: u.id, name: u.name, email: u.email, phone: u.phone,
        address: [u.address, u.city, u.state, u.pincode].filter(Boolean).join(', '),
        blocked: u.blocked, created_at: u.created_at,
        order_count: u.order_count, total_spent: u.total_spent, last_order: u.last_order
      })),
      guests
    };
  });

  route('GET', '/api/admin/customers/:id', ({ req, params }) => {
    auth.requireAdmin(req);
    const id = V.int(params.id, 'id');
    const u = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!u) throw Object.assign(new Error('Customer not found'), { status: 404 });
    delete u.password_hash; delete u.salt;
    return { ok: true, item: u, orders: db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [id]) };
  });

  route('PUT', '/api/admin/customers/:id', async ({ req, params }) => {
    auth.requireAdmin(req);
    const b = await readJson(req);
    db.run('UPDATE users SET blocked = ? WHERE id = ?', [V.bool(b.blocked), V.int(params.id, 'id')]);
    return { ok: true };
  });

  /* ---------------- reviews ---------------- */
  route('GET', '/api/admin/reviews', ({ req, query }) => {
    auth.requireAdmin(req);
    const where = query.status && query.status !== 'all' ? ' WHERE r.status = ?' : '';
    const params = where ? [query.status] : [];
    return {
      ok: true,
      items: db.all('SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id' + where + ' ORDER BY r.id DESC LIMIT 300', params)
    };
  });

  route('PUT', '/api/admin/reviews/:id', async ({ req, params }) => {
    auth.requireAdmin(req);
    const b = await readJson(req);
    const id = V.int(params.id, 'id');
    const sets = [], vals = [];
    if (b.status !== undefined) { sets.push('status = ?'); vals.push(V.oneOf(b.status, ['pending', 'approved', 'rejected'], 'Status')); }
    if (b.featured !== undefined) { sets.push('featured = ?'); vals.push(V.bool(b.featured)); }
    if (sets.length) db.run(`UPDATE reviews SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    return { ok: true, item: db.get('SELECT * FROM reviews WHERE id = ?', [id]) };
  });

  route('DELETE', '/api/admin/reviews/:id', ({ req, params }) => {
    auth.requireAdmin(req);
    db.run('DELETE FROM reviews WHERE id = ?', [V.int(params.id, 'id')]);
    return { ok: true };
  });

  /* ---------------- messages ---------------- */
  route('GET', '/api/admin/messages', ({ req }) => {
    auth.requireAdmin(req);
    return { ok: true, items: db.all('SELECT * FROM contact_messages ORDER BY id DESC LIMIT 200') };
  });
  route('PUT', '/api/admin/messages/:id', async ({ req, params }) => {
    auth.requireAdmin(req);
    db.run('UPDATE contact_messages SET read = 1 WHERE id = ?', [V.int(params.id, 'id')]);
    return { ok: true };
  });
  route('DELETE', '/api/admin/messages/:id', ({ req, params }) => {
    auth.requireAdmin(req);
    db.run('DELETE FROM contact_messages WHERE id = ?', [V.int(params.id, 'id')]);
    return { ok: true };
  });

  /* ---------------- settings ---------------- */
  route('GET', '/api/admin/settings', ({ req }) => {
    auth.requireAdmin(req);
    const s = db.allSettings();
    return { ok: true, settings: s, payment_configured: !!(config.PAYMENT.razorpayKeyId || config.PAYMENT.stripeSecretKey) };
  });

  route('PUT', '/api/admin/settings', async ({ req }) => {
    auth.requireAdmin(req);
    const b = await readJson(req);
    const allowed = ['branding', 'theme', 'contact', 'social', 'delivery', 'general', 'about', 'story_meta', 'seo', 'footer'];
    // Settings are JSON blobs, so cap their size to keep a bad paste from bloating the DB.
    for (const key of Object.keys(b)) {
      if (!allowed.includes(key)) continue;
      if (typeof b[key] !== 'object' || b[key] === null) continue;
      const current = db.getSetting(key, {});
      db.setSetting(key, Object.assign({}, current, b[key]));
    }
    return { ok: true, settings: db.allSettings() };
  });

  /* ---------------- uploads ---------------- */
  route('POST', '/api/admin/upload', async ({ req }) => {
    auth.requireAdmin(req);
    const b = await readJson(req);
    const url = saveUpload(b.data, b.name);
    return { ok: true, url };
  });

  route('GET', '/api/admin/media', ({ req }) => {
    auth.requireAdmin(req);
    let files = [];
    try {
      files = fs.readdirSync(config.UPLOAD_DIR)
        .filter((f) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(f))
        .map((f) => ({ url: '/uploads/' + f, name: f, mtime: fs.statSync(path.join(config.UPLOAD_DIR, f)).mtimeMs }))
        .sort((a, b2) => b2.mtime - a.mtime);
    } catch (e) { /* ignore */ }
    return { ok: true, files };
  });

  route('DELETE', '/api/admin/media', async ({ req }) => {
    auth.requireAdmin(req);
    const b = await readJson(req);
    const name = path.basename(String(b.name || ''));
    const file = path.join(config.UPLOAD_DIR, name);
    if (file.startsWith(config.UPLOAD_DIR) && fs.existsSync(file)) fs.unlinkSync(file);
    return { ok: true };
  });

  /* ---------------- generic CRUD tables ---------------- */
  Object.keys(CRUD).forEach((t) => registerCrud(route, t));
}

module.exports = { register };
