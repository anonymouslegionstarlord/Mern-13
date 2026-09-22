import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 80 },
  votes: { type: Number, default: 0, min: 0 },
});

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, minlength: 5, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  createdBy: { type: String, required: true, trim: true, maxlength: 80 },
  closesAt: { type: Date, required: true },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  options: {
    type: [optionSchema],
    validate: { validator: (items) => items.length >= 2 && items.length <= 6, message: "Polls need 2-6 options" },
  },
}, { timestamps: true });

const Poll = mongoose.model("Poll", pollSchema);
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "40kb" }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

function pollPayload(body) {
  const data = {};
  const errors = {};
  data.question = String(body.question || "").trim();
  if (data.question.length < 5 || data.question.length > 180) errors.question = "Question must contain 5-180 characters";
  data.description = String(body.description || "").trim();
  if (data.description.length > 500) errors.description = "Description must be at most 500 characters";
  data.createdBy = String(body.createdBy || "").trim();
  if (!data.createdBy || data.createdBy.length > 80) errors.createdBy = "Creator is required and must be at most 80 characters";
  data.closesAt = new Date(body.closesAt);
  if (!body.closesAt || Number.isNaN(data.closesAt.getTime())) errors.closesAt = "A valid closing time is required";
  else if (data.closesAt.getTime() <= Date.now() + 60_000) errors.closesAt = "Closing time must be at least one minute in the future";
  if (!Array.isArray(body.options)) errors.options = "Options must be an array";
  else {
    const labels = body.options.map((item) => String(item || "").trim());
    if (labels.length < 2 || labels.length > 6) errors.options = "Provide 2-6 options";
    else if (labels.some((item) => !item || item.length > 80)) errors.options = "Each option must contain 1-80 characters";
    else if (new Set(labels.map((item) => item.toLocaleLowerCase())).size !== labels.length) errors.options = "Options must be unique";
    else data.options = labels.map((label) => ({ label, votes: 0 }));
  }
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/polls/stats", async (_req, res, next) => {
  try {
    const polls = await Poll.find().select("status closesAt options.votes").lean();
    const now = Date.now();
    const stats = polls.reduce((result, poll) => {
      const open = poll.status === "open" && new Date(poll.closesAt).getTime() > now;
      result.total += 1;
      result[open ? "open" : "closed"] += 1;
      result.votes += poll.options.reduce((sum, option) => sum + option.votes, 0);
      return result;
    }, { total: 0, open: 0, closed: 0, votes: 0 });
    res.json(stats);
  } catch (error) { next(error); }
});

app.get("/api/polls", async (req, res, next) => {
  try {
    const filter = {};
    const now = new Date();
    if (req.query.status === "open") Object.assign(filter, { status: "open", closesAt: { $gt: now } });
    else if (req.query.status === "closed") filter.$or = [{ status: "closed" }, { closesAt: { $lte: now } }];
    else if (req.query.status) throw new HttpError(400, "Unknown poll status filter");
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      const search = [{ question: pattern }, { description: pattern }, { createdBy: pattern }];
      if (filter.$or) {
        const statusClauses = filter.$or;
        delete filter.$or;
        filter.$and = [{ $or: statusClauses }, { $or: search }];
      } else {
        filter.$or = search;
      }
    }
    res.json(await Poll.find(filter).sort({ status: 1, closesAt: 1, createdAt: -1 }).limit(200).lean());
  } catch (error) { next(error); }
});

app.post("/api/polls", async (req, res, next) => {
  try { res.status(201).json(await Poll.create(pollPayload(req.body))); }
  catch (error) { next(error); }
});

app.post("/api/polls/:id/votes", async (req, res, next) => {
  try {
    const optionId = req.body?.optionId;
    if (!mongoose.isValidObjectId(optionId)) throw new HttpError(400, "A valid optionId is required");
    const poll = await Poll.findOneAndUpdate(
      { _id: req.params.id, status: "open", closesAt: { $gt: new Date() }, "options._id": optionId },
      { $inc: { "options.$.votes": 1 } },
      { new: true, runValidators: true },
    );
    if (!poll) {
      const existing = await Poll.findById(req.params.id).select("status closesAt options._id").lean();
      if (!existing) throw new HttpError(404, "Poll not found");
      if (existing.status === "closed" || new Date(existing.closesAt) <= new Date()) throw new HttpError(409, "Poll is closed");
      throw new HttpError(404, "Option not found");
    }
    res.json(poll);
  } catch (error) { next(error); }
});

app.patch("/api/polls/:id/status", async (req, res, next) => {
  try {
    if (req.body.status !== "closed") throw new HttpError(400, "This endpoint only closes polls");
    const poll = await Poll.findByIdAndUpdate(req.params.id, { $set: { status: "closed" } }, { new: true, runValidators: true });
    if (!poll) throw new HttpError(404, "Poll not found");
    res.json(poll);
  } catch (error) { next(error); }
});

app.delete("/api/polls/:id", async (req, res, next) => {
  try {
    const poll = await Poll.findByIdAndDelete(req.params.id);
    if (!poll) throw new HttpError(404, "Poll not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.path} not found`)));
app.use((error, _req, res, _next) => {
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid poll ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/poll_pulse";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log(`PollPulse API listening on ${port}`)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
