'use strict';
/**
 * Creates a timestamped copy of the database in DATA_DIR/backups and deletes
 * copies older than KEEP_DAYS.
 *
 * Run manually:   npm run backup
 * Run nightly:    0 2 * * *  cd /path/to/app && /usr/bin/node server/backup.js
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('./config');

const KEEP_DAYS = parseInt(process.env.KEEP_DAYS || '14', 10);

(async () => {
  try {
    await db.init();
    const file = await db.backup();
    const size = (fs.statSync(file).size / 1024).toFixed(0);
    console.log(`Backup written: ${file} (${size} KB)`);

    const dir = path.join(config.DATA_DIR, 'backups');
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    let removed = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.startsWith('store-') || !f.endsWith('.db')) continue;
      const full = path.join(dir, f);
      if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); removed += 1; }
    }
    if (removed) console.log(`Removed ${removed} backup(s) older than ${KEEP_DAYS} days.`);
    db.close();
    process.exit(0);
  } catch (e) {
    console.error('Backup failed:', e.message);
    process.exit(1);
  }
})();
