terraform {
  required_version = ">= 1.5"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.116"
    }
  }
}

provider "azurerm" {
  features {}
  # Authenticate via `az login` (the subscription is read from the CLI context),
  # or set ARM_SUBSCRIPTION_ID / ARM_CLIENT_ID etc. in CI.
  subscription_id = var.subscription_id
}

data "azurerm_client_config" "current" {}
