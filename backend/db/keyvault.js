// When KEYVAULT_NAME is set, fetch the SQL credentials from Key Vault at startup
// and put them in process.env (without overriding values already set). Auth uses
// DefaultAzureCredential (az login locally, managed identity on AKS). If unset,
// the app just uses .env / the Kubernetes Secret.

import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

// Key Vault secret name -> environment variable name.
const SECRET_MAP = {
  "SQL-PASSWORD": "SQL_PASSWORD",
  "SQL-USER": "SQL_USER",
  "SQL-SERVER": "SQL_SERVER",
  "SQL-DATABASE": "SQL_DATABASE",
};

export async function loadSecretsFromKeyVault() {
  const name = process.env.KEYVAULT_NAME;
  if (!name) return false;

  const url = `https://${name}.vault.azure.net`;
  const client = new SecretClient(url, new DefaultAzureCredential());

  for (const [secretName, envName] of Object.entries(SECRET_MAP)) {
    if (process.env[envName]) continue; // don't override explicit env values
    try {
      const secret = await client.getSecret(secretName);
      if (secret.value) process.env[envName] = secret.value;
    } catch (err) {
      console.error(`Key Vault: could not read ${secretName}:`, err.message);
    }
  }
  console.log(`Loaded secrets from Key Vault '${name}'`);
  return true;
}
