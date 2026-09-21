'use strict';
/**
 * Environment configuration.
 *
 * Reads .env when present, falls back to .env.example defaults, and finally to
 * the hard-coded defaults below. Secrets are only ever read here - on the
 * server - and are never sent to the browser.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = Object.assign(
  {},
  loadEnvFile(path.join(ROOT, '.env.example')),
  loadEnvFile(path.join(ROOT, '.env')),
  process.env
);

const bool = (v, def) => {
  if (v === undefined || v === '') return def;
  return /^(1|true|yes|on)$/i.test(String(v));
};
const int = (v, def) => {
  const n = parseInt(v, 10);
  return isFinite(n) ? n : def;
};

const NODE_ENV = env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

/* Writable data directory. On a host with a mounted volume, point DATA_DIR at
   the volume so the database and uploaded images survive redeploys. */
const DATA_DIR = path.resolve(ROOT, env.DATA_DIR || 'data');
const UPLOAD_DIR = path.resolve(ROOT, env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads'));

const config = {
  ROOT,
  NODE_ENV,
  IS_PROD,

  // Network. 0.0.0.0 is required by every hosting platform; localhost-only
  // binding makes the app unreachable from outside the container.
  PORT: int(env.PORT, 3000),
  HOST: env.HOST || '0.0.0.0',
  BASE_URL: (env.BASE_URL || '').replace(/\/+$/, ''),

  // Storage
  DATA_DIR,
  UPLOAD_DIR,
  DB_FILE: path.resolve(ROOT, env.DB_FILE || path.join(DATA_DIR, 'store.db')),
  PUBLIC_DIR: path.join(ROOT, 'public'),
  MAX_UPLOAD_MB: int(env.MAX_UPLOAD_MB, 5),

  // Sessions & security
  SESSION_SECRET: env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  SESSION_HOURS: int(env.SESSION_HOURS, 72),
  // Behind Nginx / a platform load balancer, trust X-Forwarded-Proto so the
  // session cookie gets the Secure flag on HTTPS.
  TRUST_PROXY: bool(env.TRUST_PROXY, IS_PROD),
  FORCE_HTTPS: bool(env.FORCE_HTTPS, false),
  SECURE_COOKIES: bool(env.SECURE_COOKIES, IS_PROD),

  // First-run behaviour
  ADMIN_EMAIL: (env.ADMIN_EMAIL || 'admin@maaikathekuaa.com').toLowerCase(),
  ADMIN_USERNAME: env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: env.ADMIN_PASSWORD || 'admin123',
  SEED_DEMO: bool(env.SEED_DEMO, true),

  // Payment credentials stay server-side only.
  PAYMENT: {
    razorpayKeyId: env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET || '',
    stripeSecretKey: env.STRIPE_SECRET_KEY || ''
  }
};

/* Warn loudly about unsafe production defaults instead of failing silently. */
config.warnings = [];
if (IS_PROD) {
  if (config.SESSION_SECRET.startsWith('insecure-') || config.SESSION_SECRET.length < 24) {
    config.warnings.push('SESSION_SECRET is weak or missing. Set a long random value in .env.');
  }
  if (config.ADMIN_PASSWORD === 'admin123') {
    config.warnings.push('ADMIN_PASSWORD is still the default. Change it in .env before going live.');
  }
}

module.exports = config;
