import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const cycles = ["weekly", "monthly", "quarterly", "yearly"];
const statuses = ["active", "paused", "cancelled"];
const subscriptionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, trim: true, maxlength: 40 },
  amount: { type: Number, required: true, min: 0.01 },
  billingCycle: { type: String, required: true, enum: cycles },
  nextRenewal: { type: Date, required: true },
  autoRenew: { type: Boolean, default: true },
  status: { type: String, enum: statuses, default: "active" },
  notes: { type: String, trim: true, maxlength: 300, default: "" },
}, { timestamps: true });

const Subscription = mongoose.model("Subscription", subscriptionSchema);
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "40kb" }));

class HttpError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }

function createPayload(body) {
  const data = {};
  const errors = {};
  data.name = String(body.name || "").trim();
  if (!data.name || data.name.length > 100) errors.name = "Name is required and must be at most 100 characters";
  data.category = String(body.category || "").trim();
  if (!data.category || data.category.length > 40) errors.category = "Category is required and must be at most 40 characters";
  data.amount = Number(body.amount);
  if (!Number.isFinite(data.amount) || data.amount <= 0) errors.amount = "Amount must be greater than zero";
  else data.amount = Math.round(data.amount * 100) / 100;
  if (!cycles.includes(body.billingCycle)) errors.billingCycle = `Billing cycle must be one of: ${cycles.join(", ")}`;
  else data.billingCycle = body.billingCycle;
  data.nextRenewal = new Date(body.nextRenewal);
  if (!body.nextRenewal || Number.isNaN(data.nextRenewal.getTime())) errors.nextRenewal = "A valid renewal date is required";
  data.autoRenew = body.autoRenew !== false;
  data.notes = String(body.notes || "").trim();
  if (data.notes.length > 300) errors.notes = "Notes must be at most 300 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const monthlyFactor = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/subscriptions/stats", async (_req, res, next) => {
  try {
    const activeItems = await Subscription.find({ status: "active" }).select("amount billingCycle nextRenewal autoRenew").lean();
    const now = Date.now();
    const soon = now + 30 * 24 * 60 * 60 * 1000;
    const stats = activeItems.reduce((result, item) => {
      result.active += 1;
      result.monthlyCost += item.amount * monthlyFactor[item.billingCycle];
      if (item.autoRenew) result.autoRenew += 1;
      const renewal = new Date(item.nextRenewal).getTime();
      if (renewal >= now && renewal <= soon) result.renewingSoon += 1;
      return result;
    }, { active: 0, monthlyCost: 0, renewingSoon: 0, autoRenew: 0 });
    stats.monthlyCost = Math.round(stats.monthlyCost * 100) / 100;
    res.json(stats);
  } catch (error) { next(error); }
});

app.get("/api/subscriptions", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown subscription status filter");
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ name: pattern }, { category: pattern }, { notes: pattern }];
    }
    res.json(await Subscription.find(filter).sort({ status: 1, nextRenewal: 1, createdAt: -1 }).limit(250).lean());
  } catch (error) { next(error); }
});

app.post("/api/subscriptions", async (req, res, next) => {
  try { res.status(201).json(await Subscription.create(createPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/subscriptions/:id", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, `Status must be one of: ${statuses.join(", ")}`);
    const item = await Subscription.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!item) throw new HttpError(404, "Subscription not found");
    res.json(item);
  } catch (error) { next(error); }
});

app.delete("/api/subscriptions/:id", async (req, res, next) => {
  try {
    const item = await Subscription.findByIdAndDelete(req.params.id);
    if (!item) throw new HttpError(404, "Subscription not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.path} not found`)));
app.use((error, _req, res, _next) => {
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid subscription ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/renewal_radar";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log(`RenewalRadar API listening on ${port}`)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });

