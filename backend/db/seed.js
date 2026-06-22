import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getPool, sql } from "./sql.js";

// Resolve paths relative to this file so it runs from any cwd.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Metadata for the three sensors the producer simulates (sensor-1..3).
// Coordinates are real Bengaluru locations for a believable demo/dashboard.
const SENSORS = [
  {
    sensor_id: "sensor-1",
    name: "MG Road Air Monitor",
    type: "environmental",
    location: "MG Road, Bengaluru",
    latitude: 12.9756,
    longitude: 77.6068,
  },
  {
    sensor_id: "sensor-2",
    name: "Whitefield Air Monitor",
    type: "environmental",
    location: "Whitefield, Bengaluru",
    latitude: 12.9698,
    longitude: 77.7499,
  },
  {
    sensor_id: "sensor-3",
    name: "Electronic City Air Monitor",
    type: "environmental",
    location: "Electronic City, Bengaluru",
    latitude: 12.8452,
    longitude: 77.6602,
  },
];

async function run() {
  const pool = await getPool();

  // 1) Create the table (idempotent - see schema.sql).
  const ddl = await readFile(join(__dirname, "schema.sql"), "utf8");
  await pool.request().batch(ddl);
  console.log("Schema ensured (dbo.sensors)");

  // 2) Upsert each sensor so re-running the seed is safe.
  for (const s of SENSORS) {
    await pool
      .request()
      .input("sensor_id", sql.NVarChar(50), s.sensor_id)
      .input("name", sql.NVarChar(100), s.name)
      .input("type", sql.NVarChar(50), s.type)
      .input("location", sql.NVarChar(100), s.location)
      .input("latitude", sql.Float, s.latitude)
      .input("longitude", sql.Float, s.longitude)
      .query(`
        MERGE dbo.sensors AS target
        USING (SELECT @sensor_id AS sensor_id) AS src
          ON target.sensor_id = src.sensor_id
        WHEN MATCHED THEN
          UPDATE SET name = @name, type = @type, location = @location,
                     latitude = @latitude, longitude = @longitude
        WHEN NOT MATCHED THEN
          INSERT (sensor_id, name, type, location, latitude, longitude)
          VALUES (@sensor_id, @name, @type, @location, @latitude, @longitude);
      `);
    console.log(`   • seeded ${s.sensor_id} (${s.location})`);
  }

  console.log(`Seeded ${SENSORS.length} sensors`);
  await pool.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
