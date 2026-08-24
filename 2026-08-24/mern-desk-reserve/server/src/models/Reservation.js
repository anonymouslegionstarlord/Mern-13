import mongoose from "mongoose";
export const ZONES = ["Quiet", "Collaboration", "Window", "Standing"];
export const STATUSES = ["Confirmed", "Cancelled"];
const schema = new mongoose.Schema({
  employee: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
  desk: { type: String, required: true, uppercase: true, trim: true, minlength: 2, maxlength: 20 },
  zone: { type: String, required: true, enum: ZONES },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  purpose: { type: String, trim: true, maxlength: 200, default: "" },
  status: { type: String, enum: STATUSES, default: "Confirmed" }
}, { timestamps: true });
schema.index({ desk: 1, date: 1, status: 1, startTime: 1, endTime: 1 });
export default mongoose.model("Reservation", schema);

