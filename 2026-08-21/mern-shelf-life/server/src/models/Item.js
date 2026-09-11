import mongoose from "mongoose";

export const CATEGORIES = ["Produce", "Dairy", "Grains", "Snacks", "Frozen", "Other"];
export const UNITS = ["item", "g", "kg", "ml", "l", "pack"];
export const LOCATIONS = ["Pantry", "Fridge", "Freezer"];

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  category: { type: String, enum: CATEGORIES, required: true },
  quantity: { type: Number, required: true, min: 0.01, max: 10000 },
  unit: { type: String, enum: UNITS, required: true },
  location: { type: String, enum: LOCATIONS, required: true },
  purchaseDate: { type: Date },
  expiryDate: { type: Date, required: true },
  consumed: { type: Boolean, default: false }
}, { timestamps: true });

itemSchema.index({ expiryDate: 1, consumed: 1 });
export default mongoose.model("Item", itemSchema);

