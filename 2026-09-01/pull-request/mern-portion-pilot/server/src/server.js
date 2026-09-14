import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const categories = ["breakfast", "main", "bakery", "beverage", "snack", "other"];
const statuses = ["draft", "tested", "favorite"];
const units = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "piece"];

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  quantity: { type: Number, required: true, min: 0.01, max: 100000 },
  unit: { type: String, required: true, enum: units },
}, { _id: false });

const recipeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 100 },
  category: { type: String, required: true, enum: categories },
  baseServings: { type: Number, required: true, min: 1, max: 500 },
  prepMinutes: { type: Number, required: true, min: 1, max: 1440 },
  batchCost: { type: Number, required: true, min: 0, max: 1000000 },
  ingredients: { type: [ingredientSchema], required: true, validate: [(value) => value.length >= 1 && value.length <= 20, "Use 1-20 ingredients"] },
  notes: { type: String, required: true, trim: true, minlength: 5, maxlength: 400 },
  status: { type: String, enum: statuses, default: "draft" },
}, { timestamps: true });

recipeSchema.index({ category: 1, status: 1, createdAt: -1 });
const Recipe = mongoose.model("Recipe", recipeSchema);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "64kb" }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

function boundedNumber(value, minimum, maximum, integer, label, errors) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum || (integer && !Number.isInteger(number))) {
    errors[label] = label + " must be " + (integer ? "a whole number" : "a number") + " from " + minimum + " to " + maximum;
  }
  return number;
}

function createPayload(body = {}) {
  const data = {};
  const errors = {};
  data.name = String(body.name || "").trim();
  if (data.name.length < 3 || data.name.length > 100) errors.name = "Name must contain 3-100 characters";
  if (!categories.includes(body.category)) errors.category = "Choose a supported category";
  else data.category = body.category;
  data.baseServings = boundedNumber(body.baseServings, 1, 500, true, "baseServings", errors);
  data.prepMinutes = boundedNumber(body.prepMinutes, 1, 1440, true, "prepMinutes", errors);
  data.batchCost = boundedNumber(body.batchCost, 0, 1000000, false, "batchCost", errors);
  data.notes = String(body.notes || "").trim();
  if (data.notes.length < 5 || data.notes.length > 400) errors.notes = "Notes must contain 5-400 characters";

  if (!Array.isArray(body.ingredients) || body.ingredients.length < 1 || body.ingredients.length > 20) {
    errors.ingredients = "Provide 1-20 ingredients";
    data.ingredients = [];
  } else {
    data.ingredients = body.ingredients.map((ingredient, index) => {
      const name = String(ingredient?.name || "").trim();
      const quantity = Number(ingredient?.quantity);
      const unit = String(ingredient?.unit || "");
      if (name.length < 2 || name.length > 80) errors["ingredient" + index + "Name"] = "Ingredient names must contain 2-80 characters";
      if (!Number.isFinite(quantity) || quantity < 0.01 || quantity > 100000) errors["ingredient" + index + "Quantity"] = "Ingredient quantities must be from 0.01 to 100000";
      if (!units.includes(unit)) errors["ingredient" + index + "Unit"] = "Choose a supported ingredient unit";
      return { name, quantity, unit };
    });
  }
  if (Object.keys(errors).length) throw new HttpError(400, "Validation failed", errors);
  data.batchCost = Math.round(data.batchCost * 100) / 100;
  return data;
}

const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/recipes/stats", async (_req, res, next) => {
  try {
    const rows = await Recipe.find().select("baseServings batchCost status").lean();
    const costPerServing = rows.filter((row) => row.baseServings > 0).map((row) => row.batchCost / row.baseServings);
    res.json({
      total: rows.length,
      tested: rows.filter((row) => row.status === "tested").length,
      favorites: rows.filter((row) => row.status === "favorite").length,
      averageCostPerServing: costPerServing.length ? Math.round(costPerServing.reduce((sum, value) => sum + value, 0) / costPerServing.length * 100) / 100 : 0,
    });
  } catch (error) { next(error); }
});

app.get("/api/recipes", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) {
      if (!categories.includes(req.query.category)) throw new HttpError(400, "Unknown category filter");
      filter.category = req.query.category;
    }
    if (req.query.status) {
      if (!statuses.includes(req.query.status)) throw new HttpError(400, "Unknown status filter");
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const pattern = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), "i");
      filter.$or = [{ name: pattern }, { notes: pattern }, { "ingredients.name": pattern }];
    }
    res.json(await Recipe.find(filter).sort({ createdAt: -1 }).limit(200).lean());
  } catch (error) { next(error); }
});

app.post("/api/recipes", async (req, res, next) => {
  try { res.status(201).json(await Recipe.create(createPayload(req.body))); }
  catch (error) { next(error); }
});

app.patch("/api/recipes/:id/status", async (req, res, next) => {
  try {
    if (!statuses.includes(req.body?.status)) throw new HttpError(400, "Status must be one of: " + statuses.join(", "));
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!recipe) throw new HttpError(404, "Recipe not found");
    res.json(recipe);
  } catch (error) { next(error); }
});

app.delete("/api/recipes/:id", async (req, res, next) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!recipe) throw new HttpError(404, "Recipe not found");
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((req, _res, next) => next(new HttpError(404, "Route " + req.method + " " + req.path + " not found")));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: "Request body must be valid JSON" });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid recipe ID" });
  if (error.code === 11000) return res.status(409).json({ message: "A recipe with that name already exists" });
  if (error.name === "ValidationError") return res.status(400).json({ message: "Validation failed", details: error.errors });
  const status = error.status || 500;
  return res.status(status).json({ message: status === 500 ? "Unexpected server error" : error.message, details: error.details });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/portion_pilot";
mongoose.connect(mongoUri)
  .then(() => app.listen(port, () => console.log("PortionPilot API listening on " + port)))
  .catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
