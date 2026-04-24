

import { set } from "mongoose";
import kafka from "./client.js";

const producer = kafka.producer();
await producer.connect();
console.log("Producer connected to Kafka");
setInterval(async () => {
  const data = {
    temperature: Math.floor(Math.random() * 40),
    humidity: Math.floor(Math.random() * 100),
    airQuality: Math.floor(Math.random() * 300),
    timestamp: new Date(),
  };
  await producer.send({
    topic: "sensor-data",
    messages: [{ value: JSON.stringify(data) }],
  });
},2000);

