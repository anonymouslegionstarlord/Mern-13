import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const causes = ["education", "environment", "health", "community", "animals", "other"];
const statuses = ["planned", "completed", "cancelled"];
const activitySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  cause: { type: String, required: true, enum: causes },
  activityDate: { type: Date, required: true },
  hours: { type: Number, required: true, min: 0.5, max: 1000 },
  participants: { type: Number, required: true, min: 1, max: 10000 },
  organizerAlias: { type: String, required: true, trim: true, minlength: 3, maxlength: 60, match: /^[A-Za-z0-9_-]+$/ },
  notes: { type: String, required: true, trim: true, minlength: 10, maxlength: 400 },
  status: { type: String, enum: statuses, default: "planned" },
}, { timestamps: true });

activitySchema.index({ status: 1, cause: 1, activityDate: 1 });
const Activity = mongoose.model("Activity", activitySchema);
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
  data.title = String(body.title || "").trim();
  if (data.title.length < 3 || data.title.length > 120) errors.title = "Title must contain 3-120 characters";
  if (!causes.includes(body.cause)) errors.cause = "Choose a supported cause";
  else data.cause = body.cause;
  data.activityDate = new Date(body.activityDate);
  if (!body.activityDate || Number.isNaN(data.activityDate.getTime())) errors.activityDate = "A valid activity date is required";
  data.hours = Number(body.hours);
  if (!Number.isFinite(data.hours) || data.hours < 0.5 || data.hours > 1000) errors.hours = "Hours must be between 0.5 and 1000";
  else data.hours = Math.round(data.hours * 2) / 2;
  data.participants = Number(body.participants);
  if (!Number.isInteger(data.participants) || data.participants < 1 || data.participants > 10000) errors.participants = "Participants must be a whole number from 1 to 10000";
  data.organizerAlias = String(body.organizerAlias || "").trim();
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(data.organizerAlias)) errors.organizerAlias = "Use 3-60 letters, numbers, underscores, or hyphens";
  data.notes = String(body.notes || "").trim();
  if (data.notes.length < 10 || data.notes.length > 400) errors.notes = "Notes must contain 10-400 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/activities/stats", async (_req, res, next) => {
  try {
    const [total, planned, completedRows] = await Promise.all([
      Activity.countDocuments(),
      Activity.countDocuments({ status: "planned" }),
      Activity.find({ status: "completed" }).select("hours participants").lean(),
    ]);
    res.json({
      total,
      planned,
      completed: completedRows.length,
      completedHours: completedRows.reduce((sum, row) => sum + row.hours, 0),
      participantsReached: completedRows.reduce((sum, row) => sum + row.participants, 0),
    });
  } catch (error) { next(error); }
});

app.get("/api/activities", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.cause) {
      if (!causes.includes(req.query.cause)) throw new HttpError(400, "Unknown cause filter");
      filter.cause = req.query.cause;
    }
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ title: pattern }, { organizerAlias: pattern }, { notes: pattern }];
    }
    res.json(await Activity.find(filter).sort({ activityDate: 1, createdAt: -1 }).limit(250).lean());
  } catch (error) { next(error); }
});

app.post("/api/activities", async (req, res, next) => {
  try { res.status(201).json(await Activity.create(createPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/activities/:id", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const activity = await Activity.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!activity) throw new HttpError(404, "Activity not found");
    res.json(activity);
  } catch (error) { next(error); }
});

app.delete("/api/activities/:id", async (req, res, next) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) throw new HttpError(404, "Activity not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid activity ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/volunteer_vista";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("VolunteerVista API listening on " + port)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });

