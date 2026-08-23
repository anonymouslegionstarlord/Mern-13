import { Router } from "express";
import Asset, { CONDITIONS, STATUSES, TYPES } from "../models/Asset.js";

const router = Router();
const supported = new Set(["name", "serialNumber", "type", "status", "condition", "assignedTo", "location", "warrantyUntil", "nextService", "notes"]);
function validate(body, partial = false) {
  const errors = [];
  if (!partial) ["name", "serialNumber", "type", "location"].forEach(key => { if (body[key] === undefined || body[key] === "") errors.push(`${key} is required`); });
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 100)) errors.push("name must contain 2 to 100 characters");
  if (body.serialNumber !== undefined && (typeof body.serialNumber !== "string" || !/^[A-Za-z0-9._/-]{3,60}$/.test(body.serialNumber.trim()))) errors.push("serialNumber must contain 3 to 60 letters, numbers, dots, underscores, slashes, or hyphens");
  if (body.type !== undefined && !TYPES.includes(body.type)) errors.push("invalid asset type");
  if (body.status !== undefined && !STATUSES.includes(body.status)) errors.push("invalid status");
  if (body.condition !== undefined && !CONDITIONS.includes(body.condition)) errors.push("invalid condition");
  if (body.location !== undefined && (typeof body.location !== "string" || body.location.trim().length < 2 || body.location.trim().length > 100)) errors.push("location must contain 2 to 100 characters");
  if (body.assignedTo !== undefined && (typeof body.assignedTo !== "string" || body.assignedTo.length > 100)) errors.push("assignedTo must be text up to 100 characters");
  if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 500)) errors.push("notes must be text up to 500 characters");
  for (const key of ["warrantyUntil", "nextService"]) if (body[key] && Number.isNaN(Date.parse(body[key]))) errors.push(`${key} must be a valid date`);
  if (body.status === "Assigned" && !String(body.assignedTo || "").trim()) errors.push("assignedTo is required when status is Assigned");
  return errors;
}

router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const [total, assigned, repair, expiredWarranty, serviceDue] = await Promise.all([
      Asset.countDocuments(), Asset.countDocuments({ status: "Assigned" }), Asset.countDocuments({ status: "Repair" }),
      Asset.countDocuments({ warrantyUntil: { $lt: now }, status: { $ne: "Retired" } }),
      Asset.countDocuments({ nextService: { $lte: now }, status: { $ne: "Retired" } })
    ]);
    res.json({ total, assigned, repair, expiredWarranty, serviceDue });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) { if (!STATUSES.includes(req.query.status)) return res.status(400).json({ message: "Invalid status filter" }); query.status = req.query.status; }
    if (req.query.type) { if (!TYPES.includes(req.query.type)) return res.status(400).json({ message: "Invalid type filter" }); query.type = req.query.type; }
    if (req.query.search) { const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80); query.$or = [{ name: new RegExp(safe, "i") }, { serialNumber: new RegExp(safe, "i") }, { assignedTo: new RegExp(safe, "i") }]; }
    res.json(await Asset.find(query).sort({ status: 1, nextService: 1, createdAt: -1 }).limit(250));
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => { try { const errors = validate(req.body); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors }); res.status(201).json(await Asset.create(req.body)); } catch (error) { next(error); } });
router.patch("/:id", async (req, res, next) => {
  try {
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => supported.has(key)));
    if (!Object.keys(changes).length) return res.status(400).json({ message: "No supported fields supplied" });
    const errors = validate(changes, true); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors });
    const asset = await Asset.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }); if (!asset) return res.status(404).json({ message: "Asset not found" }); res.json(asset);
  } catch (error) { next(error); }
});
router.delete("/:id", async (req, res, next) => { try { const asset = await Asset.findByIdAndDelete(req.params.id); if (!asset) return res.status(404).json({ message: "Asset not found" }); res.status(204).end(); } catch (error) { next(error); } });
export default router;

