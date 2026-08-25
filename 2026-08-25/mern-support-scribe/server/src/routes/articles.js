import { Router } from "express"; import Article, { CATEGORIES } from "../models/Article.js";
const router = Router(), fields = new Set(["title", "problem", "symptoms", "steps", "category", "platform", "verified"]);
function cleanList(value) { return Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : value; }
function validate(body, partial = false) {
  const errors = [];
  if (!partial) ["title", "problem", "symptoms", "steps", "category", "platform"].forEach(key => { if (body[key] === undefined || body[key] === "") errors.push(`${key} is required`); });
  if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length < 5 || body.title.trim().length > 140)) errors.push("title must contain 5 to 140 characters");
  if (body.problem !== undefined && (typeof body.problem !== "string" || body.problem.trim().length < 10 || body.problem.trim().length > 1200)) errors.push("problem must contain 10 to 1200 characters");
  for (const [key, max, length] of [["symptoms", 12, 300], ["steps", 20, 500]]) if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].length < 1 || body[key].length > max || body[key].some(item => typeof item !== "string" || !item.trim() || item.length > length))) errors.push(`${key} must contain 1 to ${max} valid text items`);
  if (body.category !== undefined && !CATEGORIES.includes(body.category)) errors.push("invalid category");
  if (body.platform !== undefined && (typeof body.platform !== "string" || body.platform.trim().length < 2 || body.platform.length > 80)) errors.push("platform must contain 2 to 80 characters");
  if (body.verified !== undefined && typeof body.verified !== "boolean") errors.push("verified must be boolean");
  return errors;
}
router.get("/stats", async (req, res, next) => { try { const [total, verified, votes, categories] = await Promise.all([Article.countDocuments(), Article.countDocuments({ verified: true }), Article.aggregate([{ $group: { _id: null, count: { $sum: "$helpfulCount" } } }]), Article.distinct("category")]); res.json({ total, verified, helpfulVotes: votes[0]?.count || 0, categoryCoverage: categories.length }); } catch (error) { next(error); } });
router.get("/", async (req, res, next) => {
  try { const query = {};
    if (req.query.category) { if (!CATEGORIES.includes(req.query.category)) return res.status(400).json({ message: "Invalid category filter" }); query.category = req.query.category; }
    if (req.query.verified === "true" || req.query.verified === "false") query.verified = req.query.verified === "true"; else if (req.query.verified) return res.status(400).json({ message: "verified must be true or false" });
    if (req.query.search) { const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100); query.$or = [{ title: new RegExp(safe, "i") }, { problem: new RegExp(safe, "i") }, { symptoms: new RegExp(safe, "i") }, { platform: new RegExp(safe, "i") }]; }
    res.json(await Article.find(query).sort({ verified: -1, helpfulCount: -1, updatedAt: -1 }).limit(200));
  } catch (error) { next(error); }
});
router.post("/", async (req, res, next) => { try { const body = { ...req.body, symptoms: cleanList(req.body.symptoms), steps: cleanList(req.body.steps) }; const errors = validate(body); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors }); res.status(201).json(await Article.create(body)); } catch (error) { next(error); } });
router.patch("/:id", async (req, res, next) => { try { const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.has(key))); if (changes.symptoms) changes.symptoms = cleanList(changes.symptoms); if (changes.steps) changes.steps = cleanList(changes.steps); if (!Object.keys(changes).length) return res.status(400).json({ message: "No supported fields supplied" }); const errors = validate(changes, true); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors }); const article = await Article.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }); if (!article) return res.status(404).json({ message: "Article not found" }); res.json(article); } catch (error) { next(error); } });
router.post("/:id/helpful", async (req, res, next) => { try { const article = await Article.findByIdAndUpdate(req.params.id, { $inc: { helpfulCount: 1 } }, { new: true }); if (!article) return res.status(404).json({ message: "Article not found" }); res.json(article); } catch (error) { next(error); } });
router.delete("/:id", async (req, res, next) => { try { const article = await Article.findByIdAndDelete(req.params.id); if (!article) return res.status(404).json({ message: "Article not found" }); res.status(204).end(); } catch (error) { next(error); } });
export default router;

