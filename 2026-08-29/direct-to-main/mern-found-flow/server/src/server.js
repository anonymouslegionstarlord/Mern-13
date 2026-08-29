import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const categories = ["electronics", "clothing", "documents", "keys", "bags", "accessories", "other"];
const statuses = ["open", "matched", "returned"];
const itemSchema = new mongoose.Schema({
  kind: { type: String, required: true, enum: ["lost", "found"] },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  category: { type: String, required: true, enum: categories },
  location: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  eventDate: { type: Date, required: true },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
  contactAlias: { type: String, required: true, trim: true, minlength: 3, maxlength: 60, match: /^[A-Za-z0-9_-]+$/ },
  status: { type: String, enum: statuses, default: "open" },
}, { timestamps: true });

itemSchema.index({ status: 1, kind: 1, category: 1, eventDate: -1 });
const Item = mongoose.model("Item", itemSchema);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "50kb" }));

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
  if (!["lost", "found"].includes(body.kind)) errors.kind = "Kind must be lost or found";
  else data.kind = body.kind;
  data.title = String(body.title || "").trim();
  if (data.title.length < 3 || data.title.length > 100) errors.title = "Title must contain 3-100 characters";
  if (!categories.includes(body.category)) errors.category = "Choose a supported category";
  else data.category = body.category;
  data.location = String(body.location || "").trim();
  if (data.location.length < 2 || data.location.length > 100) errors.location = "Location must contain 2-100 characters";
  data.eventDate = new Date(body.eventDate);
  if (!body.eventDate || Number.isNaN(data.eventDate.getTime())) errors.eventDate = "A valid event date is required";
  else if (data.eventDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) errors.eventDate = "Event date cannot be in the future";
  data.description = String(body.description || "").trim();
  if (data.description.length < 10 || data.description.length > 500) errors.description = "Description must contain 10-500 characters";
  data.contactAlias = String(body.contactAlias || "").trim();
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(data.contactAlias)) errors.contactAlias = "Use 3-60 letters, numbers, underscores, or hyphens";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
const words = (value) => new Set(String(value).toLowerCase().match(/[a-z0-9]{3,}/g) || []);

function scoreMatch(source, candidate) {
  let score = source.category === candidate.category ? 5 : 0;
  const leftLocation = source.location.toLowerCase();
  const rightLocation = candidate.location.toLowerCase();
  if (leftLocation.includes(rightLocation) || rightLocation.includes(leftLocation)) score += 3;
  const sourceWords = words(source.title + " " + source.description);
  const candidateWords = words(candidate.title + " " + candidate.description);
  score += Math.min(4, [...sourceWords].filter((word) => candidateWords.has(word)).length);
  const days = Math.abs(new Date(source.eventDate) - new Date(candidate.eventDate)) / (24 * 60 * 60 * 1000);
  if (days <= 2) score += 3;
  else if (days <= 7) score += 2;
  else if (days <= 30) score += 1;
  return score;
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/items/stats", async (_req, res, next) => {
  try {
    const [total, open, lost, found, returned] = await Promise.all([
      Item.countDocuments(),
      Item.countDocuments({ status: "open" }),
      Item.countDocuments({ status: "open", kind: "lost" }),
      Item.countDocuments({ status: "open", kind: "found" }),
      Item.countDocuments({ status: "returned" }),
    ]);
    res.json({ total, open, lost, found, returned });
  } catch (error) {
    next(error);
  }
});

app.get("/api/items", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.kind) {
      if (!["lost", "found"].includes(req.query.kind)) throw new HttpError(400, "Unknown report kind filter");
      filter.kind = req.query.kind;
    }
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown report status filter");
      filter.status = req.query.status;
    }
    if (req.query.category) {
      if (!categories.includes(req.query.category)) throw new HttpError(400, "Unknown category filter");
      filter.category = req.query.category;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ title: pattern }, { description: pattern }, { location: pattern }];
    }
    res.json(await Item.find(filter).sort({ status: 1, eventDate: -1, createdAt: -1 }).limit(250).lean());
  } catch (error) {
    next(error);
  }
});

app.get("/api/items/:id/matches", async (req, res, next) => {
  try {
    const source = await Item.findById(req.params.id).lean();
    if (!source) throw new HttpError(404, "Item report not found");
    const candidates = await Item.find({
      _id: { $ne: source._id },
      kind: source.kind === "lost" ? "found" : "lost",
      status: "open",
      eventDate: {
        $gte: new Date(new Date(source.eventDate).getTime() - 45 * 24 * 60 * 60 * 1000),
        $lte: new Date(new Date(source.eventDate).getTime() + 45 * 24 * 60 * 60 * 1000),
      },
    }).limit(100).lean();
    const ranked = candidates
      .map((candidate) => ({ ...candidate, matchScore: scoreMatch(source, candidate) }))
      .filter((candidate) => candidate.matchScore >= 4)
      .sort((left, right) => right.matchScore - left.matchScore || new Date(right.eventDate) - new Date(left.eventDate))
      .slice(0, 6);
    res.json(ranked);
  } catch (error) {
    next(error);
  }
});

app.post("/api/items", async (req, res, next) => {
  try {
    res.status(201).json(await Item.create(createPayload(req.body)));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/items/:id", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const item = await Item.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!item) throw new HttpError(404, "Item report not found");
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/items/:id", async (req, res, next) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) throw new HttpError(404, "Item report not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid item report ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/found_flow";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("FoundFlow API listening on " + port)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

