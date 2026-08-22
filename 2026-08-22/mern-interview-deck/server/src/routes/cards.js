import { Router } from "express";
import Card, { CONFIDENCE, TOPICS } from "../models/Card.js";

const router = Router();
const fields = new Set(["question", "answer", "topic", "confidence", "nextReview", "bookmarked"]);

function validate(body, partial = false) {
  const errors = [];
  if (!partial) ["question", "answer", "topic", "nextReview"].forEach(key => { if (body[key] === undefined || body[key] === "") errors.push(`${key} is required`); });
  if (body.question !== undefined && (typeof body.question !== "string" || body.question.trim().length < 5 || body.question.trim().length > 300)) errors.push("question must contain 5 to 300 characters");
  if (body.answer !== undefined && (typeof body.answer !== "string" || body.answer.trim().length < 10 || body.answer.trim().length > 2000)) errors.push("answer must contain 10 to 2000 characters");
  if (body.topic !== undefined && !TOPICS.includes(body.topic)) errors.push("invalid topic");
  if (body.confidence !== undefined && !CONFIDENCE.includes(body.confidence)) errors.push("invalid confidence");
  if (body.nextReview !== undefined && Number.isNaN(Date.parse(body.nextReview))) errors.push("nextReview must be a valid date");
  if (body.bookmarked !== undefined && typeof body.bookmarked !== "boolean") errors.push("bookmarked must be boolean");
  return errors;
}

router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const [total, due, weak, mastered, bookmarked] = await Promise.all([
      Card.countDocuments(), Card.countDocuments({ nextReview: { $lte: now } }),
      Card.countDocuments({ confidence: { $in: ["New", "Learning"] } }),
      Card.countDocuments({ confidence: "Mastered" }), Card.countDocuments({ bookmarked: true })
    ]);
    res.json({ total, due, weak, mastered, bookmarked });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const query = {};
    if (req.query.topic) { if (!TOPICS.includes(req.query.topic)) return res.status(400).json({ message: "Invalid topic filter" }); query.topic = req.query.topic; }
    if (req.query.confidence) { if (!CONFIDENCE.includes(req.query.confidence)) return res.status(400).json({ message: "Invalid confidence filter" }); query.confidence = req.query.confidence; }
    if (req.query.due === "true") query.nextReview = { $lte: new Date() };
    else if (req.query.due && req.query.due !== "false") return res.status(400).json({ message: "due must be true or false" });
    if (req.query.search) {
      const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
      query.$or = [{ question: new RegExp(safe, "i") }, { answer: new RegExp(safe, "i") }];
    }
    res.json(await Card.find(query).sort({ bookmarked: -1, nextReview: 1 }).limit(200));
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try { const errors = validate(req.body); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors }); res.status(201).json(await Card.create(req.body)); }
  catch (error) { next(error); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.has(key)));
    if (!Object.keys(changes).length) return res.status(400).json({ message: "No supported fields supplied" });
    const errors = validate(changes, true); if (errors.length) return res.status(400).json({ message: "Validation failed", details: errors });
    const card = await Card.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
    if (!card) return res.status(404).json({ message: "Card not found" }); res.json(card);
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try { const card = await Card.findByIdAndDelete(req.params.id); if (!card) return res.status(404).json({ message: "Card not found" }); res.status(204).end(); }
  catch (error) { next(error); }
});

export default router;

