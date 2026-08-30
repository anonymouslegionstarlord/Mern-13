import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const factors = {
  "car-petrol": { factor: 0.192, vehicle: true },
  "car-diesel": { factor: 0.171, vehicle: true },
  motorbike: { factor: 0.103, vehicle: true },
  bus: { factor: 0.105, vehicle: false },
  metro: { factor: 0.041, vehicle: false },
  train: { factor: 0.035, vehicle: false },
  bicycle: { factor: 0, vehicle: false },
  walk: { factor: 0, vehicle: false },
};
const modes = Object.keys(factors);
const tripSchema = new mongoose.Schema({
  mode: { type: String, required: true, enum: modes },
  distanceKm: { type: Number, required: true, min: 0.1, max: 2000 },
  passengers: { type: Number, required: true, min: 1, max: 8 },
  tripDate: { type: Date, required: true },
  purpose: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  notes: { type: String, trim: true, maxlength: 300, default: "" },
  emissionsKg: { type: Number, required: true, min: 0 },
  savingsKg: { type: Number, required: true, min: 0 },
  reviewed: { type: Boolean, default: false },
}, { timestamps: true });

tripSchema.index({ tripDate: -1, mode: 1 });
const Trip = mongoose.model("Trip", tripSchema);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "40kb" }));

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function createPayload(body = {}) {
  const data = {};
  const errors = {};
  if (!modes.includes(body.mode)) errors.mode = "Choose a supported transport mode";
  else data.mode = body.mode;
  data.distanceKm = Number(body.distanceKm);
  if (!Number.isFinite(data.distanceKm) || data.distanceKm < 0.1 || data.distanceKm > 2000) errors.distanceKm = "Distance must be between 0.1 and 2000 km";
  else data.distanceKm = round(data.distanceKm);
  data.passengers = Number(body.passengers);
  if (!Number.isInteger(data.passengers) || data.passengers < 1 || data.passengers > 8) errors.passengers = "Travellers must be a whole number from 1 to 8";
  data.tripDate = new Date(body.tripDate);
  if (!body.tripDate || Number.isNaN(data.tripDate.getTime())) errors.tripDate = "A valid trip date is required";
  else if (data.tripDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) errors.tripDate = "Trip date cannot be in the future";
  data.purpose = String(body.purpose || "").trim();
  if (data.purpose.length < 2 || data.purpose.length > 100) errors.purpose = "Purpose must contain 2-100 characters";
  data.notes = String(body.notes || "").trim();
  if (data.notes.length > 300) errors.notes = "Notes must be at most 300 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  const selected = factors[data.mode];
  const divisor = selected.vehicle ? data.passengers : 1;
  data.emissionsKg = round(data.distanceKm * selected.factor / divisor);
  const baseline = data.distanceKm * factors["car-petrol"].factor;
  data.savingsKg = round(Math.max(0, baseline - data.emissionsKg));
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/trips/stats", async (_req, res, next) => {
  try {
    const rows = await Trip.find().select("distanceKm emissionsKg savingsKg reviewed").lean();
    const stats = rows.reduce((result, row) => {
      result.totalTrips += 1;
      result.totalDistance += row.distanceKm;
      result.emissionsKg += row.emissionsKg;
      result.savingsKg += row.savingsKg;
      if (row.reviewed) result.reviewedTrips += 1;
      return result;
    }, { totalTrips: 0, totalDistance: 0, emissionsKg: 0, savingsKg: 0, reviewedTrips: 0 });
    stats.totalDistance = round(stats.totalDistance);
    stats.emissionsKg = round(stats.emissionsKg);
    stats.savingsKg = round(stats.savingsKg);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

app.get("/api/trips", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.mode) {
      if (!modes.includes(req.query.mode)) throw new HttpError(400, "Unknown transport mode filter");
      filter.mode = req.query.mode;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ purpose: pattern }, { notes: pattern }];
    }
    res.json(await Trip.find(filter).sort({ tripDate: -1, createdAt: -1 }).limit(300).lean());
  } catch (error) {
    next(error);
  }
});

app.post("/api/trips", async (req, res, next) => {
  try {
    res.status(201).json(await Trip.create(createPayload(req.body)));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/trips/:id", async (req, res, next) => {
  try {
    if (typeof req.body?.reviewed !== "boolean") throw new HttpError(400, "Reviewed must be true or false");
    const trip = await Trip.findByIdAndUpdate(req.params.id, { $set: { reviewed: req.body.reviewed } }, { new: true, runValidators: true });
    if (!trip) throw new HttpError(404, "Trip not found");
    res.json(trip);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trips/:id", async (req, res, next) => {
  try {
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) throw new HttpError(404, "Trip not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid trip ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/commute_carbon";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("CommuteCarbon API listening on " + port)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

