import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const genres = ["classical", "jazz", "rock", "pop", "folk", "film", "other"];
const statuses = ["learning", "polishing", "performance-ready", "archived"];

const pieceSchema = new mongoose.Schema({
  practiceCode: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 3, maxlength: 30, match: /^[A-Z0-9-]+$/ },
  pieceName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  instrument: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  genre: { type: String, required: true, enum: genres },
  currentBpm: { type: Number, required: true, min: 20, max: 300 },
  targetBpm: { type: Number, required: true, min: 20, max: 300 },
  plannedMinutes: { type: Number, required: true, min: 5, max: 480 },
  nextPracticeDate: { type: Date, required: true },
  focusNotes: { type: String, required: true, trim: true, minlength: 5, maxlength: 400 },
  status: { type: String, enum: statuses, default: "learning" },
  sessionsCompleted: { type: Number, default: 0, min: 0, max: 100000 },
  lastPracticedAt: { type: Date, default: null },
}, { timestamps: true });

pieceSchema.index({ status: 1, genre: 1, nextPracticeDate: 1 });
const Piece = mongoose.model("Piece", pieceSchema);
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
  data.practiceCode = String(body.practiceCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,30}$/.test(data.practiceCode)) errors.practiceCode = "Use 3-30 letters, numbers, or hyphens";
  data.pieceName = String(body.pieceName || "").trim();
  if (data.pieceName.length < 2 || data.pieceName.length > 120) errors.pieceName = "Piece name must contain 2-120 characters";
  data.instrument = String(body.instrument || "").trim();
  if (data.instrument.length < 2 || data.instrument.length > 60) errors.instrument = "Instrument must contain 2-60 characters";
  if (!genres.includes(body.genre)) errors.genre = "Choose a supported genre";
  else data.genre = body.genre;
  data.currentBpm = Number(body.currentBpm);
  if (!Number.isInteger(data.currentBpm) || data.currentBpm < 20 || data.currentBpm > 300) errors.currentBpm = "Current BPM must be a whole number from 20 to 300";
  data.targetBpm = Number(body.targetBpm);
  if (!Number.isInteger(data.targetBpm) || data.targetBpm < 20 || data.targetBpm > 300) errors.targetBpm = "Target BPM must be a whole number from 20 to 300";
  else if (Number.isInteger(data.currentBpm) && data.targetBpm < data.currentBpm) errors.targetBpm = "Target BPM cannot be lower than current BPM";
  data.plannedMinutes = Number(body.plannedMinutes);
  if (!Number.isInteger(data.plannedMinutes) || data.plannedMinutes < 5 || data.plannedMinutes > 480) errors.plannedMinutes = "Planned minutes must be a whole number from 5 to 480";
  data.nextPracticeDate = new Date(body.nextPracticeDate);
  if (!body.nextPracticeDate || Number.isNaN(data.nextPracticeDate.getTime())) errors.nextPracticeDate = "A valid next-practice date is required";
  data.focusNotes = String(body.focusNotes || "").trim();
  if (data.focusNotes.length < 5 || data.focusNotes.length > 400) errors.focusNotes = "Focus notes must contain 5-400 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/pieces/stats", async (_req, res, next) => {
  try {
    const rows = await Piece.find().select("status currentBpm targetBpm sessionsCompleted nextPracticeDate").lean();
    const active = rows.filter((row) => row.status !== "archived");
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const progress = active.map((row) => Math.min(100, row.currentBpm / row.targetBpm * 100));
    res.json({
      total: rows.length,
      active: active.length,
      performanceReady: rows.filter((row) => row.status === "performance-ready").length,
      due: active.filter((row) => row.nextPracticeDate <= endOfToday).length,
      totalSessions: rows.reduce((sum, row) => sum + row.sessionsCompleted, 0),
      averageTempoProgress: progress.length ? Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length) : 0,
    });
  } catch (error) { next(error); }
});

app.get("/api/pieces", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.genre) {
      if (!genres.includes(req.query.genre)) throw new HttpError(400, "Unknown genre filter");
      filter.genre = req.query.genre;
    }
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ practiceCode: pattern }, { pieceName: pattern }, { instrument: pattern }, { focusNotes: pattern }];
    }
    res.json(await Piece.find(filter).sort({ nextPracticeDate: 1, createdAt: -1 }).limit(250).lean());
  } catch (error) { next(error); }
});

app.post("/api/pieces", async (req, res, next) => {
  try { res.status(201).json(await Piece.create(createPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/pieces/:id/status", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const piece = await Piece.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!piece) throw new HttpError(404, "Piece not found");
    res.json(piece);
  } catch (error) { next(error); }
});

app.post("/api/pieces/:id/practice", async (req, res, next) => {
  try {
    const piece = await Piece.findByIdAndUpdate(req.params.id, { $inc: { sessionsCompleted: 1 }, $set: { lastPracticedAt: new Date() } }, { new: true, runValidators: true });
    if (!piece) throw new HttpError(404, "Piece not found");
    res.json(piece);
  } catch (error) { next(error); }
});

app.delete("/api/pieces/:id", async (req, res, next) => {
  try {
    const piece = await Piece.findByIdAndDelete(req.params.id);
    if (!piece) throw new HttpError(404, "Piece not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid piece ID" });
  if (error.code === 11000) return res.status(409).json({ message: "That practice code is already in use" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tempo_trail";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("TempoTrail API listening on " + port)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
