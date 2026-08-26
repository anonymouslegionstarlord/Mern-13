import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const statuses = ["draft", "sent", "paid", "overdue"];
const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, trim: true, uppercase: true, match: /^[A-Z0-9-]{3,24}$/ },
  client: { type: String, required: true, trim: true, maxlength: 80 },
  amount: { type: Number, required: true, min: 0.01 },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: statuses, default: "draft" },
  notes: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true });

const Invoice = mongoose.model("Invoice", invoiceSchema);
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "50kb" }));

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function invoicePayload(body, partial = false) {
  const data = {};
  const errors = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (!partial || has("invoiceNumber")) {
    const value = String(body.invoiceNumber || "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,24}$/.test(value)) errors.invoiceNumber = "Use 3-24 letters, numbers, or hyphens";
    else data.invoiceNumber = value;
  }
  if (!partial || has("client")) {
    const value = String(body.client || "").trim();
    if (!value || value.length > 80) errors.client = "Client is required and must be at most 80 characters";
    else data.client = value;
  }
  if (!partial || has("amount")) {
    const value = Number(body.amount);
    if (!Number.isFinite(value) || value <= 0) errors.amount = "Amount must be greater than zero";
    else data.amount = Math.round(value * 100) / 100;
  }
  if (!partial || has("dueDate")) {
    const value = new Date(body.dueDate);
    if (!body.dueDate || Number.isNaN(value.getTime())) errors.dueDate = "A valid due date is required";
    else data.dueDate = value;
  }
  if (!partial || has("status")) {
    if (!statuses.includes(body.status)) errors.status = `Status must be one of: ${statuses.join(", ")}`;
    else data.status = body.status;
  }
  if (!partial || has("notes")) {
    const value = String(body.notes || "").trim();
    if (value.length > 500) errors.notes = "Notes must be at most 500 characters";
    else data.notes = value;
  }
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  if (partial && Object.keys(data).length === 0) throw new HttpError(400, "Provide at least one invoice field");
  return data;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/invoices/summary", async (_req, res, next) => {
  try {
    const invoices = await Invoice.find().select("amount status dueDate").lean();
    const now = Date.now();
    const summary = invoices.reduce((totals, invoice) => {
      totals.billed += invoice.amount;
      if (invoice.status === "paid") totals.collected += invoice.amount;
      else totals.outstanding += invoice.amount;
      if (invoice.status === "overdue" || (invoice.status !== "paid" && new Date(invoice.dueDate).getTime() < now)) totals.overdue += 1;
      return totals;
    }, { billed: 0, collected: 0, outstanding: 0, overdue: 0 });
    res.json(summary);
  } catch (error) { next(error); }
});

app.get("/api/invoices", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const q = String(req.query.q).trim().slice(0, 80);
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ client: pattern }, { invoiceNumber: pattern }];
    }
    res.json(await Invoice.find(filter).sort({ dueDate: 1, createdAt: -1 }).limit(200).lean());
  } catch (error) { next(error); }
});

app.post("/api/invoices", async (req, res, next) => {
  try { res.status(201).json(await Invoice.create(invoicePayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/invoices/:id", async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, invoicePayload(req.body, true), { new: true, runValidators: true });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    res.json(invoice);
  } catch (error) { next(error); }
});

app.delete("/api/invoices/:id", async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.path} not found`)));
app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ message: "Invoice number already exists" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid invoice ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/invoice_nest";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log(`InvoiceNest API listening on ${port}`)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });

