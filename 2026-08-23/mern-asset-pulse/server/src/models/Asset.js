import mongoose from "mongoose";

export const TYPES = ["Laptop", "Desktop", "Monitor", "Phone", "Router", "Printer", "Other"];
export const STATUSES = ["Available", "Assigned", "Repair", "Retired"];
export const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];

const assetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  serialNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 3, maxlength: 60 },
  type: { type: String, required: true, enum: TYPES },
  status: { type: String, required: true, enum: STATUSES, default: "Available" },
  condition: { type: String, required: true, enum: CONDITIONS, default: "Good" },
  assignedTo: { type: String, trim: true, maxlength: 100, default: "" },
  location: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  warrantyUntil: { type: Date },
  nextService: { type: Date },
  notes: { type: String, trim: true, maxlength: 500, default: "" }
}, { timestamps: true });

assetSchema.index({ status: 1, type: 1 });
export default mongoose.model("Asset", assetSchema);

