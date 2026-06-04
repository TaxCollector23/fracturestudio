#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Starting Fracture Studio on http://localhost:8000"
if [ ! -d node_modules ]; then
  npm install
fi
if command -v open >/dev/null 2>&1; then open http://localhost:8000 || true; fi
if command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:8000 >/dev/null 2>&1 || true; fi
npm start
