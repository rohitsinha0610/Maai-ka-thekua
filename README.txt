=====================================================================
  MAAI KA THEKUAA  —  E-commerce Website + Admin Panel
  "Maa ke haath ka swaad, parampara ke saath"
  Version 1.1  —  hosting ready
=====================================================================

-------------------------------------------------
1. RUN IT ON YOUR OWN COMPUTER
-------------------------------------------------
  1. Install Node.js 18 or newer (free, one time):
       https://nodejs.org/en/download   ->  choose the "LTS" version
  2. Double-click  START.bat        (macOS / Linux:  bash start.sh)
  3. The browser opens at:
       Website      ->  http://localhost:3000
       Admin Panel  ->  http://localhost:3000/admin
  4. Keep the window open while using the site. Close it to stop.

-------------------------------------------------
2. DEFAULT LOGINS
-------------------------------------------------
  Admin     :  admin@maaikathekuaa.com  /  admin123
  Customer  :  anjali@example.com       /  demo123     (demo data only)

  Change the admin password from  Admin Panel -> Admin Account.

-------------------------------------------------
3. FOLDER LAYOUT
-------------------------------------------------
  server/            backend
    server.js        HTTP server, routing, security headers, gzip, /healthz
    config.js        reads .env, holds every setting
    db.js            SQLite layer + schema (two drivers, see section 6)
    seed.js          first-run content and demo data
    assets.js        generates the placeholder artwork
    backup.js        `npm run backup`
    selftest.js      `npm run check`  - pre-flight check
    api/             public.js, account.js, orders.js, admin.js
    lib/             auth.js, http.js, models.js
  public/            customer website
    js/app.js        routing, cart, auth, layout
    js/pages.js      page renderers
    js/anim.js       motion layer (scroll reveals, transitions, fly-to-cart)
    css/style.css    theme + motion system
  public/admin/      admin panel
  data/              CREATED ON FIRST RUN - database, uploads, backups
  .env.example       every environment variable, documented

  Everything the app writes lives under  data/ .  Nothing else changes
  at runtime, so that one folder is your whole backup.

-------------------------------------------------
4. COMMANDS
-------------------------------------------------
  npm start          start the server
  npm run check      pre-flight check (permissions, database, config)
  npm run backup     timestamped copy into data/backups
  npm run reseed     WIPE everything and reload the demo content

-------------------------------------------------
5. HOSTING IT
-------------------------------------------------
  The app is ready for a server as-is. On the host:

  1. Copy the project (without node_modules and without data/).
  2. npm install --omit=dev
  3. Create .env from .env.example and set at least:

       NODE_ENV=production
       HOST=0.0.0.0
       PORT=3000
       DATA_DIR=/var/www/maai-data      (or your mounted volume)
       BASE_URL=https://yourdomain.com
       SESSION_SECRET=<long random string>
       ADMIN_EMAIL=you@yourdomain.com
       ADMIN_PASSWORD=<your password>
       TRUST_PROXY=true
       SECURE_COOKIES=true
       FORCE_HTTPS=true
       SEED_DEMO=false                  (start with an empty catalogue)

     Generate the secret with:
       node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

  4. npm run check        -> everything must say [ok]
  5. npm start            (run it under PM2, systemd or your host's runner)
  6. Put Nginx or the platform's proxy in front for HTTPS.

  Things already handled for you:
    - Binds 0.0.0.0 and honours the platform's PORT
    - /healthz endpoint for uptime and platform health checks
    - Graceful shutdown on SIGTERM (no half-written orders)
    - gzip for HTML/CSS/JS/JSON, ETag caching for static files
    - Security headers: CSP, HSTS, nosniff, frame and referrer policy
    - Session cookie gets Secure automatically behind an HTTPS proxy
    - Rate limiting on login, register, orders, reviews, contact, coupons
    - Real client IP read from X-Forwarded-For when TRUST_PROXY is on
    - All state confined to DATA_DIR so a volume mount is enough
    - Animations honour the visitor's "reduce motion" setting automatically

  Schedule a nightly backup:
    0 2 * * *  cd /path/to/app && /usr/bin/node server/backup.js

-------------------------------------------------
6. DATABASE
-------------------------------------------------
  SQLite, at  DATA_DIR/store.db .  Open it with DB Browser for SQLite.

  Two interchangeable drivers, picked automatically:
    better-sqlite3  - native, WAL journal, fastest, fully durable.
                      Used whenever it is installed. `npm install` pulls it
                      in as an optional dependency; on a server it is the
                      one you want.
    sql.js          - SQLite compiled to WebAssembly. Pure JavaScript, needs
                      no compiler, works anywhere. Used automatically if
                      better-sqlite3 is not available (this is what makes
                      START.bat work on a plain Windows machine).

  `npm run check` prints which driver is active.

  Tables: admins, users, sessions, categories, products, product_images,
  orders, order_items, reviews, coupons, banners, settings, nav_items,
  home_sections, story_sections, cards, inventory_log, pages,
  contact_messages.

-------------------------------------------------
7. SECURITY NOTES
-------------------------------------------------
  - Passwords: PBKDF2-SHA512, 210 000 iterations, per-user random salt.
    SESSION_SECRET can be changed at any time without breaking logins.
  - Sessions are random 32-byte tokens stored in the database, with expiry.
  - Admin and customer sessions are different types; a customer token can
    never reach an admin route.
  - Order totals, discounts and delivery charges are always recalculated on
    the server. The browser cannot dictate a price.
  - Uploads are restricted to images, size-capped, and SVGs containing
    scripts are rejected.
  - Payment gateway keys live in .env and are never sent to the browser.

-------------------------------------------------
8. WHAT THE ADMIN PANEL CONTROLS
-------------------------------------------------
  Dashboard, Orders, Products, Categories, Inventory, Customers, Reviews,
  Messages, Coupons, Banners, Branding & Colors, Navbar, Homepage Sections,
  Cards & Gallery, Story (Maai Ki Kahani), Policy Pages, Media Library,
  Store Settings, Admin Account.

  Website name, logo, favicon, colours, menu, homepage layout, story,
  contact details, WhatsApp number, social links, delivery charges and
  offers are all editable without touching code.

=====================================================================
  Made with love for Maai Ka Thekuaa
=====================================================================
