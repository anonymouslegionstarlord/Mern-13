import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const intents = ["offering", "seeking"];
const levels = ["beginner", "intermediate", "advanced"];
const formats = ["online", "in-person", "hybrid"];
const statuses = ["open", "matched", "completed"];
const postSchema = new mongoose.Schema({
  intent: { type: String, required: true, enum: intents },
  topic: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  level: { type: String, required: true, enum: levels },
  format: { type: String, required: true, enum: formats },
  availability: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  contactAlias: { type: String, required: true, trim: true, minlength: 3, maxlength: 60, match: /^[A-Za-z0-9_-]+$/ },
  notes: { type: String, required: true, trim: true, minlength: 10, maxlength: 400 },
  status: { type: String, enum: statuses, default: "open" },
}, { timestamps: true });

postSchema.index({ status: 1, intent: 1, topic: 1 });
const Post = mongoose.model("Post", postSchema);
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
  if (!intents.includes(body.intent)) errors.intent = "Intent must be offering or seeking";
  else data.intent = body.intent;
  data.topic = String(body.topic || "").trim();
  if (data.topic.length < 2 || data.topic.length > 100) errors.topic = "Topic must contain 2-100 characters";
  if (!levels.includes(body.level)) errors.level = "Choose a supported level";
  else data.level = body.level;
  if (!formats.includes(body.format)) errors.format = "Choose a supported format";
  else data.format = body.format;
  data.availability = String(body.availability || "").trim();
  if (data.availability.length < 3 || data.availability.length > 120) errors.availability = "Availability must contain 3-120 characters";
  data.contactAlias = String(body.contactAlias || "").trim();
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(data.contactAlias)) errors.contactAlias = "Use 3-60 letters, numbers, underscores, or hyphens";
  data.notes = String(body.notes || "").trim();
  if (data.notes.length < 10 || data.notes.length > 400) errors.notes = "Details must contain 10-400 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/posts/stats", async (_req, res, next) => {
  try {
    const [total, open, offering, seeking, completed] = await Promise.all([
      Post.countDocuments(),
      Post.countDocuments({ status: "open" }),
      Post.countDocuments({ status: "open", intent: "offering" }),
      Post.countDocuments({ status: "open", intent: "seeking" }),
      Post.countDocuments({ status: "completed" }),
    ]);
    res.json({ total, open, offering, seeking, completed });
  } catch (error) {
    next(error);
  }
});

app.get("/api/posts", async (req, res, next) => {
  try {
    const filter = {};
    for (const [name, allowed] of [["intent", intents], ["format", formats], ["status", statuses]]) {
      if (req.query[name]) {
        if (!allowed.includes(req.query[name])) throw new HttpError(400, "Unknown " + name + " filter");
        filter[name] = req.query[name];
      }
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ topic: pattern }, { availability: pattern }, { notes: pattern }];
    }
    res.json(await Post.find(filter).sort({ createdAt: -1 }).limit(250).lean());
  } catch (error) {
    next(error);
  }
});

app.post("/api/posts", async (req, res, next) => {
  try {
    res.status(201).json(await Post.create(createPayload(req.body)));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/posts/:id", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const post = await Post.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!post) throw new HttpError(404, "Skill post not found");
    res.json(post);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/posts/:id", async (req, res, next) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) throw new HttpError(404, "Skill post not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid skill post ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mentor_mesh";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("MentorMesh API listening on " + port)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

