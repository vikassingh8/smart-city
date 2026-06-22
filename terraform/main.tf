# Azure footprint for the platform: resource group, Log Analytics + App
# Insights, ACR, AKS (autoscaling + monitoring add-on), Key Vault, Monitor
# alerts, and a Cost Management budget.
#
# Free-first: the relational store reuses an existing free Azure SQL database
# and the time-series store uses a free Azure Data Explorer cluster (created
# outside Terraform at dataexplorer.azure.com/freecluster), so neither is
# provisioned here. AKS is the only meaningful cost; destroy returns to ~zero.

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

# Connection details for the existing free Azure SQL database (reused, not
# created here). The password is provided via TF_VAR_sql_admin_password.
resource "azurerm_key_vault_secret" "sql_server" {
  name         = "SQL-SERVER"
  value        = var.sql_server_fqdn
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "sql_database" {
  name         = "SQL-DATABASE"
  value        = var.sql_database
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "sql_user" {
  name         = "SQL-USER"
  value        = var.sql_admin_user
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "sql_password" {
  count        = var.sql_admin_password == "" ? 0 : 1
  name         = "SQL-PASSWORD"
  value        = var.sql_admin_password
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
