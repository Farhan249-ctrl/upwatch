# UpWatch

UpWatch is an uptime monitor tailored for students deploying projects. It answers one question fast: **is everything I deployed up right now, and if not, since when?**

---

## Production-Style Docker Compose Architecture

### Text Architecture Diagram

```
User (Browser / Client)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                       upwatch-nginx                         │
│   Published: 8082 (HTTP -> 8444 redirect), 8444 (HTTPS TLS) │
│   Network: edge                                             │
└──────────────┬──────────────────────────────┬───────────────┘
               │ /                            │ /api/
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│       upwatch-frontend       │ │        upwatch-api         │
│   Nginx serving SPA static   │ │   Node 20 Express REST API │
│   Private (Network: edge)    │ │   Networks: edge, private  │
└──────────────────────────────┘ └─────────────┬──────────────┘
                                               │
                                               │ (MONGO_URI)
                                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│        upwatch-worker        │ │         upwatch-db         │
│   Node 20 Background Checker │ │   MongoDB 7.0 (TTL Index)  │
│   Network: private           │─┼──>Private (Network: private│
│   (Atomic check claims)      │ │   Volume: upwatch_mongo_   │
└──────────────────────────────┘ └────────────────────────────┘
```

### Container Responsibilities

| Container Name | Service | Base Image | Network | Published Ports | Responsibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `upwatch-nginx` | `nginx` | `nginx:1.27-alpine` | `edge` | `8082:80`, `8444:443` | Reverse proxy edge with TLS termination, HTTP->HTTPS redirect, security headers, and request routing. |
| `upwatch-frontend` | `frontend` | `nginx:1.27-alpine` | `edge` | *None* | High-performance static web server serving the Vite/React/TS production build (`dist/`) with SPA fallback. |
| `upwatch-api` | `api` | `node:20.18-alpine` | `edge`, `private` | *None* | Express backend handling authentication (JWT), monitor CRUD, 60-bucket strip aggregations, stats, and checks. |
| `upwatch-worker` | `worker` | `node:20.18-alpine` | `private` | *None* | Background scheduler claiming due monitors atomically and executing concurrent HTTP checks with heartbeat healthcheck. |
| `upwatch-db` | `mongo` | `mongo:7.0` | `private` | *None* | Primary data store for users, monitors, checks (with TTL index), and incidents. Backed by persistent named volume. |

### Why the Worker is a Separate Container

1. **Independent Lifecycle & Fault Isolation**: Check execution loops, network timeouts, or memory pressure during concurrent HTTP requests never degrade or crash the user-facing HTTP API server.
2. **Horizontal Scalability**: Background workers can be scaled independently (`docker compose up -d --scale worker=3`) without duplicating the API surface.
3. **Atomic Work Distribution**: Workers utilize atomic MongoDB operations (`findOneAndUpdate` with `nextCheckAt`) so multiple instances never execute duplicate checks for the same target.
4. **Distinct Resource Boundaries**: Independent cgroup limits prevent worker spikes from impacting API latency or DB connectivity.

### The `host.docker.internal` Note

The `worker` container is configured with `extra_hosts: ["host.docker.internal:host-gateway"]` and `ALLOW_PRIVATE_TARGETS=true`. This allows the worker inside Docker to monitor services running directly on the host machine (such as developer demo targets or SlotLock) via `http://host.docker.internal:<PORT>` without requiring public IP routing.

---

## Running the Production Compose Stack

### 1. Generate TLS Certificates

Run the self-contained cert generation script:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/gen-cert.ps1
```
*Uses the host `openssl` binary if present, or automatically falls back to an ephemeral `alpine:3.21` container with OpenSSL installed. Certificates are saved to `nginx/certs/` (git-ignored).*

### 2. Configure Environment

Ensure `.env` exists and contains a secure `MONGO_ROOT_PASSWORD`:
```powershell
Copy-Item .env.example .env
```
*(Configure `MONGO_ROOT_PASSWORD` with 32+ random characters).*

### 3. Build & Start the Stack

```powershell
docker compose up -d
```

Verify all 5 services are running and healthy:
```powershell
docker compose ps
```

### 4. Access the Application

- **Web Dashboard (HTTPS)**: [https://localhost:8444](https://localhost:8444)
- **HTTP Redirect**: [http://localhost:8082](http://localhost:8082) redirects to port 8444.
- **REST API**: `https://localhost:8444/api`

---

## Verification & Testing

### Verification Evidence Suite (`scripts/evidence.ps1`)
Runs all 7 production-grade stack verifications and writes timestamped outputs to `docs/evidence.txt`:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/evidence.ps1
```

1. **HTTPS 8444**: Returns HTTP 200 with valid HTML.
2. **HTTP 8082**: Returns HTTP 301 redirecting to `https://localhost:8444/`.
3. **API via Edge**: Successfully registers, logs in, and creates monitors through `https://localhost:8444/api`.
4. **Mongo Isolation**: Database has no published host port (`docker compose port mongo 27017` returns `:0`).
5. **Worker Execution**: Worker claims monitors, records checks, and transitions monitor state to `UP`.
6. **Persistence**: Stack destroyed with `docker compose down` (no `-v`) and recreated with `docker compose up -d`; user accounts and monitor history remain intact.
7. **Resource Bounds**: Real memory and CPU stats captured under limits.

### Unit & Integration Tests (11 suites, 34 tests)
```powershell
powershell -ExecutionPolicy Bypass -File scripts/test.ps1
```

---

## Local Development (Dev Database Only)

To develop locally without running the full container stack:
```powershell
docker compose -f docker-compose.dev.yml up -d
cd backend && npm run seed:demo
npm start
# in another terminal:
npm run worker
# in another terminal:
cd ../frontend && npm run dev
```

---

## Not Yet Done

The following components are outside the scope of Stage 3 and have not been executed or deployed:
- **Kubernetes Deployment**: Helm charts, Kubernetes manifests, ingress controllers, and Minikube pod deployment.
- **Docker Hub Push**: Production images have been built and tagged locally (`farhan14031/upwatch-*:v1`), but not pushed to Docker Hub registry.
- **Live Jenkins Run**: The declarative `Jenkinsfile` has been authored and committed, but not yet executed on a live Jenkins server.
- **Cloud / EC2 Hosting**: Cloud provisioning, domain DNS routing, Let's Encrypt automated ACME certificates, and production AWS/GCP deployments.
