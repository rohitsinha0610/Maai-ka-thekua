'use strict';
/**
 * Pre-flight check. Run `npm run check` after deploying to confirm the server
 * can actually do its job on this machine.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');

const pass = [];
const warn = [];
const fail = [];

function tryWrite(dir) {
  const probe = path.join(dir, '.write-probe');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
}

(async () => {
  console.log('\n  Maai Ka Thekuaa - pre-flight check\n  ' + '-'.repeat(46));

  const [maj] = process.versions.node.split('.').map(Number);
  (maj >= 18 ? pass : fail).push(`Node.js ${process.versions.node}` + (maj >= 18 ? '' : ' (needs 18 or newer)'));

  try { tryWrite(config.DATA_DIR); pass.push(`Data directory writable: ${config.DATA_DIR}`); }
  catch (e) { fail.push(`Data directory NOT writable: ${config.DATA_DIR} (${e.code || e.message})`); }

  try { tryWrite(config.UPLOAD_DIR); pass.push(`Upload directory writable: ${config.UPLOAD_DIR}`); }
  catch (e) { fail.push(`Upload directory NOT writable: ${config.UPLOAD_DIR} (${e.code || e.message})`); }

  try {
    await db.init();
    pass.push(`Database opens with driver: ${db.driverName()}`);
    if (db.driverName() === 'sql.js') {
      warn.push('Running on sql.js. Install better-sqlite3 for a hosted server: npm install better-sqlite3');
    }
    const admins = db.get('SELECT COUNT(*) AS n FROM admins');
    pass.push(`Schema present, admin accounts: ${admins ? admins.n : 0}`);
    db.close();
  } catch (e) {
    fail.push('Database failed to open: ' + e.message);
  }

  config.HOST === '0.0.0.0'
    ? pass.push('Binding to 0.0.0.0 (reachable from outside)')
    : warn.push(`HOST is ${config.HOST} - the site will only be reachable from this machine`);

  if (config.SESSION_SECRET.startsWith('change-this') || config.SESSION_SECRET.startsWith('insecure-') || config.SESSION_SECRET.length < 24) {
    (config.IS_PROD ? fail : warn).push('SESSION_SECRET is the default or too short - set a long random value in .env');
  } else pass.push('SESSION_SECRET is set');

  if (config.ADMIN_PASSWORD === 'admin123') {
    (config.IS_PROD ? fail : warn).push('ADMIN_PASSWORD is still "admin123" - change it in .env before going live');
  } else pass.push('Admin password is not the default');

  if (config.IS_PROD && !config.SECURE_COOKIES) warn.push('SECURE_COOKIES is off - turn it on once HTTPS is working');
  if (!config.IS_PROD) warn.push('NODE_ENV is not "production" - set it on the live server');

  const show = (list, mark) => list.forEach((m) => console.log(`  ${mark} ${m}`));
  show(pass, '[ok]  ');
  show(warn, '[warn]');
  show(fail, '[FAIL]');
  console.log('  ' + '-'.repeat(46));
  console.log(`  ${pass.length} passed, ${warn.length} warning(s), ${fail.length} failure(s)\n`);
  process.exit(fail.length ? 1 : 0);
})();
