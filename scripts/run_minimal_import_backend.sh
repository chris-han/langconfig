#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

cd "$BACKEND_DIR"

python -m uvicorn minimal_import_app:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8766}"
