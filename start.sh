#!/usr/bin/env bash
# Maai Ka Thekuaa - start script for macOS / Linux
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ====================================================="
echo "     MAAI KA THEKUAA  -  Starting your website"
echo "  ====================================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  [X] Node.js not found. Install it from https://nodejs.org and try again."
  exit 1
fi
echo "  [OK] Node.js $(node -v) found."

if [ ! -f "node_modules/sql.js/package.json" ]; then
  echo "  [..] Installing dependencies..."
  npm install --no-audit --no-fund || exit 1
fi
echo "  [OK] Dependencies ready."

( sleep 2; (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) || (command -v open >/dev/null && open http://localhost:3000) ) >/dev/null 2>&1 &

echo ""
echo "   Website     :  http://localhost:3000"
echo "   Admin Panel :  http://localhost:3000/admin"
echo "   Admin login :  admin@maaikathekuaa.com  /  admin123"
echo ""

node server/server.js
