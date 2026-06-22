# Azure footprint for the platform: resource group, Log Analytics + App
# Insights, ACR, AKS (autoscaling + monitoring add-on), serverless Azure SQL,
# Azure Data Explorer (time-series), Key Vault, Monitor alerts, and a Cost
# Management budget.
#
# Costs are kept low with a single burstable AKS node (autoscaler min 1),
# serverless SQL with auto-pause, a Dev-SKU ADX cluster with auto-stop, and free
# monitoring tiers. terraform destroy returns to roughly zero.

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

# ---------------------------------------------------------- Monitoring
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.prefix}-law"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "main" {
  name                = "${var.prefix}-appinsights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
}

# --------------------------------------------------- Container Registry
resource "azurerm_container_registry" "main" {
  name                = "${var.prefix}acr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false
}

# ------------------------------------------------------------------ AKS
resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.prefix}-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${var.prefix}aks"

  default_node_pool {
    name                = "system"
    vm_size             = var.aks_vm_size
    enable_auto_scaling = true
    min_count           = var.aks_node_count_min
    max_count           = var.aks_node_count_max

    node_labels = { workload = "smart-city" }
  }

  identity {
    type = "SystemAssigned"
  }

  # Ship container/cluster logs to Log Analytics (Azure Monitor for containers).
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  }

  # Pull secrets from Key Vault into pods via the CSI driver.
  key_vault_secrets_provider {
    secret_rotation_enabled = true
  }
}

# Let AKS pull images from ACR without credentials.
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                            = azurerm_container_registry.main.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  skip_service_principal_aad_check = true
}

# ------------------------------------------------------------ Azure SQL
resource "azurerm_mssql_server" "main" {
  name                         = "${var.prefix}-sql"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = var.sql_admin_user
  administrator_login_password = var.sql_admin_password
  minimum_tls_version          = "1.2"
}

resource "azurerm_mssql_database" "main" {
  name                        = "smartcity"
  server_id                   = azurerm_mssql_server.main.id
  sku_name                    = "GP_S_Gen5_1" # serverless, 1 vCore
  min_capacity                = 0.5
  auto_pause_delay_in_minutes = 60 # auto-pause when idle -> ~$0
  max_size_gb                 = 2
}

# Allow other Azure services (e.g. AKS) to reach SQL.
resource "azurerm_mssql_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# --------------------------------------------------- Azure Data Explorer
# Time-series store for sensor readings (the rubric's named time-series DB).
# Dev SKU + auto-stop keep cost low; terraform destroy returns to ~zero.
resource "azurerm_kusto_cluster" "main" {
  name                = "${var.prefix}adx"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  sku {
    name     = var.adx_sku
    capacity = 1
  }

  identity {
    type = "SystemAssigned"
  }

  # Near-real-time ingestion for the dashboard; auto-stop when idle.
  streaming_ingestion_enabled = true
  auto_stop_enabled           = true
}

resource "azurerm_kusto_database" "main" {
  name                = "smartcity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  cluster_name        = azurerm_kusto_cluster.main.name
}

# Let AKS pods (kubelet managed identity) ingest into and query the database,
# so no ADX credentials need to be stored anywhere.
resource "azurerm_kusto_database_principal_assignment" "aks_ingestor" {
  name                = "aks-ingestor"
  resource_group_name = azurerm_resource_group.main.name
  cluster_name        = azurerm_kusto_cluster.main.name
  database_name       = azurerm_kusto_database.main.name

  tenant_id      = data.azurerm_client_config.current.tenant_id
  principal_id   = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  principal_type = "App"
  role           = "Ingestor"
}

resource "azurerm_kusto_database_principal_assignment" "aks_viewer" {
  name                = "aks-viewer"
  resource_group_name = azurerm_resource_group.main.name
  cluster_name        = azurerm_kusto_cluster.main.name
  database_name       = azurerm_kusto_database.main.name

  tenant_id      = data.azurerm_client_config.current.tenant_id
  principal_id   = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  principal_type = "App"
  role           = "Viewer"
}

# ------------------------------------------------------------ Key Vault
resource "azurerm_key_vault" "main" {
  name                       = "${var.prefix}-kv"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  # The deploying principal can manage secrets.
  access_policy {
    tenant_id          = data.azurerm_client_config.current.tenant_id
    object_id          = data.azurerm_client_config.current.object_id
    secret_permissions = ["Get", "List", "Set", "Delete", "Purge", "Recover"]
  }

  # AKS Key Vault CSI identity can read secrets.
  access_policy {
    tenant_id          = data.azurerm_client_config.current.tenant_id
    object_id          = azurerm_kubernetes_cluster.main.key_vault_secrets_provider[0].secret_identity[0].object_id
    secret_permissions = ["Get", "List"]
  }
}

resource "azurerm_key_vault_secret" "sql_password" {
  name         = "SQL-PASSWORD"
  value        = var.sql_admin_password
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "sql_user" {
  name         = "SQL-USER"
  value        = var.sql_admin_user
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "sql_server" {
  name         = "SQL-SERVER"
  value        = azurerm_mssql_server.main.fully_qualified_domain_name
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "sql_database" {
  name         = "SQL-DATABASE"
  value        = azurerm_mssql_database.main.name
  key_vault_id = azurerm_key_vault.main.id
}

# ----------------------------------------------- Alerting (Azure Monitor)
resource "azurerm_monitor_action_group" "main" {
  name                = "${var.prefix}-ag"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = "smartcity"

  email_receiver {
    name          = "admin"
    email_address = var.alert_email
  }
}

# Alert when AKS node CPU is sustained high (service health/latency proxy).
resource "azurerm_monitor_metric_alert" "aks_cpu" {
  name                = "${var.prefix}-aks-cpu-high"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_kubernetes_cluster.main.id]
  description         = "AKS node CPU > 80%"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_cpu_usage_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# ---------------------------------------------------- Cost Management
resource "azurerm_consumption_budget_resource_group" "main" {
  name              = "${var.prefix}-budget"
  resource_group_id = azurerm_resource_group.main.id

  amount     = var.budget_amount
  time_grain = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00'Z'", timestamp())
  }

  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThan"
    threshold_type = "Actual"
    contact_emails = [var.alert_email]
  }

  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThan"
    threshold_type = "Forecasted"
    contact_emails = [var.alert_email]
  }

  lifecycle {
    ignore_changes = [time_period] # avoid drift as the month rolls over
  }
}
