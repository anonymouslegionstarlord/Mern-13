import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const shotTypes = ["wide", "medium", "close-up", "detail", "overhead", "other"];
const locationTypes = ["interior", "exterior", "studio"];
const priorities = ["low", "medium", "high"];
const statuses = ["planned", "ready", "captured", "approved"];

const shotSchema = new mongoose.Schema({
  shotCode: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 3, maxlength: 30, match: /^[A-Z0-9-]+$/ },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  sceneLabel: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  shotType: { type: String, required: true, enum: shotTypes },
  locationType: { type: String, required: true, enum: locationTypes },
  durationSeconds: { type: Number, required: true, min: 1, max: 3600 },
  scheduledDate: { type: Date, required: true },
  priority: { type: String, required: true, enum: priorities },
  status: { type: String, enum: statuses, default: "planned" },
  notes: { type: String, required: true, trim: true, minlength: 5, maxlength: 400 },
}, { timestamps: true });

shotSchema.index({ status: 1, priority: 1, scheduledDate: 1 });
const Shot = mongoose.model("Shot", shotSchema);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "48kb" }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

function createPayload(body = {}) {
  const data = {};
  const errors = {};
  data.shotCode = String(body.shotCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,30}$/.test(data.shotCode)) errors.shotCode = "Use 3-30 letters, numbers, or hyphens";
  data.title = String(body.title || "").trim();
  if (data.title.length < 3 || data.title.length > 120) errors.title = "Title must contain 3-120 characters";
  data.sceneLabel = String(body.sceneLabel || "").trim();
  if (data.sceneLabel.length < 2 || data.sceneLabel.length > 60) errors.sceneLabel = "Scene label must contain 2-60 characters";
  if (!shotTypes.includes(body.shotType)) errors.shotType = "Choose a supported shot type";
  else data.shotType = body.shotType;
  if (!locationTypes.includes(body.locationType)) errors.locationType = "Choose a supported location type";
  else data.locationType = body.locationType;
  data.durationSeconds = Number(body.durationSeconds);
  if (!Number.isInteger(data.durationSeconds) || data.durationSeconds < 1 || data.durationSeconds > 3600) errors.durationSeconds = "Duration must be a whole number from 1 to 3600 seconds";
  data.scheduledDate = new Date(body.scheduledDate);
  if (!body.scheduledDate || Number.isNaN(data.scheduledDate.getTime())) errors.scheduledDate = "A valid scheduled date is required";
  if (!priorities.includes(body.priority)) errors.priority = "Choose a supported priority";
  else data.priority = body.priority;
  data.notes = String(body.notes || "").trim();
  if (data.notes.length < 5 || data.notes.length > 400) errors.notes = "Notes must contain 5-400 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/shots/stats", async (_req, res, next) => {
  try {
    const rows = await Shot.find().select("status durationSeconds priority").lean();
    res.json({
      total: rows.length,
      ready: rows.filter((row) => row.status === "ready").length,
      captured: rows.filter((row) => row.status === "captured").length,
      approved: rows.filter((row) => row.status === "approved").length,
      highPriority: rows.filter((row) => row.priority === "high" && row.status !== "approved").length,
      plannedRuntimeSeconds: rows.reduce((sum, row) => sum + row.durationSeconds, 0),
    });
  } catch (error) { next(error); }
});

app.get("/api/shots", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.shotType) {
      if (!shotTypes.includes(req.query.shotType)) throw new HttpError(400, "Unknown shot type filter");
      filter.shotType = req.query.shotType;
    }
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.priority) {
      if (!priorities.includes(req.query.priority)) throw new HttpError(400, "Unknown priority filter");
      filter.priority = req.query.priority;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ shotCode: pattern }, { title: pattern }, { sceneLabel: pattern }, { notes: pattern }];
    }
    res.json(await Shot.find(filter).sort({ scheduledDate: 1, priority: -1, createdAt: -1 }).limit(250).lean());
  } catch (error) { next(error); }
});

app.post("/api/shots", async (req, res, next) => {
  try { res.status(201).json(await Shot.create(createPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/shots/:id/status", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const shot = await Shot.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!shot) throw new HttpError(404, "Shot not found");
    res.json(shot);
  } catch (error) { next(error); }
});

app.delete("/api/shots/:id", async (req, res, next) => {
  try {
    const shot = await Shot.findByIdAndDelete(req.params.id);
    if (!shot) throw new HttpError(404, "Shot not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid shot ID" });
  if (error.code === 11000) return res.status(409).json({ message: "That shot code is already in use" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/shot_stack";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("ShotStack API listening on " + port)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
