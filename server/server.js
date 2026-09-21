'use strict';
/**
 * Maai Ka Thekuaa - application server.
 *
 *   Customer website  ->  /public
 *   Admin panel       ->  /public/admin
 *   REST API          ->  /api/*
 *   Uploaded images   ->  /uploads/*   (served from DATA_DIR/uploads)
 *   Database          ->  DATA_DIR/store.db
 *
 * Start with:  npm start
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');
const { sendJson, sendError, serveStatic, safeJoin } = require('./lib/http');
const auth = require('./lib/auth');

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([A-Za-z_]+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, rx, keys, handler });
}

require('./api/public').register(route);
require('./api/account').register(route);
require('./api/orders').register(route);
require('./api/admin').register(route);

/* ------------------------------------------------------------------ */
/* Headers                                                             */
/* ------------------------------------------------------------------ */

const CSP = [
  "default-src 'self'",
  // Inline handlers are used by the vanilla-JS frontend and admin panel.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  // Google Maps embed on the contact page.
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'"
].join('; ');

function baseHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', CSP);
  if (auth.isSecureRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

/* ------------------------------------------------------------------ */
/* Request handling                                                    */
/* ------------------------------------------------------------------ */

async function handle(req, res) {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url, `http://${host}`);
  let pathname = url.pathname;
  baseHeaders(req, res);

  // Optional HTTPS redirect (only when a proxy tells us the scheme).
  if (config.FORCE_HTTPS && config.TRUST_PROXY && !auth.isSecureRequest(req) && req.method === 'GET') {
    res.writeHead(301, { Location: 'https://' + host + req.url });
    return res.end();
  }

  // Health check for the hosting platform / uptime monitor.
  if (pathname === '/healthz') {
    return sendJson(res, 200, { ok: true, status: 'healthy', driver: db.driverName(), uptime: Math.round(process.uptime()) });
  }

  /* ---------------- API ---------------- */
  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.rx.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      try {
        const out = await r.handler({ req, res, params, query: Object.fromEntries(url.searchParams) });
        if (out !== undefined && !res.writableEnded) sendJson(res, 200, out, req);
        return;
      } catch (err) {
        if (res.writableEnded) return;
        const status = err.status || 500;
        if (status >= 500) console.error('[api error]', req.method, pathname, err);
        if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
        return sendError(res, status, status >= 500 && config.IS_PROD
          ? 'Something went wrong. Please try again.'
          : (err.message || 'Server error'));
      }
    }
    return sendError(res, 404, 'API route not found');
  }

  /* ---------------- static ---------------- */
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'Method not allowed');

  // Uploaded images live outside the code directory so they can sit on a
  // mounted volume in production.
  if (pathname.startsWith('/uploads/')) {
    const file = safeJoin(config.UPLOAD_DIR, pathname.slice('/uploads/'.length));
    if (file && serveStatic(req, res, file, { maxAge: 86400 })) return;
    return notFound(res);
  }

  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin/index.html';

  const file = safeJoin(config.PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (file) {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (serveStatic(req, res, path.join(file, 'index.html'))) return;
    } else if (serveStatic(req, res, file, { maxAge: /\.(css|js|svg|png|jpg|webp|woff2)$/.test(pathname) ? 3600 : 0 })) {
      return;
    }
  }

  // Client-side routing fallbacks.
  if (pathname.startsWith('/admin')) {
    if (serveStatic(req, res, path.join(config.PUBLIC_DIR, 'admin', 'index.html'))) return;
  }
  if (!path.extname(pathname)) {
    if (serveStatic(req, res, path.join(config.PUBLIC_DIR, 'index.html'))) return;
  }
  return notFound(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>404</title>'
    + '<body style="font-family:system-ui;text-align:center;padding:60px">'
    + '<h1>404 &mdash; Page not found</h1><p><a href="/">Go to the home page</a></p>');
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

  await db.init();
  require('./seed').ensureSeed();
  auth.purgeExpired();
  setInterval(() => auth.purgeExpired(), 6 * 3600 * 1000).unref();

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error('[unhandled]', e);
      if (!res.writableEnded) sendError(res, 500, 'Unexpected server error');
    });
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;

  server.listen(config.PORT, config.HOST, () => {
    const shown = config.BASE_URL || `http://localhost:${config.PORT}`;
    console.log('');
    console.log('  =====================================================');
    console.log('    MAAI KA THEKUAA  -  server running');
    console.log('  =====================================================');
    console.log('    Website      : ' + shown);
    console.log('    Admin Panel  : ' + shown + '/admin');
    console.log('    Environment  : ' + config.NODE_ENV);
    console.log('    Database     : ' + config.DB_FILE + '  (' + db.driverName() + ')');
    console.log('    Uploads      : ' + config.UPLOAD_DIR);
    console.log('    Listening on : ' + config.HOST + ':' + config.PORT);
    if (!config.IS_PROD) {
      console.log('    Admin login  : ' + config.ADMIN_EMAIL + '  /  ' + config.ADMIN_PASSWORD);
    }
    for (const w of config.warnings) console.warn('    [WARNING] ' + w);
    console.log('  -----------------------------------------------------');
    console.log('');
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`\n  ${signal} received - shutting down...`);
    server.close(() => { db.close(); process.exit(0); });
    setTimeout(() => { db.close(); process.exit(0); }, 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (e) => { console.error('[uncaught]', e); });
  process.on('unhandledRejection', (e) => { console.error('[rejection]', e); });
}

main().catch((e) => { console.error('Failed to start server:', e); process.exit(1); });
