import { Router } from "express";
import Reservation, { STATUSES, ZONES } from "../models/Reservation.js";
const router = Router(); const fields = new Set(["employee", "email", "desk", "zone", "date", "startTime", "endTime", "purpose", "status"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/, timePattern = /^([01]\d|2[0-3]):[0-5]\d$/, emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validate(body, partial = false) {
  const errors = [];
  if (!partial) ["employee", "email", "desk", "zone", "date", "startTime", "endTime"].forEach(key => { if (!body[key]) errors.push(`${key} is required`); });
  if (body.employee !== undefined && (typeof body.employee !== "string" || body.employee.trim().length < 2 || body.employee.trim().length > 80)) errors.push("employee must contain 2 to 80 characters");
  if (body.email !== undefined && (typeof body.email !== "string" || !emailPattern.test(body.email) || body.email.length > 120)) errors.push("email must be valid");
  if (body.desk !== undefined && (typeof body.desk !== "string" || !/^[A-Za-z0-9-]{2,20}$/.test(body.desk))) errors.push("desk must contain 2 to 20 letters, numbers, or hyphens");
  if (body.zone !== undefined && !ZONES.includes(body.zone)) errors.push("invalid zone");
  if (body.status !== undefined && !STATUSES.includes(body.status)) errors.push("invalid status");
  if (body.date !== undefined && (!datePattern.test(body.date) || Number.isNaN(Date.parse(`${body.date}T00:00:00Z`)))) errors.push("date must be valid YYYY-MM-DD");
  if (body.startTime !== undefined && !timePattern.test(body.startTime)) errors.push("startTime must be HH:MM");
  if (body.endTime !== undefined && !timePattern.test(body.endTime)) errors.push("endTime must be HH:MM");
  if (body.startTime && body.endTime && body.startTime >= body.endTime) errors.push("endTime must be after startTime");
  if (body.purpose !== undefined && (typeof body.purpose !== "string" || body.purpose.length > 200)) errors.push("purpose must be text up to 200 characters");
  return errors;
}
async function overlaps(body, excludeId) {
  if (body.status === "Cancelled") return false;
  const query = { desk: body.desk.toUpperCase(), date: body.date, status: "Confirmed", startTime: { $lt: body.endTime }, endTime: { $gt: body.startTime } };
  if (excludeId) query._id = { $ne: excludeId }; return Boolean(await Reservation.exists(query));
}
router.get("/stats", async (req, res, next) => { try { const today = new Date().toISOString().slice(0, 10); const [total, todayCount, upcoming, cancelled] = await Promise.all([Reservation.countDocuments(), Reservation.countDocuments({ date: today, status: "Confirmed" }), Reservation.countDocuments({ date: { $gt: today }, status: "Confirmed" }), Reservation.countDocuments({ status: "Cancelled" })]); res.json({ total, today: todayCount, upcoming, cancelled }); } catch (error) { next(error); } });
router.get("/", async (req, res, next) => {
  try { const query = {};
    if (req.query.date) { if (!datePattern.test(req.query.date)) return res.status(400).json({ message: "Invalid date filter" }); query.date = req.query.date; }
    if (req.query.zone) { if (!ZONES.includes(req.query.zone)) return res.status(400).json({ message: "Invalid zone filter" }); query.zone = req.query.zone; }
    if (req.query.status) { if (!STATUSES.includes(req.query.status)) return res.status(400).json({ message: "Invalid status filter" }); query.status = req.query.status; }
    if (req.query.search) { const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80); query.$or = [{ employee: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }, { desk: new RegExp(safe, "i") }]; }
    res.json(await Reservation.find(query).sort({ date: 1, startTime: 1 }).limit(250));
  } catch (error) { next(error); }
});
router.post("/", async (req, res, next) => { try { const errors = validate(req.body); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors }); if (await overlaps(req.body)) return res.status(409).json({ message: "This desk is already reserved during that time" }); res.status(201).json(await Reservation.create(req.body)); } catch (error) { next(error); } });
router.patch("/:id", async (req, res, next) => {
  try { const current = await Reservation.findById(req.params.id); if (!current) return res.status(404).json({ message: "Reservation not found" }); const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.has(key))); if (!Object.keys(changes).length) return res.status(400).json({ message: "No supported fields supplied" }); const merged = { ...current.toObject(), ...changes }; const errors = validate(merged); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors }); if (await overlaps(merged, current._id)) return res.status(409).json({ message: "This desk is already reserved during that time" }); Object.assign(current, changes); await current.save(); res.json(current); } catch (error) { next(error); }
});
router.delete("/:id", async (req, res, next) => { try { const item = await Reservation.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: "Reservation not found" }); res.status(204).end(); } catch (error) { next(error); } });
export default router;

