import mongoose from "mongoose";

const locationHistorySchema = new mongoose.Schema({
  driverId: { type: String, required: true, index: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true }
  },
  heading: { type: Number, min: 0, max: 360, default: 0 },
  speed: { type: Number, min: 0, default: 0 },
  timestamp: { type: Date, required: true }
});

locationHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });
locationHistorySchema.index({ driverId: 1, timestamp: -1 });

export const LocationHistory = mongoose.model("LocationHistory", locationHistorySchema);
