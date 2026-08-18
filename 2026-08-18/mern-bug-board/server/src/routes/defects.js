import { Router } from "express";
import Defect from "../models/Defect.js";

const router = Router();
const severities = ["Low", "Medium", "High", "Critical"];
const statuses = ["Open", "In Progress", "Ready for Retest", "Resolved", "Closed"];

function normalizeSteps(value) {
  return Array.isArray(value) ? value.map((step) => String(step).trim()).filter(Boolean) : [];
}

function validate(body, partial = false) {
  const errors = [];
  const textRules = { title: 5, module: 2, expected: 3, actual: 3 };
  for (const [field, minimum] of Object.entries(textRules)) {
    if (!partial || body[field] !== undefined) {
      if (typeof body[field] !== "string" || body[field].trim().length < minimum) errors.push(`${field} is too short`);
    }
  }
  if (!partial || body.steps !== undefined) {
    if (!normalizeSteps(body.steps).length) errors.push("Add at least one reproduction step");
  }
  if (body.severity !== undefined && !severities.includes(body.severity)) errors.push("Unsupported severity");
  if (body.status !== undefined && !statuses.includes(body.status)) errors.push("Unsupported status");
  return errors;
}

router.get("/stats", async (req, res, next) => {
  try {
    const [total, open, critical, resolved] = await Promise.all([
      Defect.countDocuments(),
      Defect.countDocuments({ status: { $in: ["Open", "In Progress", "Ready for Retest"] } }),
      Defect.countDocuments({ severity: "Critical", status: { $ne: "Closed" } }),
      Defect.countDocuments({ status: { $in: ["Resolved", "Closed"] } }),
    ]);
    return res.json({ total, open, critical, resolved });
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
    if (req.query.severity) {
      if (!severities.includes(req.query.severity)) return res.status(400).json({ message: "Unsupported severity" });
      filter.severity = req.query.severity;
    }
    return res.json(await Defect.find(filter).sort({ createdAt: -1 }));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ message: "Invalid defect", details: errors });
    const defect = await Defect.create({
      title: req.body.title.trim(),
      module: req.body.module.trim(),
      severity: req.body.severity || "Medium",
      status: req.body.status || "Open",
      steps: normalizeSteps(req.body.steps),
      expected: req.body.expected.trim(),
      actual: req.body.actual.trim(),
    });
    return res.status(201).json(defect);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const errors = validate(req.body, true);
    if (errors.length) return res.status(400).json({ message: "Invalid defect", details: errors });
    const allowed = ["title", "module", "severity", "status", "steps", "expected", "actual"];
    const updates = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    if (updates.steps) updates.steps = normalizeSteps(updates.steps);
    const defect = await Defect.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!defect) return res.status(404).json({ message: "Defect not found" });
    return res.json(defect);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const defect = await Defect.findByIdAndDelete(req.params.id);
    if (!defect) return res.status(404).json({ message: "Defect not found" });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;

