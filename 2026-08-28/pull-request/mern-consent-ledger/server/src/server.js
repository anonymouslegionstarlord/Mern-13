import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const channels = ["web", "mobile", "email", "in-person"];
const consentSchema = new mongoose.Schema({
  subjectRef: { type: String, required: true, trim: true, minlength: 3, maxlength: 64, match: /^[A-Za-z0-9_-]+$/ },
  purpose: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
  channel: { type: String, required: true, enum: channels },
  policyVersion: { type: String, required: true, trim: true, maxlength: 30 },
  grantedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  revokedAt: { type: Date, default: null },
  notes: { type: String, trim: true, maxlength: 300, default: "" },
}, { timestamps: true });

consentSchema.index({ subjectRef: 1, createdAt: -1 });
consentSchema.index({ status: 1, expiresAt: 1 });
const Consent = mongoose.model("Consent", consentSchema);

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

function parseDate(value, field, errors) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) errors[field] = "A valid " + field + " date is required";
  return date;
}

function createPayload(body = {}) {
  const data = {};
  const errors = {};
  data.subjectRef = String(body.subjectRef || "").trim();
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(data.subjectRef)) errors.subjectRef = "Use 3-64 letters, numbers, underscores, or hyphens";
  data.purpose = String(body.purpose || "").trim();
  if (data.purpose.length < 3 || data.purpose.length > 160) errors.purpose = "Purpose must contain 3-160 characters";
  if (!channels.includes(body.channel)) errors.channel = "Channel must be one of: " + channels.join(", ");
  else data.channel = body.channel;
  data.policyVersion = String(body.policyVersion || "").trim();
  if (!data.policyVersion || data.policyVersion.length > 30) errors.policyVersion = "Policy version is required and must be at most 30 characters";
  data.grantedAt = parseDate(body.grantedAt, "grantedAt", errors);
  data.expiresAt = parseDate(body.expiresAt, "expiresAt", errors);
  if (!errors.grantedAt && !errors.expiresAt && data.expiresAt <= data.grantedAt) errors.expiresAt = "Expiry must be after the grant date";
  data.notes = String(body.notes || "").trim();
  if (data.notes.length > 300) errors.notes = "Notes must be at most 300 characters";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

function effective(record, now = Date.now()) {
  return {
    ...record,
    effectiveStatus: record.status === "revoked" ? "revoked" : new Date(record.expiresAt).getTime() <= now ? "expired" : "active",
  };
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/consents/stats", async (_req, res, next) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [total, active, expiring, expired, revoked] = await Promise.all([
      Consent.countDocuments(),
      Consent.countDocuments({ status: "active", expiresAt: { $gt: now } }),
      Consent.countDocuments({ status: "active", expiresAt: { $gt: now, $lte: soon } }),
      Consent.countDocuments({ status: "active", expiresAt: { $lte: now } }),
      Consent.countDocuments({ status: "revoked" }),
    ]);
    res.json({ total, active, expiring, expired, revoked });
  } catch (error) {
    next(error);
  }
});

app.get("/api/consents", async (req, res, next) => {
  try {
    const now = new Date();
    const filter = {};
    if (req.query.status === "active") Object.assign(filter, { status: "active", expiresAt: { $gt: now } });
    else if (req.query.status === "expired") Object.assign(filter, { status: "active", expiresAt: { $lte: now } });
    else if (req.query.status === "revoked") filter.status = "revoked";
    else if (req.query.status) throw new HttpError(400, "Unknown consent status filter");
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ subjectRef: pattern }, { purpose: pattern }, { policyVersion: pattern }];
    }
    const rows = await Consent.find(filter).sort({ createdAt: -1 }).limit(250).lean();
    res.json(rows.map((row) => effective(row, now.getTime())));
  } catch (error) {
    next(error);
  }
});

app.post("/api/consents", async (req, res, next) => {
  try {
    const record = await Consent.create(createPayload(req.body));
    res.status(201).json(effective(record.toObject()));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/consents/:id/revoke", async (req, res, next) => {
  try {
    const record = await Consent.findById(req.params.id);
    if (!record) throw new HttpError(404, "Consent record not found");
    if (record.status === "revoked") throw new HttpError(409, "Consent is already revoked");
    record.status = "revoked";
    record.revokedAt = new Date();
    await record.save();
    res.json(effective(record.toObject()));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/consents/:id", async (req, res, next) => {
  try {
    const record = await Consent.findByIdAndDelete(req.params.id);
    if (!record) throw new HttpError(404, "Consent record not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid consent record ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/consent_ledger";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("ConsentLedger API listening on " + port)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

