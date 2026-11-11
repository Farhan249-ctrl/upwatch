# UpWatch

UpWatch is an uptime monitor tailored for students deploying projects. It answers one question fast: **is everything I deployed up right now, and if not, since when?**

## Architecture

- **Database**: MongoDB 7.0 storing users, monitors, incidents, and checks (with automatic TTL cleanup via index).
- **API (`backend/`)**: Express REST API providing authentication (JWT), monitor CRUD, owner-scoped queries, 60-bucket strip aggregations (`/api/overview`), check history, running incident tracking, and Telegram alert testing.
- **Worker (`backend/src/worker`)**: Distributed-safe background worker using atomic MongoDB claims (`findOneAndUpdate`) to execute concurrent HTTP checks, track consecutive failure state transitions, open/resolve incidents, and dispatch Telegram notifications.
- **Frontend (`frontend/`)**: Vite, React 18, TypeScript strict, React Router 6, TanStack Query 5, plain CSS with design tokens, self-hosted IBM Plex Sans fonts via `@fontsource`, handcrafted accessible SVG charts and 60-bucket heartbeat strips.

---

## Quickstart (Local Development)

### 1. Environment Setup

Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Ensure `.env` contains valid configuration (e.g. `JWT_SECRET` at least 32 characters, `ALLOW_PRIVATE_TARGETS=true` for local targets).

### 2. Start the Dev Database

```powershell
docker compose -f docker-compose.dev.yml up -d
```
Verify the container is running and healthy:
```powershell
docker compose -f docker-compose.dev.yml ps
```

### 3. Seed Demo Data

Populate 7 days of realistic check distributions, degraded periods, and matched incidents:
```powershell
cd backend
npm run seed:demo
cd ..
```
*Demo credentials: `demo@upwatch.dev` / `DemoSecretPassword123!`*

### 4. Start the Full Stack

In separate terminal windows:

- **API Server** (Port 4000):
  ```powershell
  cd backend
  npm start
  ```

- **Worker Service**:
  ```powershell
  cd backend
  npm run worker
  ```

- **Frontend Client** (Vite dev server with `/api` proxy):
  ```powershell
  cd frontend
  npm run dev
  ```
  Open `http://localhost:5173` in your browser.

---

## Verification & Testing

### Test Suite (10 suites, 31 tests)
Runs all unit and integration tests (including the 10-claimer concurrency claim race test against live MongoDB):
```powershell
powershell -ExecutionPolicy Bypass -File scripts/test.ps1
```

### End-to-End Smoke Test
Registers a fresh user, creates a 15-second monitor against `/api/health`, runs the worker, verifies 2 real checks, and cleans up:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1
```

### Frontend Build & Lint
```powershell
cd frontend
npm run lint
npm run build
```
