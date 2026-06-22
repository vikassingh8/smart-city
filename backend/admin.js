import kafka from "./client.js";

const TOPIC_RAW = process.env.TOPIC_RAW || "sensor-data";
const TOPIC_PROCESSED = process.env.TOPIC_PROCESSED || "processed-data";

const admin = kafka.admin();

async function run() {
  await admin.connect();

  const created = await admin.createTopics({
    waitForLeaders: true, // important
    topics: [
      { topic: TOPIC_RAW, numPartitions: 3, replicationFactor: 1 },
      { topic: TOPIC_PROCESSED, numPartitions: 3, replicationFactor: 1 },
    ],
  });

  if (created) {
    console.log("Topics created");
  } else {
    console.log("Topics already exist");
  }

  const topics = await admin.listTopics();
  console.log("Topics:", topics);

  await admin.disconnect();
}

run().catch((err) => {
  console.error("Topic setup failed:", err.message);
  process.exit(1);
});
