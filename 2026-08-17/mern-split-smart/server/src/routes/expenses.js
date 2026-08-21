import { Router } from "express";
import Expense from "../models/Expense.js";

const router = Router();
const categories = ["Food", "Travel", "Home", "Entertainment", "Other"];

function normalizeNames(values) {
  return Array.isArray(values) ? values.map((value) => String(value).trim()).filter(Boolean) : [];
}

function validateExpense(body, partial = false) {
  const errors = [];
  if (!partial || body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.trim().length < 2) errors.push("Description is too short");
  }
  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) errors.push("Amount must be between 0.01 and 10000000");
  }
  if (!partial || body.paidBy !== undefined) {
    if (typeof body.paidBy !== "string" || body.paidBy.trim().length < 2) errors.push("Payer name is too short");
  }
  if (!partial || body.participants !== undefined) {
    const names = normalizeNames(body.participants);
    if (!names.length) errors.push("Add at least one participant");
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) errors.push("Participant names must be unique");
  }
  if (body.category !== undefined && !categories.includes(body.category)) errors.push("Unsupported category");
  return errors;
}

router.get("/summary/balances", async (req, res, next) => {
  try {
    const expenses = await Expense.find();
    const balances = new Map();
    for (const expense of expenses) {
      const share = expense.amount / expense.participants.length;
      balances.set(expense.paidBy, (balances.get(expense.paidBy) || 0) + expense.amount);
      for (const person of expense.participants) balances.set(person, (balances.get(person) || 0) - share);
    }
    const result = [...balances.entries()]
      .map(([name, balance]) => ({ name, balance: Number(balance.toFixed(2)) }))
      .sort((a, b) => b.balance - a.balance);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = req.query.category ? { category: req.query.category } : {};
    if (req.query.category && !categories.includes(req.query.category)) return res.status(400).json({ message: "Unsupported category" });
    return res.json(await Expense.find(filter).sort({ spentOn: -1, createdAt: -1 }));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validateExpense(req.body);
    if (errors.length) return res.status(400).json({ message: "Invalid expense", details: errors });
    const expense = await Expense.create({
      description: req.body.description.trim(),
      amount: Number(req.body.amount),
      paidBy: req.body.paidBy.trim(),
      participants: normalizeNames(req.body.participants),
      category: req.body.category || "Other",
      spentOn: req.body.spentOn || new Date(),
    });
    return res.status(201).json(expense);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const errors = validateExpense(req.body, true);
    if (errors.length) return res.status(400).json({ message: "Invalid expense", details: errors });
    const allowed = ["description", "amount", "paidBy", "participants", "category", "spentOn"];
    const updates = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    if (updates.participants) updates.participants = normalizeNames(updates.participants);
    const expense = await Expense.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    return res.json(expense);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;

