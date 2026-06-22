// Azure Data Explorer client for the time-series readings: streaming ingest for
// writes and KQL for the dashboard queries. Config comes from the environment;
// clients are built lazily.

import { Client as KustoClient, KustoConnectionStringBuilder } from "azure-kusto-data";
import {
  StreamingIngestClient,
  IngestionProperties,
  DataFormat,
} from "azure-kusto-ingest";
import { DefaultAzureCredential } from "@azure/identity";
import { Readable } from "node:stream";

const TABLE = "Readings";
const MAPPING = "Readings_mapping";

const database = () => process.env.KUSTO_DATABASE || "smartcity";

// Engine (query) endpoint - used for both KQL queries and streaming ingestion.
function connectionString() {
  const uri = process.env.KUSTO_QUERY_URI;
  if (!uri) throw new Error("KUSTO_QUERY_URI is not set");

  // Explicit app registration (client id/secret/tenant) takes precedence when
  // set - useful for CI or fully-containerised runs.
  if (process.env.AAD_APP_ID) {
    return KustoConnectionStringBuilder.withAadApplicationKeyAuthentication(
      uri,
      process.env.AAD_APP_ID,
      process.env.AAD_APP_KEY,
      process.env.AAD_TENANT_ID
    );
  }
  // Otherwise DefaultAzureCredential: `az login` locally, managed identity on
  // AKS. No secret to store anywhere.
  return KustoConnectionStringBuilder.withTokenCredential(
    uri,
    new DefaultAzureCredential()
  );
}

let queryClient = null;
let streamClient = null;

function getQueryClient() {
  if (!queryClient) queryClient = new KustoClient(connectionString());
  return queryClient;
}

function getStreamClient() {
  if (!streamClient) streamClient = new StreamingIngestClient(connectionString());
  return streamClient;
}

const ingestionProps = () =>
  new IngestionProperties({
    database: database(),
    table: TABLE,
    format: DataFormat.JSON,
    ingestionMappingReference: MAPPING,
  });

// Write one processed reading into the Readings table (streaming ingest).
export async function ingestReading(doc) {
  const payload = JSON.stringify({
    sensorId: doc.sensorId,
    temperature: doc.temperature,
    humidity: doc.humidity,
    airQuality: doc.airQuality,
    noise: doc.noise,
    alert: doc.alert || "NORMAL",
    timestamp: doc.timestamp,
  });
  await getStreamClient().ingestFromStream(Readable.from(payload), ingestionProps());
}

function rowsOf(response) {
  const table = response.primaryResults[0];
  const out = [];
  for (const row of table.rows()) out.push(row.toJSON());
  return out;
}

// Escape a value for safe interpolation into a KQL string literal.
const kqlStr = (v) =>
  `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

// Latest readings, optionally filtered by sensorId.
export async function queryReadings({ sensorId, limit = 100 } = {}) {
  const lim = Math.min(Number(limit) || 100, 500);
  const where = sensorId ? `| where sensorId == ${kqlStr(sensorId)} ` : "";
  const q = `Readings ${where}| order by timestamp desc | take ${lim}`;
  return rowsOf(await getQueryClient().execute(database(), q));
}

// Most recent reading per sensor.
export async function latestPerSensor() {
  const q =
    "Readings | summarize arg_max(timestamp, *) by sensorId | order by sensorId asc";
  return rowsOf(await getQueryClient().execute(database(), q));
}

// Averaged metrics per sensor over the last N minutes.
export async function summary(minutes = 10) {
  const m = Math.min(Number(minutes) || 10, 1440);
  const q =
    `Readings | where timestamp >= ago(${m}m) | summarize ` +
    "avgTemperature=avg(temperature), avgHumidity=avg(humidity), " +
    "avgAirQuality=avg(airQuality), avgNoise=avg(noise), samples=count() " +
    "by sensorId | order by sensorId asc";
  return rowsOf(await getQueryClient().execute(database(), q));
}

// Recent non-normal alerts.
export async function recentAlerts(limit = 50) {
  const lim = Math.min(Number(limit) || 50, 200);
  const q = `Readings | where alert != "NORMAL" | order by timestamp desc | take ${lim}`;
  return rowsOf(await getQueryClient().execute(database(), q));
}

// Lightweight health probe used by /health.
export async function pingAdx() {
  try {
    await getQueryClient().execute(database(), "print ok=1");
    return true;
  } catch {
    return false;
  }
}
