# Cost Analysis Report

Cost-optimised for a student capstone. The design favours **free tiers**,
**serverless / auto-pausing** resources, and **burstable** compute, plus a
budget alert as a safety net. Region: Central India. Prices are indicative USD
list prices (2026) and vary by region/usage; use the
[Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for
exact figures.

## What is actually deployed today (kept running)

| Resource | Tier | Cost while running | Notes |
|----------|------|--------------------|-------|
| Azure SQL Database | Serverless GP_S, 1 vCore, auto-pause 60 min | **~$0 idle**, ~$0.0001/vCore-sec active | Auto-pauses when idle → near-zero for a demo |
| Azure Key Vault | Standard | **~$0** | ~$0.03 per 10k operations |
| Log Analytics workspace | Pay-as-you-go | **$0** under 5 GB/mo free | Capstone volume well under free grant |
| Application Insights | Workspace-based | **$0** under 5 GB/mo free | Shares the free grant |
| Cost Management budget | — | **$0** | Budgets and alerts are always free |
| **Subtotal (current)** | | **≈ $0 – $1 / month** | |

## Provisioned only for the AKS demo, then destroyed

| Resource | Tier | Cost while running | Strategy |
|----------|------|--------------------|----------|
| AKS control plane | Free tier | **$0** | Free SKU |
| AKS node pool | 1 × Standard_B2s (burstable), autoscale 1→3 | ~$0.045/hr (~$30/mo if left on) | Spin up for the video, `terraform destroy` after |
| Azure Data Explorer | Dev (No SLA), single node, auto-stop | **~$0 stopped**, ~$0.10–0.20/hr active | Auto-stops when idle; or use a **free ADX cluster** ($0) for local dev |
| Azure Container Registry | Basic | ~$0.167/day (~$5/mo) | Holds the backend/frontend images |
| Load Balancer (Service) | Standard | ~$0.025/hr | Created by `LoadBalancer` Services on AKS |

**AKS demo estimate:** running a single B2s node + LB for ~3 hours to record the
walkthrough ≈ **well under $1**. Destroy afterwards.

## How cost is minimised

1. **Serverless SQL with auto-pause** — billed only while queried.
2. **Dev-SKU Azure Data Explorer with auto-stop** — stops when idle; a **free
   ADX cluster** can back local dev at $0.
3. **Burstable B-series** AKS nodes + **cluster autoscaler** (min 1).
4. **Free-tier monitoring** (Log Analytics / App Insights 5 GB/mo).
5. **Local-first development** on Docker Compose / kind (pointing at a free ADX
   cluster) = ~$0; full cloud only for the demo.
6. **Budget alert at 80%** ($10/mo) emails before any real spend accrues.
7. **`terraform destroy`** tears the billable cloud footprint back to ~$0.

## Recommendation

- **Day-to-day & grading of code:** run locally (Compose or kind) — **$0**.
- **AKS demo for the video:** `terraform apply`, record, `terraform destroy` —
  **< $1 total**.
- Leave SQL + Key Vault + monitoring + budget in place — **≈ $0/month**.
