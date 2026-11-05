import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true },
    offeredAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    result: {
      type: String,
      enum: ["accepted", "rejected", "timed_out"],
      default: "timed_out"
    }
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    tripId: { type: String, required: true, unique: true, index: true },
    riderId: { type: String, required: true },
    driverId: { type: String, default: null },
    status: {
      type: String,
      enum: ["matching", "matched", "no_driver_found"],
      default: "matching",
      index: true
    },
    attempts: { type: [attemptSchema], default: [] },
    matchedAt: { type: Date }
  },
  { timestamps: true }
);

export const Match = mongoose.model("Match", matchSchema);
