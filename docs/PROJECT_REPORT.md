# Smart City Environmental Monitoring — Project Report

**Masters Software Engineering — Capstone**
Designing a Scalable Smart City Environmental Monitoring System Using
Distributed Systems Principles & Cloud Automation.

---

## 1. Requirements

### 1.1 Functional
- Ingest real-time environmental readings (air quality, noise, temperature,
  humidity) from many IoT sensors.
- Process the stream in real time: filter, enrich, and derive alert levels.
- Persist readings in a write-optimised time-series store and sensor metadata in
  a relational store.
- Expose aggregated metrics, latest readings, and alerts via a REST API.
- Visualise live data on a web dashboard for city administrators.

### 1.2 Non-functional
| Concern | Approach |
|---------|----------|
| Scalability | Stateless microservices; Kafka decouples stages; AKS HPA autoscaling |
| Reliability | Kafka durable log + consumer groups; restart policies; health probes |
| Performance | Time-series DB for high write throughput; partitioned topics |
| Security | Secrets in Azure Key Vault; K8s RBAC; Pod Security Standards; TLS to SQL |
| Observability | App Insights + Log Analytics + Azure Monitor alerts |
| Cost | Serverless SQL (auto-pause), burstable AKS nodes, free-tier monitoring, budget alerts |
| Portability | Containerised; identical code runs via Docker Compose and on AKS |

---

## 2. Architecture

![Smart City architecture](architecture.svg)

**Communication protocols:** Kafka (async messaging) between pipeline stages;
REST/HTTP between the dashboard and API, and between the API and the databases.

### 2.1 Microservices
| Service | Tech | Responsibility |
|---------|------|----------------|
| Producer | Node + KafkaJS | Simulate sensors → `sensor-data` |
| Stream processor | **Apache Spark Structured Streaming** (`backend/spark/stream.py`) | Filter/enrich, derive alerts → `processed-data` |
| Storage | Node + `azure-kusto-ingest` | `processed-data` → Azure Data Explorer time-series |
| API | Express 5 | REST over Azure Data Explorer (KQL) + Azure SQL |
| Frontend | React + Vite + nginx | Live dashboard |

---

## 3. Database design

![Database design](database.svg)

Two stores, each matched to its workload (the standard IoT split):

**Time-series (Azure Data Explorer):** the high-write reading stream. ADX is the
Azure-native time-series database recommended for this workload: column-store
storage tuned for append-heavy telemetry, **streaming ingestion** for near
real-time visibility, and **KQL** for fast time-window aggregation. The storage
service streams each processed reading into a single `Readings` table via a JSON
ingestion mapping (`backend/db/adx-schema.kql`):

```kql
.create table Readings (
    sensorId: string, temperature: real, humidity: real,
    airQuality: int, noise: int, alert: string, timestamp: datetime
)
.alter table Readings policy streamingingestion enable
```

The API's read endpoints map one-to-one to KQL queries (latest-per-sensor via
`summarize arg_max(timestamp, *) by sensorId`; windowed averages via
`where timestamp >= ago(Nm) | summarize avg(...) by sensorId`; alerts via
`where alert != "NORMAL"`).

> *Why ADX over MongoDB:* the requirement names a time-series database (e.g.
> Azure Data Explorer). ADX keeps the whole stack Azure-native (Key Vault, AKS
> managed identity, App Insights) and provides purpose-built time-series
> analytics with KQL, rather than a general-purpose document store.

**Relational (Azure SQL):** slow-changing sensor metadata.

```sql
CREATE TABLE dbo.sensors (
  sensor_id    NVARCHAR(50)  PRIMARY KEY,
  name         NVARCHAR(100) NOT NULL,
  type         NVARCHAR(50)  NOT NULL DEFAULT 'environmental',
  location     NVARCHAR(100) NOT NULL,
  latitude     FLOAT, longitude FLOAT,
  installed_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  status       NVARCHAR(20)  NOT NULL DEFAULT 'active'
);
-- Indexed on status and type for dashboard filters.
```

The API **joins** the two: readings (ADX) are enriched with name/location (SQL)
so the dashboard shows "AQI 142 at MG Road" rather than "sensor-1". Scripts:
`backend/db/adx-schema.kql` (ADX table + ingestion mapping), `backend/db/adx.js` (Kusto ingest +
query helpers), `backend/db/schema.sql` (SQL DDL), `backend/db/seed.js`
(idempotent `MERGE` seed), `backend/db/sql.js` (pooled connection, TLS, lazy
config for Key Vault).

---

## 4. Stream processing

Spark reads `sensor-data`, parses JSON to a typed schema, derives an `alert`
column via thresholds (AQI > 200 → HIGH POLLUTION, > 100 → MODERATE, temp > 38 →
HEAT, noise > 90 → NOISE, else NORMAL), stamps `processedAt`, and writes JSON to
`processed-data`. Checkpointing gives exactly-once-ish recovery. The same
thresholds are documented and unit-tested in `backend/processor/classify.js`
(`test/classify.test.js`).

---

## 5. Containerisation & orchestration

- **Docker:** one production-grade multi-purpose Node image (layer-cached
  `npm ci --omit=dev`) + a multi-stage nginx image for the frontend.
- **Docker Compose:** full local stack (Kafka KRaft, all services, dashboard);
  the time-series store is Azure Data Explorer (cloud), configured via env.
- **Kubernetes (`k8s/`):** Deployments, Services, ConfigMap/Secret,
  **resource requests+limits on every pod**, **HPA autoscaling** (API 2→6 on
  CPU/memory), readiness/liveness probes, a one-shot topic-setup Job,
  **RBAC** (least-privilege ServiceAccount), and **Pod Security Standards**
  (baseline enforced). `kubectl apply -k k8s/`.

---

## 6. CI/CD

`azure-pipelines.yml` (Azure DevOps Pipelines):
1. **test** — `npm ci && npm test`.
2. **build** — build & push backend + frontend images to **Azure Container
   Registry (ACR)**, tagged `latest` and the commit SHA.
3. **deploy-staging** — `kustomize set image` + `kubectl apply -k` to AKS;
   gated by a *staging* Environment.
4. **deploy-production** — same, gated by a *production* Environment with
   **required reviewers = approval gate**.

---

## 7. Infrastructure as Code

`terraform/` provisions the entire Azure footprint (azurerm): resource group,
Log Analytics + Application Insights, ACR, AKS (system-assigned identity,
cluster autoscaler, monitoring add-on, Key Vault CSI add-on, AcrPull role),
Azure SQL (serverless GP_S with auto-pause), Key Vault + SQL secrets, an Azure
Monitor action group + CPU metric alert, and a Cost Management budget with
notifications. `terraform init && terraform validate` pass; `apply` provisions,
`destroy` returns to ~$0.

---

## 8. Security

- **Secrets:** Azure **Key Vault** holds the SQL credentials. The API hydrates
  them at startup via `DefaultAzureCredential` (`backend/db/keyvault.js`); on AKS the
  **Secrets Store CSI driver** (`k8s/13-secretproviderclass.yaml`) mounts them.
  No secret material in git (`.env` git-ignored; `.env.example` committed).
- **Access control:** Kubernetes **RBAC** — a dedicated ServiceAccount with a
  read-only Role (never cluster-admin).
- **Pod hardening:** **Pod Security Standards** (baseline enforced, restricted
  audited) at the namespace.
- **Transport:** TLS 1.2 enforced to Azure SQL; SQL firewall rules restrict
  access.

---

## 9. Monitoring & cost governance

- **Application Insights** (workspace-based) auto-instruments the API
  (requests, dependencies, exceptions).
- **Log Analytics** collects container/cluster logs (AKS monitoring add-on).
- **Azure Monitor** action group + metric alert (AKS CPU > 80%) → email.
- **Cost Management** budget ($10/mo) with an 80% actual / 100% forecast email
  alert.
- App health surfaced at `GET /health` (ADX + SQL state).

See `docs/COST_ANALYSIS.md` for the full cost breakdown.

---

## 10. Repository map

```
backend/                                # all backend service code
  server.js client.js admin.js          #   API, Kafka client, topic setup
  producer/ consumer/ processor/        #   ingestion, storage, alert rules
  spark/                                #   Spark Structured Streaming job
  db/                                   #   ADX client/schema + Azure SQL (schema/seed/pool/keyvault)
frontend/                               # React dashboard (+ Dockerfile, nginx)
k8s/                                    # Kubernetes manifests (kustomize)
terraform/                              # Azure IaC
azure-pipelines.yml                     # CI/CD (Azure DevOps)
test/  docs/                            # unit tests; report, cost analysis, video script
Dockerfile docker-compose.yaml          # containerisation
```
