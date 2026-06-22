import kafka from "../client.js";
import { ingestReading } from "../db/adx.js";

const TOPIC = process.env.TOPIC_PROCESSED || "processed-data";

const consumer = kafka.consumer({ groupId: "storage-group" });

async function startConsumer() {
  // Read the processed stream and PERSIST every reading into Azure Data
  // Explorer (the time-series store).
  await consumer.connect();
  console.log("Storage consumer connected");

  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());

        await ingestReading({
          sensorId: data.sensorId,
          temperature: data.temperature,
          humidity: data.humidity,
          airQuality: data.airQuality,
          noise: data.noise,
          alert: data.alert,
          timestamp: data.timestamp,
        });

        console.log(`Stored ${data.sensorId} (${data.alert})`);
      } catch (err) {
        console.error("Storage error:", err.message);
      }
    },
  });
}

const shutdown = async () => {
  console.log("\nShutting down storage...");
  await consumer.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startConsumer().catch((err) => {
  console.error("Storage failed to start:", err.message);
  process.exit(1);
});
