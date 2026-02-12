#!/usr/bin/env bash
set -euo pipefail

npm ci --prefix frontend
npm run --prefix frontend build

rm -rf firebase/dist
mv -f frontend/dist firebase/dist
