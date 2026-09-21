'use strict';
/** Customer authentication + profile. */
const db = require('../db');
const auth = require('../lib/auth');
const { readJson, V } = require('../lib/http');

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    address: u.address, city: u.city, state: u.state, pincode: u.pincode, landmark: u.landmark
  };
}

function register(route) {
  route('POST', '/api/auth/register', async ({ req, res }) => {
    auth.rateLimit(req, 'register', 5, 15 * 60 * 1000);
    const b = await readJson(req);
    const name = V.str(b.name, 'Name', { required: true, max: 80 });
    const email = V.email(b.email, 'Email', true);
    const phone = V.phone(b.phone, 'Mobile number', true);
    const password = V.str(b.password, 'Password', { required: true, min: 6, max: 100 });
    if (db.get('SELECT id FROM users WHERE email = ?', [email])) {
      throw Object.assign(new Error('An account with this email already exists'), { status: 409 });
    }
    if (db.get('SELECT id FROM users WHERE phone = ?', [phone])) {
      throw Object.assign(new Error('An account with this mobile number already exists'), { status: 409 });
    }
    const salt = auth.makeSalt();
    const r = db.run('INSERT INTO users(name, email, phone, password_hash, salt) VALUES(?,?,?,?,?)',
      [name, email, phone, auth.hashPassword(password, salt), salt]);
    const s = auth.createSession('user', r.lastId);
    auth.setSessionCookie(req, res, s.token);
    return { ok: true, token: s.token, user: publicUser(db.get('SELECT * FROM users WHERE id = ?', [r.lastId])) };
  });

  route('POST', '/api/auth/login', async ({ req, res }) => {
    auth.rateLimit(req, 'login', 10, 15 * 60 * 1000);
    const b = await readJson(req);
    const id = V.str(b.identifier || b.email || b.phone, 'Email or mobile number', { required: true, max: 200 });
    const password = V.str(b.password, 'Password', { required: true, max: 200 });
    const u = db.get('SELECT * FROM users WHERE email = ? OR phone = ?',
      [id.toLowerCase(), id.replace(/[^\d+]/g, '')]);
    if (!u || !auth.verifyPassword(password, u.salt, u.password_hash)) {
      throw Object.assign(new Error('Invalid login details'), { status: 401 });
    }
    if (u.blocked) throw Object.assign(new Error('This account has been blocked. Please contact us.'), { status: 403 });
    auth.rateLimitReset(req, 'login');
    const s = auth.createSession('user', u.id);
    auth.setSessionCookie(req, res, s.token);
    return { ok: true, token: s.token, user: publicUser(u) };
  });

  route('POST', '/api/auth/logout', async ({ req, res }) => {
    auth.destroySession(auth.tokenFromReq(req));
    auth.clearSessionCookie(res);
    return { ok: true };
  });

  route('GET', '/api/auth/me', ({ req }) => {
    const actor = auth.currentActor(req);
    if (!actor || actor.type !== 'user') return { ok: true, user: null };
    return { ok: true, user: publicUser(actor.user) };
  });

  route('PUT', '/api/auth/profile', async ({ req }) => {
    const user = auth.requireUser(req);
    const b = await readJson(req);
    db.run('UPDATE users SET name=?, address=?, city=?, state=?, pincode=?, landmark=? WHERE id=?', [
      V.str(b.name, 'Name', { required: true, max: 80 }),
      V.str(b.address, 'Address', { max: 400 }),
      V.str(b.city, 'City', { max: 80 }),
      V.str(b.state, 'State', { max: 80 }),
      V.pincode(b.pincode),
      V.str(b.landmark, 'Landmark', { max: 150 }),
      user.id
    ]);
    return { ok: true, user: publicUser(db.get('SELECT * FROM users WHERE id = ?', [user.id])) };
  });

  route('POST', '/api/auth/password', async ({ req }) => {
    const user = auth.requireUser(req);
    auth.rateLimit(req, 'pwchange', 10, 15 * 60 * 1000);
    const b = await readJson(req);
    const current = V.str(b.current_password, 'Current password', { required: true });
    const next = V.str(b.new_password, 'New password', { required: true, min: 6, max: 100 });
    const row = db.get('SELECT * FROM users WHERE id = ?', [user.id]);
    if (!auth.verifyPassword(current, row.salt, row.password_hash)) {
      throw Object.assign(new Error('Current password is incorrect'), { status: 401 });
    }
    const salt = auth.makeSalt();
    db.run('UPDATE users SET salt=?, password_hash=? WHERE id=?', [salt, auth.hashPassword(next, salt), user.id]);
    return { ok: true, message: 'Password updated' };
  });
}

module.exports = { register, publicUser };
