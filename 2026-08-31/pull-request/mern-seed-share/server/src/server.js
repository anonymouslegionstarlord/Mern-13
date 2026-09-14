import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const seedTypes = ["vegetable", "herb", "flower", "native", "fruit", "other"];
const statuses = ["available", "reserved", "shared"];
const listingSchema = new mongoose.Schema({
  plantName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  variety: { type: String, trim: true, maxlength: 80, default: "" },
  seedType: { type: String, required: true, enum: seedTypes },
  quantityPackets: { type: Number, required: true, min: 1, max: 500 },
  harvestYear: { type: Number, required: true },
  pickupArea: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  contactAlias: { type: String, required: true, trim: true, minlength: 3, maxlength: 60, match: /^[A-Za-z0-9_-]+$/ },
  notes: { type: String, required: true, trim: true, minlength: 10, maxlength: 400 },
  status: { type: String, enum: statuses, default: "available" },
}, { timestamps: true });

listingSchema.index({ status: 1, seedType: 1, plantName: 1 });
const Listing = mongoose.model("Listing", listingSchema);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "40kb" }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

function createPayload(body = {}) {
  const data = {};
  const errors = {};
  data.plantName = String(body.plantName || "").trim();
  if (data.plantName.length < 2 || data.plantName.length > 100) errors.plantName = "Plant must contain 2-100 characters";
  data.variety = String(body.variety || "").trim();
  if (data.variety.length > 80) errors.variety = "Variety must be at most 80 characters";
  if (!seedTypes.includes(body.seedType)) errors.seedType = "Choose a supported seed type";
  else data.seedType = body.seedType;
  data.quantityPackets = Number(body.quantityPackets);
  if (!Number.isInteger(data.quantityPackets) || data.quantityPackets < 1 || data.quantityPackets > 500) errors.quantityPackets = "Packets must be a whole number from 1 to 500";
  const year = new Date().getFullYear();
  data.harvestYear = Number(body.harvestYear);
  if (!Number.isInteger(data.harvestYear) || data.harvestYear < year - 10 || data.harvestYear > year) errors.harvestYear = "Harvest year must be within the last 10 years";
  data.pickupArea = String(body.pickupArea || "").trim();
  if (data.pickupArea.length < 2 || data.pickupArea.length > 100) errors.pickupArea = "Pickup area must contain 2-100 characters";
  data.contactAlias = String(body.contactAlias || "").trim();
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(data.contactAlias)) errors.contactAlias = "Use 3-60 letters, numbers, underscores, or hyphens";
  data.notes = String(body.notes || "").trim();
  if (data.notes.length < 10 || data.notes.length > 400) errors.notes = "Notes must contain 10-400 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/listings/stats", async (_req, res, next) => {
  try {
    const [total, availableRows, reserved, shared] = await Promise.all([
      Listing.countDocuments(),
      Listing.find({ status: "available" }).select("quantityPackets").lean(),
      Listing.countDocuments({ status: "reserved" }),
      Listing.countDocuments({ status: "shared" }),
    ]);
    res.json({
      total,
      availableListings: availableRows.length,
      availablePackets: availableRows.reduce((sum, row) => sum + row.quantityPackets, 0),
      reserved,
      shared,
    });
  } catch (error) { next(error); }
});

app.get("/api/listings", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.seedType) {
      if (!seedTypes.includes(req.query.seedType)) throw new HttpError(400, "Unknown seed type filter");
      filter.seedType = req.query.seedType;
    }
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ plantName: pattern }, { variety: pattern }, { pickupArea: pattern }, { notes: pattern }];
    }
    res.json(await Listing.find(filter).sort({ status: 1, createdAt: -1 }).limit(250).lean());
  } catch (error) { next(error); }
});

app.post("/api/listings", async (req, res, next) => {
  try { res.status(201).json(await Listing.create(createPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/listings/:id", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const listing = await Listing.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!listing) throw new HttpError(404, "Seed listing not found");
    res.json(listing);
  } catch (error) { next(error); }
});

app.delete("/api/listings/:id", async (req, res, next) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) throw new HttpError(404, "Seed listing not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid seed listing ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/seed_share";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("SeedShare API listening on " + port)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });

