import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true, default: "" },
    location: { type: pointSchema, required: true }
  },
  { _id: false }
);

const fareSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    distanceKm: { type: Number, min: 0 },
    durationMin: { type: Number, min: 0 }
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actorId: { type: String }
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    riderId: { type: String, required: true, index: true },
    driverId: { type: String, default: null, index: true },
    pickup: { type: locationSchema, required: true },
    drop: { type: locationSchema, required: true },
    fare: { type: fareSchema, required: true },
    status: {
      type: String,
      enum: [
        "requested",
        "matching",
        "matched",
        "driver_arrived",
        "started",
        "completed",
        "cancelled"
      ],
      default: "requested",
      index: true
    },
    idempotencyKey: { type: String, sparse: true, index: true },
    cancelReason: { type: String, default: null },
    cancelledBy: { type: String, default: null },
    timeline: { type: [timelineSchema], default: [] }
  },
  { timestamps: true }
);

tripSchema.index({ riderId: 1, createdAt: -1 });
tripSchema.index({ driverId: 1, createdAt: -1 });
tripSchema.index({ status: 1, createdAt: -1 });

export const Trip = mongoose.model("Trip", tripSchema);
