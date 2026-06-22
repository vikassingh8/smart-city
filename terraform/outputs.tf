output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "aks_cluster_name" {
  value = azurerm_kubernetes_cluster.main.name
}

output "acr_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "sql_server_fqdn" {
  value = azurerm_mssql_server.main.fully_qualified_domain_name
}

output "key_vault_name" {
  value = azurerm_key_vault.main.name
}

output "adx_query_uri" {
  value = azurerm_kusto_cluster.main.uri
}

output "adx_database" {
  value = azurerm_kusto_database.main.name
}

output "app_insights_connection_string" {
  value     = azurerm_application_insights.main.connection_string
  sensitive = true
}

output "get_credentials_command" {
  value = "az aks get-credentials -g ${azurerm_resource_group.main.name} -n ${azurerm_kubernetes_cluster.main.name}"
}
