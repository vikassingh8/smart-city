import kafka from "../client.js";

const TOPIC = process.env.TOPIC_RAW || "sensor-data";
const INTERVAL_MS = Number(process.env.PRODUCE_INTERVAL_MS || 2000);

// Simulated fleet of IoT sensors deployed across the city.
const SENSORS = ["sensor-1", "sensor-2", "sensor-3"];

const producer = kafka.producer();

function randomReading(sensorId) {
  return {
    sensorId,
    temperature: +(Math.random() * 40).toFixed(1), // 0–40 °C
    humidity: Math.floor(Math.random() * 100), // 0–100 %
    airQuality: Math.floor(Math.random() * 300), // 0–300 AQI
    noise: Math.floor(40 + Math.random() * 60), // 40–100 dB
    timestamp: new Date().toISOString(),
  };
}

async function startProducer() {
  await producer.connect();
  console.log("Producer connected ->", TOPIC);

  setInterval(async () => {
    try {
      // Send one reading per sensor each tick.
      const messages = SENSORS.map((sensorId) => {
        const data = randomReading(sensorId);
        return { key: sensorId, value: JSON.stringify(data) };
      });

      await producer.send({ topic: TOPIC, messages });
      console.log(`Sent ${messages.length} readings`);
    } catch (err) {
      console.error("Producer error:", err.message);
    }
  }, INTERVAL_MS);
}

// Graceful shutdown so Kafka rebalances cleanly.
const shutdown = async () => {
  console.log("\nShutting down producer...");
  await producer.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startProducer().catch((err) => {
  console.error("Producer failed to start:", err.message);
  process.exit(1);
});
