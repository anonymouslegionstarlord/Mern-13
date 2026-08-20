import { Router } from "express";
import Application from "../models/Application.js";

const router = Router();
const statuses = ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
const sources = ["Company Website", "LinkedIn", "Naukri", "Referral", "Campus", "Other"];

function validDate(value) {
  return value === null || value === "" || !Number.isNaN(Date.parse(value));
}

function validate(body, partial = false) {
  const errors = [];
  for (const field of ["company", "role"]) {
    if (!partial || body[field] !== undefined) {
      if (typeof body[field] !== "string" || body[field].trim().length < 2) errors.push(`${field} must contain at least 2 characters`);
    }
  }
  if (body.status !== undefined && !statuses.includes(body.status)) errors.push("Unsupported status");
  if (body.source !== undefined && !sources.includes(body.source)) errors.push("Unsupported source");
  if (body.appliedOn !== undefined && !validDate(body.appliedOn)) errors.push("Invalid application date");
  if (body.nextActionAt !== undefined && !validDate(body.nextActionAt)) errors.push("Invalid next-action date");
  if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 1500)) errors.push("Notes must be 1500 characters or fewer");
  return errors;
}

router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const [total, active, interviews, offers, overdue] = await Promise.all([
      Application.countDocuments(),
      Application.countDocuments({ status: { $in: ["Applied", "Assessment", "Interview"] } }),
      Application.countDocuments({ status: "Interview" }),
      Application.countDocuments({ status: "Offer" }),
      Application.countDocuments({ nextActionAt: { $lt: now }, status: { $in: ["Saved", "Applied", "Assessment", "Interview"] } }),
    ]);
    return res.json({ total, active, interviews, offers, overdue });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) return res.status(400).json({ message: "Unsupported status" });
      filter.status = req.query.status;
    }
    if (req.query.search) {
      const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80);
      filter.$or = [{ company: new RegExp(safe, "i") }, { role: new RegExp(safe, "i") }, { location: new RegExp(safe, "i") }];
    }
    return res.json(await Application.find(filter).sort({ nextActionAt: 1, createdAt: -1 }));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ message: "Invalid application", details: errors });
    const application = await Application.create({
      company: req.body.company.trim(),
      role: req.body.role.trim(),
      location: req.body.location?.trim() || "Not specified",
      source: req.body.source || "Company Website",
      status: req.body.status || "Applied",
      appliedOn: req.body.appliedOn || new Date(),
      nextActionAt: req.body.nextActionAt || null,
      notes: req.body.notes?.trim() || "",
    });
    return res.status(201).json(application);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const errors = validate(req.body, true);
    if (errors.length) return res.status(400).json({ message: "Invalid application", details: errors });
    const allowed = ["company", "role", "location", "source", "status", "appliedOn", "nextActionAt", "notes"];
    const updates = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key] === "" && key === "nextActionAt" ? null : req.body[key]]));
    const application = await Application.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!application) return res.status(404).json({ message: "Application not found" });
    return res.json(application);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;

