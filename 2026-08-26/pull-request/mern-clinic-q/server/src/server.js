import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const departments = ["General", "Dental", "Pediatrics", "Orthopedics", "Dermatology"];
const statuses = ["booked", "checked-in", "in-consultation", "completed", "cancelled", "no-show"];
const priorities = ["routine", "urgent"];
const transitions = {
  booked: ["checked-in", "cancelled", "no-show"],
  "checked-in": ["in-consultation", "cancelled", "no-show"],
  "in-consultation": ["completed"],
  completed: [], cancelled: [], "no-show": [],
};

const appointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true, trim: true, maxlength: 80 },
  department: { type: String, required: true, enum: departments },
  appointmentTime: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  priority: { type: String, enum: priorities, default: "routine" },
  status: { type: String, enum: statuses, default: "booked" },
  checkedInAt: { type: Date, default: null },
  consultationStartedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

const Appointment = mongoose.model("Appointment", appointmentSchema);
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "50kb" }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

function payload(body, partial = false) {
  const result = {};
  const errors = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  if (!partial || has("patientName")) {
    const value = String(body.patientName || "").trim();
    if (!value || value.length > 80) errors.patientName = "Patient name is required and must be at most 80 characters";
    else result.patientName = value;
  }
  if (!partial || has("department")) {
    if (!departments.includes(body.department)) errors.department = `Choose one of: ${departments.join(", ")}`;
    else result.department = body.department;
  }
  if (!partial || has("appointmentTime")) {
    const value = new Date(body.appointmentTime);
    if (!body.appointmentTime || Number.isNaN(value.getTime())) errors.appointmentTime = "A valid appointment time is required";
    else result.appointmentTime = value;
  }
  if (!partial || has("reason")) {
    const value = String(body.reason || "").trim();
    if (!value || value.length > 300) errors.reason = "Reason is required and must be at most 300 characters";
    else result.reason = value;
  }
  if (!partial || has("priority")) {
    if (!priorities.includes(body.priority)) errors.priority = "Priority must be routine or urgent";
    else result.priority = body.priority;
  }
  if (partial && has("status")) {
    if (!statuses.includes(body.status)) errors.status = "Unknown appointment status";
    else result.status = body.status;
  }
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  if (partial && Object.keys(result).length === 0) throw new HttpError(400, "Provide at least one appointment field");
  return result;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/appointments/stats", async (_req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [booked, waiting, consulting, completed] = await Promise.all([
      Appointment.countDocuments({ status: "booked" }),
      Appointment.countDocuments({ status: "checked-in" }),
      Appointment.countDocuments({ status: "in-consultation" }),
      Appointment.countDocuments({ status: "completed", completedAt: { $gte: today } }),
    ]);
    res.json({ booked, waiting, consulting, completed });
  } catch (error) { next(error); }
});

app.get("/api/appointments", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.department) {
      if (!departments.includes(req.query.department)) throw new HttpError(400, "Unknown department filter");
      filter.department = req.query.department;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 80)), "i");
      filter.$or = [{ patientName: pattern }, { reason: pattern }];
    }
    const items = await Appointment.find(filter).sort({ appointmentTime: 1, createdAt: 1 }).limit(200).lean();
    items.sort((left, right) => (left.priority === right.priority ? 0 : left.priority === "urgent" ? -1 : 1));
    res.json(items);
  } catch (error) { next(error); }
});

app.post("/api/appointments", async (req, res, next) => {
  try { res.status(201).json(await Appointment.create(payload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/appointments/:id", async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) throw new HttpError(404, "Appointment not found");
    const changes = payload(req.body, true);
    if (changes.status && changes.status !== appointment.status) {
      if (!transitions[appointment.status].includes(changes.status)) {
        throw new HttpError(409, `Cannot move from ${appointment.status} to ${changes.status}`);
      }
      const now = new Date();
      if (changes.status === "checked-in") changes.checkedInAt = now;
      if (changes.status === "in-consultation") changes.consultationStartedAt = now;
      if (changes.status === "completed") changes.completedAt = now;
    }
    Object.assign(appointment, changes);
    await appointment.save();
    res.json(appointment);
  } catch (error) { next(error); }
});

app.delete("/api/appointments/:id", async (req, res, next) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) throw new HttpError(404, "Appointment not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.path} not found`)));
app.use((error, _req, res, _next) => {
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid appointment ID" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/clinic_q";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log(`ClinicQ API listening on ${port}`)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });

