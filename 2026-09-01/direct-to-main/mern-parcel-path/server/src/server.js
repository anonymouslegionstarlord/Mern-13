import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const directions = ["incoming", "outgoing"];
const statuses = ["label-created", "in-transit", "ready", "delivered", "exception"];
const parcelSchema = new mongoose.Schema({
  referenceAlias: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 60, match: /^[A-Za-z0-9_-]+$/ },
  carrier: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  direction: { type: String, required: true, enum: directions },
  expectedDate: { type: Date, required: true },
  destinationArea: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  notes: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  status: { type: String, enum: statuses, default: "label-created" },
}, { timestamps: true });

parcelSchema.index({ status: 1, direction: 1, expectedDate: 1 });
const Parcel = mongoose.model("Parcel", parcelSchema);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "32kb" }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

function createPayload(body = {}) {
  const data = {};
  const errors = {};
  data.referenceAlias = String(body.referenceAlias || "").trim();
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(data.referenceAlias)) errors.referenceAlias = "Use 3-60 letters, numbers, underscores, or hyphens";
  data.carrier = String(body.carrier || "").trim();
  if (data.carrier.length < 2 || data.carrier.length > 60) errors.carrier = "Carrier must contain 2-60 characters";
  if (!directions.includes(body.direction)) errors.direction = "Choose incoming or outgoing";
  else data.direction = body.direction;
  data.expectedDate = new Date(body.expectedDate);
  if (!body.expectedDate || Number.isNaN(data.expectedDate.getTime())) errors.expectedDate = "A valid expected date is required";
  data.destinationArea = String(body.destinationArea || "").trim();
  if (data.destinationArea.length < 2 || data.destinationArea.length > 80) errors.destinationArea = "Destination area must contain 2-80 characters";
  data.notes = String(body.notes || "").trim();
  if (data.notes.length < 5 || data.notes.length > 300) errors.notes = "Notes must contain 5-300 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/parcels/stats", async (_req, res, next) => {
  try {
    const now = new Date();
    const [total, active, delivered, exceptions, overdue] = await Promise.all([
      Parcel.countDocuments(),
      Parcel.countDocuments({ status: { $nin: ["delivered"] } }),
      Parcel.countDocuments({ status: "delivered" }),
      Parcel.countDocuments({ status: "exception" }),
      Parcel.countDocuments({ expectedDate: { $lt: now }, status: { $nin: ["delivered"] } }),
    ]);
    res.json({ total, active, delivered, exceptions, overdue });
  } catch (error) { next(error); }
});

app.get("/api/parcels", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.direction) {
      if (!directions.includes(req.query.direction)) throw new HttpError(400, "Unknown direction filter");
      filter.direction = req.query.direction;
    }
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ referenceAlias: pattern }, { carrier: pattern }, { destinationArea: pattern }, { notes: pattern }];
    }
    res.json(await Parcel.find(filter).sort({ expectedDate: 1, createdAt: -1 }).limit(250).lean());
  } catch (error) { next(error); }
});

app.post("/api/parcels", async (req, res, next) => {
  try { res.status(201).json(await Parcel.create(createPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/parcels/:id/status", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const parcel = await Parcel.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!parcel) throw new HttpError(404, "Parcel not found");
    res.json(parcel);
  } catch (error) { next(error); }
});

app.delete("/api/parcels/:id", async (req, res, next) => {
  try {
    const parcel = await Parcel.findByIdAndDelete(req.params.id);
    if (!parcel) throw new HttpError(404, "Parcel not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid parcel ID" });
  if (error.code === 11000) return res.status(409).json({ message: "That reference alias is already in use" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/parcel_path";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("ParcelPath API listening on " + port)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
