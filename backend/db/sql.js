import sql from "mssql";

// Azure SQL connection for the sensor metadata table. Connection details come
// from the environment (SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD).

// Built at call time so secrets hydrated from Key Vault at startup are picked up.
function buildConfig() {
  return {
    server: process.env.SQL_SERVER || "localhost",
    database: process.env.SQL_DATABASE || "smartcity",
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    port: Number(process.env.SQL_PORT || 1433),
    // Serverless Azure SQL auto-pauses; the first connection must wait for it to
    // resume (can take ~30-60s), so allow a generous connect timeout.
    connectionTimeout: Number(process.env.SQL_CONNECT_TIMEOUT_MS || 60_000),
    requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT_MS || 60_000),
    options: {
      // Azure SQL requires encryption.
      encrypt: String(process.env.SQL_ENCRYPT || "true") === "true",
      // true only for local self-signed dev servers; false against real Azure SQL.
      trustServerCertificate:
        String(process.env.SQL_TRUST_CERT || "false") === "true",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };
}

let poolPromise = null;

// Lazily create a single shared connection pool.
export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(buildConfig()).then((pool) => {
      console.log("Connected to Azure SQL (metadata)");
      return pool;
    });
    // If the first connect fails, reset so a later request can retry.
    poolPromise.catch((err) => {
      console.error("Azure SQL connection failed:", err.message);
      poolPromise = null;
    });
  }
  return poolPromise;
}

// All sensor metadata rows.
export async function getSensors() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(
      "SELECT sensor_id, name, type, location, latitude, longitude, " +
        "installed_at, status FROM dbo.sensors ORDER BY sensor_id"
    );
  return result.recordset;
}

// One sensor's metadata, or undefined.
export async function getSensorById(sensorId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(50), sensorId)
    .query(
      "SELECT sensor_id, name, type, location, latitude, longitude, " +
        "installed_at, status FROM dbo.sensors WHERE sensor_id = @id"
    );
  return result.recordset[0];
}

// A { sensorId -> metadata } map, handy for enriching reading lists in one pass.
export async function getSensorMap() {
  const rows = await getSensors();
  return Object.fromEntries(rows.map((r) => [r.sensor_id, r]));
}

// Lightweight health probe used by /health.
export async function pingSql() {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

export { sql };
