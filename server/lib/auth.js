'use strict';
/**
 * Authentication.
 *
 * - Passwords: PBKDF2-SHA512, 210 000 iterations, 16-byte per-user random salt.
 *   The salt is the only thing mixed into the hash, so SESSION_SECRET can be
 *   rotated at any time without invalidating existing passwords.
 * - Sessions: 32-byte random tokens stored in the database with an expiry.
 * - Admin and customer sessions are separate actor types: a customer token can
 *   never satisfy an admin-protected route.
 */
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');

const ITERATIONS = 210000;
const KEYLEN = 64;
const DIGEST = 'sha512';
const COOKIE = 'mkt_token';

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  let actual;
  try { actual = hashPassword(password, salt); } catch (e) { return false; }
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ------------------------------ sessions ------------------------------ */

function createSession(actorType, actorId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.SESSION_HOURS * 3600 * 1000).toISOString();
  db.run('INSERT INTO sessions(token, actor_type, actor_id, expires_at) VALUES(?,?,?,?)',
    [token, actorType, actorId, expires]);
  return { token, expires };
}

function destroySession(token) {
  if (token) db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

function purgeExpired() {
  db.run('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]);
}

function readSession(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db.get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return row;
}

function tokenFromReq(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const cookie = req.headers['cookie'] || '';
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** True when the original client request came in over HTTPS. */
function isSecureRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  if (!config.TRUST_PROXY) return false;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

function setSessionCookie(req, res, token) {
  const secure = config.SECURE_COOKIES || isSecureRequest(req);
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${config.SESSION_HOURS * 3600}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/* ------------------------------- actors ------------------------------- */

function currentActor(req) {
  const s = readSession(tokenFromReq(req));
  if (!s) return null;
  if (s.actor_type === 'admin') {
    const admin = db.get('SELECT id, username, email, name, role, active FROM admins WHERE id = ?', [s.actor_id]);
    if (!admin || !admin.active) return null;
    return { type: 'admin', admin, token: s.token };
  }
  const user = db.get(
    'SELECT id, name, email, phone, address, city, state, pincode, landmark, blocked FROM users WHERE id = ?',
    [s.actor_id]);
  if (!user || user.blocked) return null;
  return { type: 'user', user, token: s.token };
}

function requireAdmin(req) {
  const actor = currentActor(req);
  if (!actor || actor.type !== 'admin') {
    throw Object.assign(new Error('Admin authentication required'), { status: 401 });
  }
  return actor.admin;
}

function requireUser(req) {
  const actor = currentActor(req);
  if (!actor || actor.type !== 'user') {
    throw Object.assign(new Error('Please login to continue'), { status: 401 });
  }
  return actor.user;
}

/* ---------------------------- rate limiting --------------------------- */
/**
 * In-memory sliding-window limiter. Keyed by client IP + bucket name.
 * Enough for a single-instance store; swap for Redis only if you ever run
 * more than one process.
 */
const buckets = new Map();

function clientIp(req) {
  if (config.TRUST_PROXY) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimit(req, name, max, windowMs) {
  const key = name + '|' + clientIp(req);
  const now = Date.now();
  let hits = buckets.get(key) || [];
  hits = hits.filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
    throw Object.assign(
      new Error(`Too many attempts. Please try again in ${retry} second(s).`),
      { status: 429, retryAfter: retry });
  }
  hits.push(now);
  buckets.set(key, hits);
}

/** Clears the limiter for a key after a successful action (e.g. valid login). */
function rateLimitReset(req, name) {
  buckets.delete(name + '|' + clientIp(req));
}

setInterval(() => {
  const now = Date.now();
  for (const [k, hits] of buckets) {
    if (!hits.length || now - hits[hits.length - 1] > 3600000) buckets.delete(k);
  }
}, 600000).unref();

module.exports = {
  makeSalt, hashPassword, verifyPassword,
  createSession, destroySession, readSession, purgeExpired,
  tokenFromReq, currentActor, requireAdmin, requireUser,
  setSessionCookie, clearSessionCookie, isSecureRequest,
  rateLimit, rateLimitReset, clientIp, COOKIE
};
