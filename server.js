import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Sensor from "./model.js";

const app = express();
app.use(express.json());
app.use(cors());

mongoose
  .connect(
    "mongodb://vikas:<password>@ac-1cmgb42-shard-00-00.gx4xuwg.mongodb.net:27017,ac-1cmgb42-shard-00-01.gx4xuwg.mongodb.net:27017,ac-1cmgb42-shard-00-02.gx4xuwg.mongodb.net:27017/smartcity?ssl=true&replicaSet=atlas-21fd8j-shard-0&authSource=admin&retryWrites=true&w=majority",
  )
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ Could not connect to MongoDB", err));

app.get("/", (req, res) => {
  res.send("Welcome to the Smart City API");
});

// app.post("/api/sensor", async (req, res) => {
//   try {
//     const { temperature, humidity, airQuality } = req.body;
//     const sensorData = new Sensor({
//       temperature,
//       humidity,
//       airQuality,
//       timestamp: new Date(),
//     });
//     await sensorData.save();
//     res.status(201).json(sensorData);
//   } catch (error) {
//     console.error("❌ Error saving sensor data", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });


app.get("/api/sensor", async (req, res) => {
    try { 
      const data = await Sensor.find().sort({ timestamp: -1 }).limit(100);
      res.json(data);
    } catch (error) {
      console.error("❌ Error fetching sensor data", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

app.listen(3000, () => {
  console.log("🚀 Server is running on port 3000");
});
