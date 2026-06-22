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

variable "sql_admin_user" {
  type    = string
  default = "vikassingh"
}

variable "sql_admin_password" {
  description = "Azure SQL admin password (pass via TF_VAR_sql_admin_password, never commit)"
  type        = string
  sensitive   = true
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
  description = "Cheapest burstable size keeps cost low"
  type        = string
  default     = "Standard_B2s"
}

variable "adx_sku" {
  description = "Azure Data Explorer SKU (Dev/test single node keeps cost low)"
  type        = string
  default     = "Dev(No SLA)_Standard_E2a_v4"
}

variable "budget_amount" {
  description = "Monthly budget (USD) for cost alerts"
  type        = number
  default     = 10
}

variable "alert_email" {
  type    = string
  default = "vikassingh.dnagrowth@gmail.com"
}
