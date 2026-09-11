import mongoose from "mongoose";
export const CATEGORIES = ["Network", "Windows", "Linux", "Application", "Account", "Hardware", "Other"];
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 5, maxlength: 140 },
  problem: { type: String, required: true, trim: true, minlength: 10, maxlength: 1200 },
  symptoms: { type: [String], required: true, validate: value => value.length > 0 && value.length <= 12 },
  steps: { type: [String], required: true, validate: value => value.length > 0 && value.length <= 20 },
  category: { type: String, required: true, enum: CATEGORIES },
  platform: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  verified: { type: Boolean, default: false },
  helpfulCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });
schema.index({ category: 1, verified: 1, updatedAt: -1 });
export default mongoose.model("Article", schema);

