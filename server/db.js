'use strict';
/**
 * SQLite database layer.
 *
 * Two drivers, same API:
 *   1. better-sqlite3  - native, WAL journal, real durability. Used whenever it
 *                        is installed (recommended for a hosted server).
 *   2. sql.js          - SQLite compiled to WebAssembly. Pure JavaScript, works
 *                        on any machine with zero build tools. Used as a
 *                        fallback so the project always runs.
 *
 * Either way the file at DB_FILE is a standard SQLite database that can be
 * opened with DB Browser for SQLite, the sqlite3 CLI, or copied as a backup.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

let driver = null;      // 'better-sqlite3' | 'sql.js'
let db = null;          // driver handle
let dirty = false;
let saveTimer = null;
let flushInterval = null;

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });

  let Better = null;
  try {
    Better = require('better-sqlite3');
  } catch (e) { /* not installed - fall back to sql.js */ }

  if (Better) {
    driver = 'better-sqlite3';
    db = new Better(config.DB_FILE);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  } else {
    driver = 'sql.js';
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(config.ROOT, 'node_modules', 'sql.js', 'dist', file)
    });
    db = fs.existsSync(config.DB_FILE)
      ? new SQL.Database(new Uint8Array(fs.readFileSync(config.DB_FILE)))
      : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    // sql.js keeps the database in memory, so flush it to disk periodically.
    flushInterval = setInterval(() => { if (dirty) save(); }, 4000);
    flushInterval.unref();
  }

  createSchema();
  save();
  return db;
}

function save() {
  if (!db) return;
  if (driver === 'better-sqlite3') { dirty = false; return; } // writes are already durable
  const data = db.export();
  const tmp = config.DB_FILE + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, config.DB_FILE);
  dirty = false;
}

function close() {
  try {
    if (flushInterval) clearInterval(flushInterval);
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    save();
    if (driver === 'better-sqlite3' && db) db.close();
  } catch (e) { /* shutting down anyway */ }
}

function scheduleSave() {
  if (driver === 'better-sqlite3') return;
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; save(); }, 120);
}

/** Creates a timestamped copy of the database. Used by `npm run backup`. */
async function backup(destDir) {
  const dir = destDir || path.join(config.DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(dir, `store-${stamp}.db`);
  if (driver === 'better-sqlite3') await db.backup(dest); // online backup, safe while running
  else fs.writeFileSync(dest, Buffer.from(db.export()));
  return dest;
}

/* ------------------------------------------------------------------ */
/* Query helpers - identical signatures on both drivers                */
/* ------------------------------------------------------------------ */

function normalizeArray(params) {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'object') return JSON.stringify(p);
    return p;
  });
}

function all(sql, params = []) {
  const p = normalizeArray(Array.isArray(params) ? params : [params]);
  if (driver === 'better-sqlite3') return db.prepare(sql).all(...p);
  const stmt = db.prepare(sql);
  try {
    stmt.bind(p);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally { stmt.free(); }
}

function get(sql, params = []) {
  if (driver === 'better-sqlite3') {
    const row = db.prepare(sql).get(...normalizeArray(Array.isArray(params) ? params : [params]));
    return row === undefined ? null : row;
  }
  const rows = all(sql, params);
  return rows.length ? rows[0] : null;
}

function run(sql, params = []) {
  const p = normalizeArray(Array.isArray(params) ? params : [params]);
  if (driver === 'better-sqlite3') {
    const info = db.prepare(sql).run(...p);
    return { lastId: Number(info.lastInsertRowid), changes: info.changes };
  }
  const stmt = db.prepare(sql);
  try { stmt.bind(p); stmt.step(); } finally { stmt.free(); }
  scheduleSave();
  const r = get('SELECT last_insert_rowid() AS id, changes() AS changes');
  return { lastId: r ? r.id : null, changes: r ? r.changes : 0 };
}

function exec(sql) {
  if (driver === 'better-sqlite3') db.exec(sql);
  else { db.exec(sql); scheduleSave(); }
}

/** Runs fn inside a transaction. Rolls back if fn throws. */
function tx(fn) {
  if (driver === 'better-sqlite3') return db.transaction(fn)();
  exec('BEGIN');
  try { const out = fn(); exec('COMMIT'); return out; }
  catch (e) { try { exec('ROLLBACK'); } catch (e2) {} throw e; }
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'Administrator',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'owner',
  active INTEGER DEFAULT 1,
  last_login TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  salt TEXT,
  address TEXT, city TEXT, state TEXT, pincode TEXT, landmark TEXT,
  blocked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price REAL NOT NULL DEFAULT 0,
  discount_price REAL DEFAULT 0,
  short_desc TEXT DEFAULT '',
  description TEXT DEFAULT '',
  ingredients TEXT DEFAULT '',
  nutrition TEXT DEFAULT '',
  weight TEXT DEFAULT '',
  weight_options TEXT DEFAULT '[]',
  stock INTEGER DEFAULT 0,
  low_stock_alert INTEGER DEFAULT 5,
  active INTEGER DEFAULT 1,
  featured INTEGER DEFAULT 0,
  sold_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT, phone TEXT, email TEXT,
  address TEXT, city TEXT, state TEXT, pincode TEXT, landmark TEXT,
  subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  delivery_charge REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL DEFAULT 0,
  coupon_code TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'Pending',
  status TEXT DEFAULT 'Pending',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name TEXT, image TEXT, weight TEXT,
  price REAL DEFAULT 0,
  qty INTEGER DEFAULT 1,
  line_total REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  title TEXT DEFAULT '',
  comment TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'percent',
  value REAL DEFAULT 0,
  min_order REAL DEFAULT 0,
  max_discount REAL DEFAULT 0,
  expiry TEXT DEFAULT '',
  usage_limit INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image TEXT DEFAULT '',
  heading TEXT DEFAULT '',
  description TEXT DEFAULT '',
  button_text TEXT DEFAULT '',
  button_link TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS nav_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  link TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS home_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  body TEXT DEFAULT '',
  image TEXT DEFAULT '',
  button_text TEXT DEFAULT '',
  button_link TEXT DEFAULT '',
  button2_text TEXT DEFAULT '',
  button2_link TEXT DEFAULT '',
  config TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS story_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT DEFAULT 'paragraph',
  heading TEXT DEFAULT '',
  body TEXT DEFAULT '',
  image TEXT DEFAULT '',
  meta TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_key TEXT NOT NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  button_text TEXT DEFAULT '',
  button_link TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  change INTEGER DEFAULT 0,
  resulting_stock INTEGER DEFAULT 0,
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT, phone TEXT, subject TEXT, message TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_cat     ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active  ON products(active, featured);
CREATE INDEX IF NOT EXISTS idx_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product  ON reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry  ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_invlog_product   ON inventory_log(product_id);
`;

function createSchema() {
  exec(SCHEMA);
}

/* ------------------------------------------------------------------ */
/* Settings helpers (key/value JSON store)                             */
/* ------------------------------------------------------------------ */

function getSetting(key, fallback = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch (e) { return row.value; }
}

function setSetting(key, value) {
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)]);
}

function allSettings() {
  const out = {};
  for (const r of all('SELECT key, value FROM settings')) {
    try { out[r.key] = JSON.parse(r.value); } catch (e) { out[r.key] = r.value; }
  }
  return out;
}

module.exports = {
  init, all, get, run, exec, tx, save, close, backup,
  getSetting, setSetting, allSettings,
  driverName: () => driver,
  raw: () => db
};
