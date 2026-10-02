#!/bin/bash
# Daca exista o versiune noua pe GitHub (main), o descarca si reconstruieste site-ul. Fisierul .env nu se atinge.
set -euo pipefail
cd /opt/villa
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git reset -q --hard origin/main
  cd deploy
  docker compose up -d --build
  echo "UPDATED $(date -u +%FT%TZ) $(git rev-parse --short HEAD)"
fi
