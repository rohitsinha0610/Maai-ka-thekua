'use strict';
/** HTTP helpers: JSON bodies, responses, static files with caching, validation. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const config = require('../config');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest\+json)|image\/svg)/;

function acceptsGzip(req) {
  return /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
}

function sendJson(res, status, payload, req) {
  let body = Buffer.from(JSON.stringify(payload), 'utf8');
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (req && acceptsGzip(req) && body.length > 1024) {
    body = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(body);
}

function sendError(res, status, message, extra) {
  sendJson(res, status, Object.assign({ ok: false, error: message }, extra || {}));
}

function readBody(req, limitMb) {
  const limit = (limitMb || config.MAX_UPLOAD_MB + 2) * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try {
    const data = JSON.parse(buf.toString('utf8'));
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('bad shape');
    }
    return data;
  } catch (e) {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

/**
 * Serves a file with ETag / Last-Modified revalidation and gzip for text.
 * `immutable` is used for hashed or content-addressed assets.
 */
function serveStatic(req, res, filePath, { immutable = false, maxAge = 0 } = {}) {
  let stat;
  try { stat = fs.statSync(filePath); } catch (e) { return false; }
  if (!stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = '"' + crypto.createHash('sha1')
    .update(stat.size + '-' + stat.mtimeMs + '-' + filePath).digest('hex').slice(0, 20) + '"';

  const cacheControl = immutable
    ? 'public, max-age=31536000, immutable'
    : maxAge ? `public, max-age=${maxAge}` : 'no-cache';

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
    res.end();
    return true;
  }

  const headers = {
    'Content-Type': type,
    'Cache-Control': cacheControl,
    ETag: etag,
    'Last-Modified': new Date(stat.mtimeMs).toUTCString(),
    'X-Content-Type-Options': 'nosniff'
  };

  if (COMPRESSIBLE.test(type) && acceptsGzip(req) && stat.size > 1024) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    const body = zlib.gzipSync(fs.readFileSync(filePath));
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  }

  headers['Content-Length'] = stat.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

/** Resolves `urlPath` inside `rootDir`, refusing anything that escapes it. */
function safeJoin(rootDir, urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const full = path.join(rootDir, clean);
  const rel = path.relative(rootDir, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return full;
}

/* ---------------------- validation helpers ---------------------- */

function bad(msg) { return Object.assign(new Error(msg), { status: 400 }); }

const V = {
  str(v, field, { required = false, max = 5000, min = 0 } = {}) {
    if (v === undefined || v === null) v = '';
    v = String(v).trim();
    if (required && !v) throw bad(`${field} is required`);
    if (v.length > max) throw bad(`${field} is too long (max ${max})`);
    if (v && v.length < min) throw bad(`${field} is too short (min ${min})`);
    return v;
  },
  num(v, field, { required = false, min = -1e12, max = 1e12, def = 0 } = {}) {
    if (v === undefined || v === null || v === '') {
      if (required) throw bad(`${field} is required`);
      return def;
    }
    const n = Number(v);
    if (!isFinite(n)) throw bad(`${field} must be a number`);
    if (n < min || n > max) throw bad(`${field} must be between ${min} and ${max}`);
    return n;
  },
  int(v, field, opts = {}) { return Math.round(V.num(v, field, opts)); },
  bool(v) { return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0; },
  email(v, field = 'Email', required = false) {
    const s = V.str(v, field, { required, max: 200 });
    if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw bad('Please enter a valid email address');
    return s.toLowerCase();
  },
  phone(v, field = 'Mobile number', required = false) {
    const s = V.str(v, field, { required, max: 20 }).replace(/[^\d+]/g, '');
    if (s && !/^(\+?\d{10,15})$/.test(s)) throw bad('Please enter a valid mobile number');
    return s;
  },
  pincode(v, required = false) {
    const s = V.str(v, 'Pincode', { required, max: 10 });
    if (s && !/^\d{4,10}$/.test(s)) throw bad('Please enter a valid pincode');
    return s;
  },
  oneOf(v, list, field) {
    const s = String(v || '');
    if (!list.includes(s)) throw bad(`${field} must be one of: ${list.join(', ')}`);
    return s;
  },
  /** Internal link or absolute URL. Blocks javascript:/data: injection. */
  link(v, field = 'Link', max = 300) {
    const s = V.str(v, field, { max });
    if (!s) return '';
    if (/^(javascript|data|vbscript):/i.test(s)) throw bad(`${field} is not allowed`);
    return s;
  },
  slug(v) {
    return String(v || '').toLowerCase().trim()
      .replace(/[^a-z0-9ऀ-ॿ ]+/g, '')
      .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'item-' + Date.now();
  }
};

module.exports = { MIME, sendJson, sendError, readBody, readJson, serveStatic, safeJoin, V, bad };
