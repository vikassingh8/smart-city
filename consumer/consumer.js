

import kafka from "../client.js";

const consumer = kafka.consumer({ groupId: "sensor-group",fromBeginning: true });
await consumer.connect();
console.log("Consumer connected to Kafka");
await consumer.subscribe({ topic: "processed-data" });
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const sensorData = JSON.parse(message.value.toString());
    console.log(`Received message: ${message.value.toString()}`);
    // Here you can add code to save the sensorData to MongoDB using Mongoose
  },
});

