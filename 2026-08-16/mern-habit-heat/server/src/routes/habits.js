import { Router } from "express";
import Habit from "../models/Habit.js";

const router = Router();
const allowedCategories = ["Health", "Learning", "Work", "Mindfulness", "Other"];

function validateBody(body, partial = false) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length < 2) {
      errors.push("Name must contain at least 2 characters");
    }
  }
  if (!partial || body.category !== undefined) {
    if (!allowedCategories.includes(body.category)) errors.push("Category is not supported");
  }
  if (body.targetDays !== undefined) {
    const target = Number(body.targetDays);
    if (!Number.isInteger(target) || target < 1 || target > 7) {
      errors.push("Target days must be an integer from 1 to 7");
    }
  }
  return errors;
}

router.get("/", async (req, res, next) => {
  try {
    const filter = req.query.category ? { category: req.query.category } : {};
    if (req.query.category && !allowedCategories.includes(req.query.category)) {
      return res.status(400).json({ message: "Category is not supported" });
    }
    const habits = await Habit.find(filter).sort({ createdAt: -1 });
    return res.json(habits);
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validateBody(req.body);
    if (errors.length) return res.status(400).json({ message: "Invalid habit", details: errors });
    const habit = await Habit.create({
      name: req.body.name.trim(),
      category: req.body.category,
      targetDays: Number(req.body.targetDays ?? 7),
    });
    return res.status(201).json(habit);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const errors = validateBody(req.body, true);
    if (errors.length) return res.status(400).json({ message: "Invalid habit", details: errors });
    const updates = {};
    for (const field of ["name", "category", "targetDays"]) {
      if (req.body[field] !== undefined) updates[field] = field === "name" ? req.body[field].trim() : req.body[field];
    }
    const habit = await Habit.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!habit) return res.status(404).json({ message: "Habit not found" });
    return res.json(habit);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/complete", async (req, res, next) => {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) return res.status(404).json({ message: "Habit not found" });
    const today = new Date();
    const key = today.toISOString().slice(0, 10);
    const alreadyComplete = habit.completedDates.some((date) => date.toISOString().slice(0, 10) === key);
    if (alreadyComplete) return res.status(409).json({ message: "Habit is already complete for today" });
    habit.completedDates.push(today);
    await habit.save();
    return res.json(habit);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const habit = await Habit.findByIdAndDelete(req.params.id);
    if (!habit) return res.status(404).json({ message: "Habit not found" });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;

