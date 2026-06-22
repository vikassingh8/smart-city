# Kubernetes deployment

AKS-ready manifests for the whole stack: Deployments, Services, resource
requests/limits, HPA autoscaling, RBAC, and Pod Security Standards.

## Files

| File | What |
|------|------|
| `00-namespace.yaml` | Namespace + Pod Security Standards (baseline enforced) |
| `01-configmap.yaml` | Non-secret config (broker URLs, ADX endpoints, topics) |
| `02-secret.example.yaml` | Secret template (do **not** commit real values) |
| `03-kafka.yaml` | Kafka (KRaft) Deployment + headless Service |
| `05-topic-setup-job.yaml` | One-shot Job to create topics |
| `06-producer.yaml` | Ingestion |
| `07-spark-processor.yaml` | Stream processor (Apache Spark) |
| `09-storage.yaml` | Storage consumer |
| `10-api.yaml` | API Deployment + Service + **HPA** |
| `11-frontend.yaml` | React dashboard + Service |
| `12-rbac.yaml` | Least-privilege ServiceAccount + Role + RoleBinding |
| `13-secretproviderclass.yaml` | Azure Key Vault → Secret via CSI driver (AKS) |

## Local demo (free - Docker Desktop K8s or kind)

```bash
# 1) Build the images locally (no registry needed)
docker build -t smart-city-backend:latest .
docker build -t smart-city-frontend:latest ./frontend

# 2a) If using kind, load the images into the cluster:
kind create cluster --name smart-city
kind load docker-image smart-city-backend:latest smart-city-frontend:latest --name smart-city
# 2b) Docker Desktop Kubernetes uses local images directly - skip the load.

# 3) Create the secret from your .env values
kubectl create namespace smart-city
kubectl -n smart-city create secret generic smart-city-secrets \
  --from-literal=SQL_SERVER=mscsql.database.windows.net \
  --from-literal=SQL_DATABASE=free-sql-db-7705584 \
  --from-literal=SQL_USER=vikassingh \
  --from-literal=SQL_PASSWORD='<your-password>'

# 4) Deploy everything
kubectl apply -k k8s/

# 5) Watch it come up + autoscaler
kubectl -n smart-city get pods -w
kubectl -n smart-city get hpa

# 6) Reach the API + dashboard (local clusters: port-forward)
kubectl -n smart-city port-forward svc/api 3000:80
kubectl -n smart-city port-forward svc/frontend 8080:80
```

## AKS

On AKS the `LoadBalancer` Services get real external IPs (no port-forward), use
`07-spark-processor.yaml` for Spark, and `13-secretproviderclass.yaml` pulls SQL
secrets from Azure Key Vault. The time-series store is **Azure Data Explorer**
(cloud) - set its endpoints in `01-configmap.yaml`; pods authenticate with the
AKS managed identity (granted Ingestor/Viewer in Terraform), so no ADX secret is
stored. The Terraform in `terraform/` provisions the cluster + ADX; the Azure
DevOps pipeline builds, pushes to ACR, and `kubectl apply -k`.
