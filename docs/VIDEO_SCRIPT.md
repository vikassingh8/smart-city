# Video Walkthrough Script (10–15 min)

A scene-by-scene script for the walkthrough. Keep the stack running
(`docker compose up --build`) with the dashboard at `http://localhost:8080`.

## 1. Introduction (1.5 min)
- "I built a **scalable Smart City Environmental Monitoring system** using
  distributed-systems principles and Azure cloud automation."
- Type of system: a **distributed, event-driven microservices pipeline** for
  real-time IoT telemetry (air quality, noise, temperature, humidity).
- Show the architecture diagram (`docs/PROJECT_REPORT.md` §2).

## 2. Architecture & microservices (2 min)
- Walk the flow: **Producer → Kafka → Spark Structured Streaming → Kafka →
  Storage → Azure Data Explorer**, with **Azure SQL** for metadata and a
  **REST API + React dashboard** for serving.
- Why Kafka (decoupling, buffering, independent scaling) and why Spark
  (filter/enrich/alert at scale).

## 3. Messaging & stream processing (1.5 min)
- Show `backend/producer/producer.js` and `backend/spark/stream.py`.
- In a terminal, show messages flowing and alerts being derived
  (`docker compose logs -f spark-processor storage`).

## 4. Database design (1.5 min)
- Show the **time-series** store — Azure Data Explorer (`backend/db/adx-schema.kql`
  table + `backend/db/adx.js` KQL queries) — vs the **relational** schema
  (`backend/db/schema.sql`).
- Run `npm run seed`; hit `GET /api/sensors` (Azure SQL) and
  `GET /api/sensor/latest` (the **join**: ADX readings enriched with location).

## 5. Dashboard demo (1 min)
- Open the React dashboard: live AQI trend, per-sensor cards with location,
  alerts table updating every 5s.

## 6. Containerisation & Kubernetes (2 min)
- Show `Dockerfile` + `docker-compose.yaml`.
- Show `k8s/`: Deployments, **resource limits**, **HPA** (`kubectl get hpa`),
  **RBAC**, **Pod Security Standards**.
- (If AKS up) `kubectl get pods -n smart-city`, show external IP + autoscale.

## 7. CI/CD (1.5 min)
- Show `azure-pipelines.yml`: test → build → push to ACR → deploy.
- Show the **staging → production approval gate** (Azure DevOps Environments).
- Show a green pipeline run + the pushed image in ACR.

## 8. Infrastructure as Code (1 min)
- Show `terraform/`; run `terraform validate` (green) and `terraform plan`.
- Explain it provisions AKS, SQL, Key Vault, monitoring, and the budget.

## 9. Security (1 min)
- Show **Key Vault** in the portal with the SQL secrets.
- Show the API loading them via `backend/db/keyvault.js` (`KEYVAULT_NAME` set) — no
  secrets in code. Mention RBAC + Pod Security.

## 10. Monitoring & cost (1 min)
- Show **Application Insights** (live metrics / requests) and **Log Analytics**.
- Show the **Azure Monitor alert** and the **Cost Management budget** ($10, 80%
  alert).

## 11. Wrap-up (0.5 min)
- Recap the system; mention everything runs free locally and costs < $1 to
  demo on AKS, then `terraform destroy`.

---

### Pre-flight checklist
- [ ] `docker compose up --build` healthy; dashboard at :8080 shows data
- [ ] `npm test` green
- [ ] `terraform validate` green
- [ ] Key Vault secrets visible; `KEYVAULT_NAME` demo works
- [ ] App Insights receiving telemetry; budget visible
- [ ] (Optional) AKS up for the K8s portion, then remember to `terraform destroy`
