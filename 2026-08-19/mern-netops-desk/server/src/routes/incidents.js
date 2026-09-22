import { Router } from "express";
import Incident from "../models/Incident.js";

const router = Router();
const categories = ["LAN", "WAN", "Wireless", "DNS", "VPN", "Firewall", "Other"];
const priorities = ["P1", "P2", "P3", "P4"];
const statuses = ["Open", "Investigating", "Monitoring", "Resolved", "Closed"];

function validate(body, partial = false) {
  const errors = [];
  const requiredText = { title: 5, site: 2, device: 2, symptoms: 5 };
  for (const [field, minimum] of Object.entries(requiredText)) {
    if (!partial || body[field] !== undefined) {
      if (typeof body[field] !== "string" || body[field].trim().length < minimum) errors.push(`${field} is too short`);
    }
  }
  if (!partial || body.category !== undefined) {
    if (!categories.includes(body.category)) errors.push("Unsupported category");
  }
  if (body.priority !== undefined && !priorities.includes(body.priority)) errors.push("Unsupported priority");
  if (body.status !== undefined && !statuses.includes(body.status)) errors.push("Unsupported status");
  if (body.owner !== undefined && (typeof body.owner !== "string" || body.owner.trim().length > 60)) errors.push("Owner must be 60 characters or fewer");
  if (body.resolution !== undefined && (typeof body.resolution !== "string" || body.resolution.trim().length > 1000)) errors.push("Resolution must be 1000 characters or fewer");
  if (["Resolved", "Closed"].includes(body.status) && (!body.resolution || body.resolution.trim().length < 5)) errors.push("Resolution notes are required when resolving an incident");
  return errors;
}

router.get("/stats", async (req, res, next) => {
  try {
    const [total, active, critical, resolved] = await Promise.all([
      Incident.countDocuments(),
      Incident.countDocuments({ status: { $in: ["Open", "Investigating", "Monitoring"] } }),
      Incident.countDocuments({ priority: "P1", status: { $nin: ["Resolved", "Closed"] } }),
      Incident.countDocuments({ status: { $in: ["Resolved", "Closed"] } }),
    ]);
    return res.json({ total, active, critical, resolved });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    for (const [field, allowed] of [["status", statuses], ["priority", priorities], ["category", categories]]) {
      if (req.query[field]) {
        if (!allowed.includes(req.query[field])) return res.status(400).json({ message: `Unsupported ${field}` });
        filter[field] = req.query[field];
      }
    }
    return res.json(await Incident.find(filter).sort({ priority: 1, createdAt: -1 }));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ message: "Invalid incident", details: errors });
    const incident = await Incident.create({
      title: req.body.title.trim(),
      site: req.body.site.trim(),
      device: req.body.device.trim(),
      category: req.body.category,
      priority: req.body.priority || "P3",
      status: req.body.status || "Open",
      owner: req.body.owner?.trim() || "Unassigned",
      symptoms: req.body.symptoms.trim(),
      resolution: req.body.resolution?.trim() || "",
    });
    return res.status(201).json(incident);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const current = await Incident.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Incident not found" });
    const merged = { ...current.toObject(), ...req.body };
    const errors = validate(merged);
    if (errors.length) return res.status(400).json({ message: "Invalid incident", details: errors });
    const allowed = ["title", "site", "device", "category", "priority", "status", "owner", "symptoms", "resolution"];
    for (const field of allowed) if (req.body[field] !== undefined) current[field] = req.body[field];
    await current.save();
    return res.json(current);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const incident = await Incident.findByIdAndDelete(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;

