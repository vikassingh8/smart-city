import kafka from "./client.js";

const admin = kafka.admin();
await admin.connect();

const topics = await admin.createTopics({
  topics: [
    { topic: "sensor-data", numPartitions: 2 },
    { topic: "processed-data", numPartitions: 2 },
  ],
});
console.log("Created topic: sensor-data");
console.log("List of topics:", await admin.listTopics());

await admin.disconnect();
