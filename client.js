import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "admin-app",
  brokers: ["localhost:9092"],
});

export default kafka;