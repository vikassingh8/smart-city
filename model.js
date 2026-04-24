import mongoose from "mongoose";

const sensorSchema = new mongoose.Schema({
  temperature: Number,
  humidity: Number,
  airQuality: Number,
  timestamp: Date,
});

const Sensor = mongoose.model("Sensor", sensorSchema);
export default Sensor;
