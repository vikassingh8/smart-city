import express from "express";
import cors from "cors";
import {
  queryReadings,
  latestPerSensor,
  summary,
  recentAlerts,
  pingAdx,
} from "./db/adx.js";
import { getSensors, getSensorMap, pingSql } from "./db/sql.js";

// Hydrate secrets from Azure Key Vault when KEYVAULT_NAME is set (no-op otherwise).
if (process.env.KEYVAULT_NAME) {
  const { loadSecretsFromKeyVault } = await import("./db/keyvault.js");
  await loadSecretsFromKeyVault();
}

// Application Insights telemetry (auto-instruments HTTP) when configured.
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = (await import("applicationinsights")).default;
  appInsights
    .setup()
    .setAutoCollectRequests(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .start();
  console.log("Application Insights telemetry enabled");
}

const PORT = Number(process.env.API_PORT || 3000);

const app = express();
app.use(express.json());
app.use(cors());

// Health check
app.get("/", (req, res) => res.send("Welcome to the Smart City API"));
app.get("/health", async (req, res) =>
  res.json({
    status: "ok",
    adx: await pingAdx(),
    sql: await pingSql(),
  })
);

// Sensor metadata (from the Azure SQL relational store).
app.get("/api/sensors", async (req, res) => {
  try {
    res.json(await getSensors());
  } catch (error) {
    console.error("Error fetching sensor metadata", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Latest readings (optionally filter by sensorId)
app.get("/api/sensor", async (req, res) => {
  try {
    const data = await queryReadings({
      sensorId: req.query.sensorId,
      limit: req.query.limit,
    });
    res.json(data);
  } catch (error) {
    console.error("Error fetching sensor data", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Most recent reading per sensor, enriched with relational metadata
// (name / location / coordinates) joined from Azure SQL.
app.get("/api/sensor/latest", async (req, res) => {
  try {
    const data = await latestPerSensor();

    // Best-effort enrichment: if SQL is unavailable, still return readings.
    let meta = {};
    try {
      meta = await getSensorMap();
    } catch (err) {
      console.error("Metadata join skipped:", err.message);
    }

    const enriched = data.map((r) => {
      const m = meta[r.sensorId];
      return m
        ? {
            ...r,
            name: m.name,
            type: m.type,
            location: m.location,
            latitude: m.latitude,
            longitude: m.longitude,
          }
        : r;
    });

    res.json(enriched);
  } catch (error) {
    console.error("Error fetching latest", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Aggregated averages per sensor over the last N minutes
app.get("/api/metrics/summary", async (req, res) => {
  try {
    const minutes = Math.min(Number(req.query.minutes) || 10, 1440);
    const sensors = await summary(minutes);
    res.json({ windowMinutes: minutes, sensors });
  } catch (error) {
    console.error("Error building summary", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Recent non-normal alerts
app.get("/api/alerts", async (req, res) => {
  try {
    const data = await recentAlerts(req.query.limit);
    res.json(data);
  } catch (error) {
    console.error("Error fetching alerts", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => console.log(`API running on port ${PORT}`));
