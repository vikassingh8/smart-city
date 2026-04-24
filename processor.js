import kafka from "./client.js";

const consumer = kafka.consumer({ groupId: "processing-group" });
const producer = kafka.producer();

await consumer.connect();
await producer.connect();

await consumer.subscribe({ topic: "sensor-data", fromBeginning: true });

await consumer.run({
  eachMessage: async ({ message }) => {
    const data = JSON.parse(message.value.toString());

    let alert = "NORMAL";

    if (data.airQuality > 200) {
      alert = "HIGH POLLUTION 🚨";
    }

    const processedData = {
      ...data,
      sensorId: "sensor-1",
      alert,
      processedAt: new Date(),
    };

    console.log("Processed:", processedData);

    await producer.send({
      topic: "processed-data",
      messages: [{ value: JSON.stringify(processedData) }],
    });
  },
});
