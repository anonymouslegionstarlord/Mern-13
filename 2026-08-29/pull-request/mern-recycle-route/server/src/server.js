import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const itemTypes = ["phone", "computer", "battery", "appliance", "cable", "peripheral", "other"];
const statuses = ["requested", "scheduled", "collected", "recycled"];
const transitions = { requested: "scheduled", scheduled: "collected", collected: "recycled" };
const pickupSchema = new mongoose.Schema({
  itemType: { type: String, required: true, enum: itemTypes },
  quantity: { type: Number, required: true, min: 1, max: 100 },
  estimatedWeight: { type: Number, required: true, min: 0.1, max: 500 },
  pickupArea: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  requestedDate: { type: Date, required: true },
  contactAlias: { type: String, required: true, trim: true, minlength: 3, maxlength: 60, match: /^[A-Za-z0-9_-]+$/ },
  notes: { type: String, trim: true, maxlength: 300, default: "" },
  status: { type: String, enum: statuses, default: "requested" },
  statusUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

pickupSchema.index({ status: 1, requestedDate: 1 });
const Pickup = mongoose.model("Pickup", pickupSchema);
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

function createPayload(body = {}) {
  const data = {};
  const errors = {};
  if (!itemTypes.includes(body.itemType)) errors.itemType = "Choose a supported item type";
  else data.itemType = body.itemType;
  data.quantity = Number(body.quantity);
  if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 100) errors.quantity = "Quantity must be a whole number from 1 to 100";
  data.estimatedWeight = Number(body.estimatedWeight);
  if (!Number.isFinite(data.estimatedWeight) || data.estimatedWeight < 0.1 || data.estimatedWeight > 500) errors.estimatedWeight = "Weight must be between 0.1 and 500 kg";
  else data.estimatedWeight = Math.round(data.estimatedWeight * 10) / 10;
  data.pickupArea = String(body.pickupArea || "").trim();
  if (data.pickupArea.length < 2 || data.pickupArea.length > 100) errors.pickupArea = "Pickup area must contain 2-100 characters";
  data.requestedDate = new Date(body.requestedDate);
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;
  if (!body.requestedDate || Number.isNaN(data.requestedDate.getTime())) errors.requestedDate = "A valid requested date is required";
  else if (data.requestedDate.getTime() < yesterday) errors.requestedDate = "Requested date cannot be in the past";
  data.contactAlias = String(body.contactAlias || "").trim();
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(data.contactAlias)) errors.contactAlias = "Use 3-60 letters, numbers, underscores, or hyphens";
  data.notes = String(body.notes || "").trim();
  if (data.notes.length > 300) errors.notes = "Notes must be at most 300 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/pickups/stats", async (_req, res, next) => {
  try {
    const [total, pending, collectedRows, recycledRows] = await Promise.all([
      Pickup.countDocuments(),
      Pickup.countDocuments({ status: { $in: ["requested", "scheduled"] } }),
      Pickup.find({ status: "collected" }).select("quantity").lean(),
      Pickup.find({ status: "recycled" }).select("quantity estimatedWeight").lean(),
    ]);
    const collectedItems = collectedRows.reduce((sum, row) => sum + row.quantity, 0);
    const recycledItems = recycledRows.reduce((sum, row) => sum + row.quantity, 0);
    const divertedWeight = Math.round(recycledRows.reduce((sum, row) => sum + row.estimatedWeight, 0) * 10) / 10;
    res.json({ total, pending, collectedItems, recycledItems, divertedWeight });
  } catch (error) {
    next(error);
  }
});

app.get("/api/pickups", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown pickup status filter");
      filter.status = req.query.status;
    }
    if (req.query.itemType) {
      if (!itemTypes.includes(req.query.itemType)) throw new HttpError(400, "Unknown item type filter");
      filter.itemType = req.query.itemType;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ pickupArea: pattern }, { contactAlias: pattern }, { notes: pattern }];
    }
    res.json(await Pickup.find(filter).sort({ status: 1, requestedDate: 1, createdAt: -1 }).limit(250).lean());
  } catch (error) {
    next(error);
  }
});

app.post("/api/pickups", async (req, res, next) => {
  try {
    res.status(201).json(await Pickup.create(createPayload(req.body)));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/pickups/:id/advance", async (req, res, next) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) throw new HttpError(404, "Pickup request not found");
    const expected = transitions[pickup.status];
    if (!expected) throw new HttpError(409, "A recycled request cannot advance further");
    if (req.body?.status !== expected) throw new HttpError(409, "Next status must be " + expected);
    pickup.status = expected;
    pickup.statusUpdatedAt = new Date();
    await pickup.save();
    res.json(pickup);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/pickups/:id", async (req, res, next) => {
  try {
    const pickup = await Pickup.findByIdAndDelete(req.params.id);
    if (!pickup) throw new HttpError(404, "Pickup request not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid pickup request ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/recycle_route";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("RecycleRoute API listening on " + port)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

