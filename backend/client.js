import { Kafka, logLevel } from "kafkajs";

// Brokers are read from the environment so the SAME code runs:
//   - on your host machine        -> localhost:29092  (default below)
//   - inside docker-compose       -> kafka:9092       (set via KAFKA_BROKERS)
const brokers = (process.env.KAFKA_BROKERS || "localhost:29092").split(",");

const kafka = new Kafka({
  clientId: "smart-city-app",
  brokers,
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 1000,
    retries: 12, // give Kafka time to become ready on a cold start
  },
});

export default kafka;
