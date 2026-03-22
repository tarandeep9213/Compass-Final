#!/bin/bash
set -e

echo "=========================================="
echo "  CashRoom Compliance System — Backend"
echo "=========================================="

# Create data directory for SQLite (no-op for PostgreSQL)
mkdir -p /app/data

echo "[1/3] Running database migrations..."
alembic upgrade head

echo "[2/3] Seeding demo data (skip if already seeded)..."
python seed.py
python seed_locations.py

echo "[3/3] Starting uvicorn..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1 \
    --log-level info
