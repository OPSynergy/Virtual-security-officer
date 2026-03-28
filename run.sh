#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Virtual Security Officer — Local Dev"
echo "---------------------------------------------"

is_port_open() {
  python3 - "$1" "$2" <<'PY'
import socket, sys
host = sys.argv[1]
port = int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(0.5)
try:
    s.connect((host, port))
    print("open")
except Exception:
    print("closed")
finally:
    s.close()
PY
}

ensure_postgres() {
  if [ "$(is_port_open localhost 5432)" = "open" ]; then
    echo "PostgreSQL already running on :5432"
    return
  fi

  echo "PostgreSQL not running, attempting startup..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql || true
  fi
  if command -v service >/dev/null 2>&1; then
    sudo service postgresql start || true
  fi
  if command -v pg_ctlcluster >/dev/null 2>&1; then
    sudo pg_ctlcluster --skip-systemctl-redirect 16 main start || true
    sudo pg_ctlcluster --skip-systemctl-redirect 15 main start || true
    sudo pg_ctlcluster --skip-systemctl-redirect 14 main start || true
  fi

  if [ "$(is_port_open localhost 5432)" != "open" ]; then
    echo "Failed to start PostgreSQL on :5432."
    echo "Please install/start PostgreSQL, then rerun ./run.sh"
    exit 1
  fi
}

ensure_redis() {
  if [ "$(is_port_open localhost 6379)" = "open" ]; then
    echo "Redis already running on :6379"
    return
  fi

  echo "Redis not running, attempting startup..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start redis-server || true
    sudo systemctl start redis || true
  fi
  if command -v service >/dev/null 2>&1; then
    sudo service redis-server start || true
    sudo service redis start || true
  fi
  if command -v redis-server >/dev/null 2>&1; then
    redis-server --daemonize yes >/dev/null 2>&1 || true
  fi

  if [ "$(is_port_open localhost 6379)" != "open" ]; then
    echo "Failed to start Redis on :6379."
    echo "Please install/start Redis, then rerun ./run.sh"
    exit 1
  fi
}

ensure_nmap() {
  if command -v nmap >/dev/null 2>&1; then
    echo "nmap found: $(command -v nmap) ($(nmap --version 2>/dev/null | head -n1 || echo ok))"
    return
  fi
  echo ""
  echo "ERROR: nmap is required for the Ports scan (Celery runs python-nmap against the nmap binary)."
  echo "Install it, then rerun ./run.sh:"
  echo "  Debian/Ubuntu:  sudo apt install nmap"
  echo "  Fedora/RHEL:    sudo dnf install nmap"
  echo "  macOS:          brew install nmap"
  echo ""
  exit 1
}

ensure_postgres
ensure_redis
ensure_nmap

if [ -f "backend/.venv/bin/activate" ]; then
  source backend/.venv/bin/activate
else
  echo "Missing backend virtualenv at backend/.venv."
  echo "Run: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

echo "Applying database migrations..."
(cd backend && alembic upgrade head)

echo "Initializing local SQLite (vso.db / history table)..."
python3 scripts/init_vso_sqlite.py

echo "Starting FastAPI backend..."
(cd backend && uvicorn app.main:app --reload --port 8000) &
echo "Starting Celery worker..."
(cd backend && celery -A app.tasks.celery_app worker --loglevel=info) &
echo "Starting Celery beat..."
(cd backend && celery -A app.tasks.celery_app beat --loglevel=info) &
echo "Starting React frontend..."
(cd frontend && npm run dev -- --port 3000) &
echo ""
echo "Virtual Security Officer is running!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
wait
