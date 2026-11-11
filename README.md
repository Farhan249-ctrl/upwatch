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

## Kubernetes (Minikube)

UpWatch is packaged and verified on Kubernetes (tested on Minikube v1.39.0, Kubernetes v1.37.0).

### Compose vs. Kubernetes Architecture Mapping

| Docker Compose Component | Kubernetes Object Name | Kind | Specifications & Replaced Role |
| :--- | :--- | :--- | :--- |
| `upwatch-db` | `mongo` | Deployment & Service | 1 replica, `Recreate` strategy, `mongo:7.0`, ClusterIP:27017, readiness probe (`mongosh ping`). |
| `upwatch_mongo_data` | `mongo-pvc` | PersistentVolumeClaim | 1Gi `ReadWriteOnce` standard storage claim mounted at `/data/db`. |
| `upwatch-api` | `api` | Deployment & Service | 2 replicas, `RollingUpdate` (`maxSurge: 1, maxUnavailable: 0`), ClusterIP:4000, startup/readiness/liveness HTTP probes. |
| `upwatch-worker` | `worker` | Deployment | 1 replica (scalable), no Service, exec liveness probe (`node src/worker/healthcheck.js`), atomic DB monitor claimer. |
| `upwatch-frontend` | `frontend` | Deployment & Service | 2 replicas, ClusterIP:80, HTTP readiness probe on `/`. |
| `upwatch-nginx` | `upwatch-ingress` | Ingress | Ingress-nginx controller routing `/api` to `api:4000` and `/` to `frontend:80`. |
| `.env` (sensitive keys) | `upwatch-secrets` | Secret | Applied via script; contains `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`. |
| `.env` (non-sensitive keys) | `upwatch-config` | ConfigMap | Contains `API_PORT`, `ALLOW_PRIVATE_TARGETS`, `CHECK_RETENTION_DAYS`, `WORKER_TICK_SECONDS`, `WORKER_CONCURRENCY`, `FAILURE_THRESHOLD`, `DEGRADED_MS`, `WORKER_HEARTBEAT_FILE`, `MONGO_DB`. |

### How to Run on Minikube

1. **Start Minikube and Enable Ingress**:
   ```powershell
   minikube start --driver=docker --cpus=4 --memory=4096
   minikube addons enable ingress
   ```

2. **Generate Kubernetes Secrets**:
   Applies sensitive credentials directly from local `.env` without printing or hardcoding secrets:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/k8s-secrets.ps1
   ```

3. **Apply Manifests**:
   ```powershell
   kubectl apply -f k8s/
   kubectl rollout status deployment/mongo -n upwatch --timeout=300s
   kubectl rollout status deployment/api -n upwatch --timeout=300s
   kubectl rollout status deployment/worker -n upwatch --timeout=300s
   kubectl rollout status deployment/frontend -n upwatch --timeout=300s
   ```

4. **Access the Stack via Ingress Port-Forward**:
   ```powershell
   kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8086:80
   ```
   - **Frontend UI**: [http://localhost:8086/](http://localhost:8086/)
   - **API Health**: [http://localhost:8086/api/health](http://localhost:8086/api/health)

### Worker Horizontal Scaling Proof

During verification, `deployment/worker` was scaled from 1 to 2 replicas:
```powershell
kubectl scale deployment/worker --replicas=2 -n upwatch
```
Across a 60-second observation window with two active worker pods running concurrently, exactly 4 checks were recorded for a monitor configured with a 15-second interval. The check rate remained identical to a single worker's execution rate (rather than doubling to 8 checks):
> *the atomic findOneAndUpdate claim prevents double checking*

### Proven Capabilities
- **Self-Healing**: API pods killed during active traffic recover instantly with zero downtime (HTTP 200 preserved throughout).
- **Data Persistence**: Deletion and recreation of the MongoDB pod retains all users, monitors, and historical check records intact via `mongo-pvc`.
- **Zero-Downtime Rolling Update & Rollback**: Rolling update from v1 to v2 (and subsequent rollback) verified with 100% continuous HTTP 200 health check responses.

---

## Not Yet Done

The following components are outside the scope of Stage 4 and remain to be implemented:
- **Live Jenkins Run**: Declarative `Jenkinsfile` exists in repository, but has not yet been triggered on an active Jenkins agent.
- **EC2 / Cloud Deployment**: Cloud provisioning, domain DNS routing, Let's Encrypt automated ACME certificates, and production AWS/GCP deployments.
- **Kubernetes Ingress on Cloud**: Kubernetes Ingress tested and proven via local controller port-forward; public Cloud LoadBalancer / external IP ingress not yet configured.
