import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    color: { type: String, required: true, trim: true },
    plate: { type: String, required: true, trim: true, uppercase: true },
    capacity: { type: Number, required: true, min: 1, max: 8, default: 4 }
  },
  { _id: false }
);

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    vehicle: {
      type: vehicleSchema,
      required: true
    },
    status: {
      type: String,
      enum: ["offline", "available", "on_trip"],
      default: "offline",
      index: true
    },
    currentLocation: {
      type: pointSchema,
      default: () => ({ type: "Point", coordinates: [0, 0] })
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
      default: 0
    },
    lastPingAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

driverSchema.index({ currentLocation: "2dsphere" });
driverSchema.index({ status: 1, lastPingAt: -1 });

export const Driver = mongoose.model("Driver", driverSchema);
