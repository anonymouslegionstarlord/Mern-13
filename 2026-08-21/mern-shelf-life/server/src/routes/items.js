import { Router } from "express";
import Item, { CATEGORIES, LOCATIONS, UNITS } from "../models/Item.js";

const router = Router();
const allowed = new Set(["name", "category", "quantity", "unit", "location", "purchaseDate", "expiryDate", "consumed"]);

function validate(body, partial = false) {
  const errors = [];
  const required = ["name", "category", "quantity", "unit", "location", "expiryDate"];
  if (!partial) required.forEach((key) => { if (body[key] === undefined || body[key] === "") errors.push(`${key} is required`); });
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 80)) errors.push("name must contain 2 to 80 characters");
  if (body.category !== undefined && !CATEGORIES.includes(body.category)) errors.push("invalid category");
  if (body.unit !== undefined && !UNITS.includes(body.unit)) errors.push("invalid unit");
  if (body.location !== undefined && !LOCATIONS.includes(body.location)) errors.push("invalid location");
  if (body.quantity !== undefined && (!Number.isFinite(Number(body.quantity)) || Number(body.quantity) <= 0 || Number(body.quantity) > 10000)) errors.push("quantity must be between 0.01 and 10000");
  for (const key of ["purchaseDate", "expiryDate"]) if (body[key] && Number.isNaN(Date.parse(body[key]))) errors.push(`${key} must be a valid date`);
  if (body.consumed !== undefined && typeof body.consumed !== "boolean") errors.push("consumed must be boolean");
  return errors;
}

router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const soon = new Date(now); soon.setDate(soon.getDate() + 7);
    const [total, available, consumed, expired, expiringSoon] = await Promise.all([
      Item.countDocuments(), Item.countDocuments({ consumed: false }), Item.countDocuments({ consumed: true }),
      Item.countDocuments({ consumed: false, expiryDate: { $lt: now } }),
      Item.countDocuments({ consumed: false, expiryDate: { $gte: now, $lte: soon } })
    ]);
    res.json({ total, available, expiringSoon, expired, consumed });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const query = {};
    if (req.query.category) {
      if (!CATEGORIES.includes(req.query.category)) return res.status(400).json({ message: "Invalid category filter" });
      query.category = req.query.category;
    }
    const now = new Date(); const soon = new Date(now); soon.setDate(soon.getDate() + 7);
    if (req.query.status === "available") query.consumed = false;
    else if (req.query.status === "consumed") query.consumed = true;
    else if (req.query.status === "expired") Object.assign(query, { consumed: false, expiryDate: { $lt: now } });
    else if (req.query.status === "expiring") Object.assign(query, { consumed: false, expiryDate: { $gte: now, $lte: soon } });
    else if (req.query.status) return res.status(400).json({ message: "Invalid status filter" });
    if (req.query.search) {
      const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80);
      query.name = new RegExp(safe, "i");
    }
    res.json(await Item.find(query).sort({ consumed: 1, expiryDate: 1 }).limit(200));
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors });
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (error) { next(error); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.has(key)));
    if (!Object.keys(changes).length) return res.status(400).json({ message: "No supported fields supplied" });
    const errors = validate(changes, true);
    if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors });
    const item = await Item.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;

