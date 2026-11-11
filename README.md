# UpWatch

UpWatch is an uptime monitor tailored for students deploying projects.

## Architecture

- **API (`backend/`)**: Express REST API providing monitor management, authentication, statistics, time series aggregations, and incident history.
- **Worker (`backend/src/worker`)**: Distributed-safe worker using atomic MongoDB claims (`findOneAndUpdate`) to schedule and run concurrent HTTP checks.
- **Database**: MongoDB 7.0 storing users, monitors, incidents, and checks (with automatic TTL cleanup).

## Quickstart

1. Copy `.env.example` to `.env` and fill in secrets.
2. Start dev database:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
3. Run tests:
   ```powershell
   ./scripts/test.ps1
   ```
