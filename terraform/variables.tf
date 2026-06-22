variable "subscription_id" {
  description = "Azure subscription id"
  type        = string
  default     = "41569ced-f010-4870-b88b-dd724bd142b7"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "centralindia"
}

variable "prefix" {
  description = "Name prefix for resources"
  type        = string
  default     = "smartcity"
}

variable "resource_group_name" {
  type    = string
  default = "smartcity-rg"
}

# Existing free Azure SQL database (reused, not created). Override if different.
variable "sql_server_fqdn" {
  description = "FQDN of the existing Azure SQL server"
  type        = string
  default     = "mscsql.database.windows.net"
}

variable "sql_database" {
  description = "Existing Azure SQL database name"
  type        = string
  default     = "free-sql-db-7705584"
}

variable "sql_admin_user" {
  type    = string
  default = "vikassingh"
}

variable "sql_admin_password" {
  description = "SQL password, stored in Key Vault (pass via TF_VAR_sql_admin_password). Empty skips the secret."
  type        = string
  default     = ""
  sensitive   = true
}

# Free Azure Data Explorer cluster query URI (created at
# dataexplorer.azure.com/freecluster). Used for reference/outputs.
variable "adx_query_uri" {
  description = "Free ADX cluster query URI"
  type        = string
  default     = ""
}

variable "aks_node_count_min" {
  type    = number
  default = 1
}

variable "aks_node_count_max" {
  type    = number
  default = 3
}

variable "aks_vm_size" {
  description = "Small 2-vCPU node; cheapest size that is both allowed and has quota in the region"
  type        = string
  default     = "Standard_D2as_v4"
}

variable "budget_amount" {
  description = "Monthly budget (USD) for cost alerts"
  type        = number
  default     = 10
}

variable "alert_email" {
  type    = string
  default = "singhvikas872@gmail.com"
}
