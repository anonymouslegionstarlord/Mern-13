import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const loanSchema = new mongoose.Schema({
  bookTitle: { type: String, required: true, trim: true, maxlength: 120 },
  borrower: { type: String, required: true, trim: true, maxlength: 80 },
  borrowerEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
  checkedOutAt: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ["active", "returned"], default: "active" },
  returnedAt: { type: Date, default: null },
}, { timestamps: true });

const Loan = mongoose.model("Loan", loanSchema);
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "40kb" }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

function loanPayload(body) {
  const data = {};
  const errors = {};
  data.bookTitle = String(body.bookTitle || "").trim();
  if (!data.bookTitle || data.bookTitle.length > 120) errors.bookTitle = "Book title is required and must be at most 120 characters";
  data.borrower = String(body.borrower || "").trim();
  if (!data.borrower || data.borrower.length > 80) errors.borrower = "Borrower is required and must be at most 80 characters";
  data.borrowerEmail = String(body.borrowerEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.borrowerEmail) || data.borrowerEmail.length > 120) errors.borrowerEmail = "Enter a valid borrower email";
  data.checkedOutAt = new Date(body.checkedOutAt);
  data.dueDate = new Date(body.dueDate);
  if (!body.checkedOutAt || Number.isNaN(data.checkedOutAt.getTime())) errors.checkedOutAt = "A valid checkout date is required";
  if (!body.dueDate || Number.isNaN(data.dueDate.getTime())) errors.dueDate = "A valid due date is required";
  if (!errors.checkedOutAt && !errors.dueDate && data.dueDate <= data.checkedOutAt) errors.dueDate = "Due date must be after the checkout date";
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  return data;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/loans/stats", async (_req, res, next) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const [active, overdue, returned, dueSoon] = await Promise.all([
      Loan.countDocuments({ status: "active" }),
      Loan.countDocuments({ status: "active", dueDate: { $lt: now } }),
      Loan.countDocuments({ status: "returned" }),
      Loan.countDocuments({ status: "active", dueDate: { $gte: now, $lte: soon } }),
    ]);
    res.json({ active, overdue, returned, dueSoon });
  } catch (error) { next(error); }
});

app.get("/api/loans", async (req, res, next) => {
  try {
    const filter = {};
    const now = new Date();
    if (req.query.status === "overdue") Object.assign(filter, { status: "active", dueDate: { $lt: now } });
    else if (["active", "returned"].includes(req.query.status)) filter.status = req.query.status;
    else if (req.query.status) throw new HttpError(400, "Unknown loan status filter");
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ bookTitle: pattern }, { borrower: pattern }, { borrowerEmail: pattern }];
    }
    res.json(await Loan.find(filter).sort({ status: 1, dueDate: 1, createdAt: -1 }).limit(250).lean());
  } catch (error) { next(error); }
});

app.post("/api/loans", async (req, res, next) => {
  try { res.status(201).json(await Loan.create(loanPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/loans/:id/return", async (req, res, next) => {
  try {
    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, status: "active" },
      { $set: { status: "returned", returnedAt: new Date() } },
      { new: true, runValidators: true },
    );
    if (!loan) {
      const exists = await Loan.exists({ _id: req.params.id });
      throw new HttpError(exists ? 409 : 404, exists ? "Book is already returned" : "Loan not found");
    }
    res.json(loan);
  } catch (error) { next(error); }
});

app.delete("/api/loans/:id", async (req, res, next) => {
  try {
    const loan = await Loan.findByIdAndDelete(req.params.id);
    if (!loan) throw new HttpError(404, "Loan not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.path} not found`)));
app.use((error, _req, res, _next) => {
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid loan ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/library_loop";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log(`LibraryLoop API listening on ${port}`)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });

