import mongoose from "mongoose";

export const TOPICS = ["JavaScript", "React", "Node", "MongoDB", "Python", "SQL", "Networking", "QA", "HR", "Other"];
export const CONFIDENCE = ["New", "Learning", "Confident", "Mastered"];

const cardSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  answer: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  topic: { type: String, enum: TOPICS, required: true },
  confidence: { type: String, enum: CONFIDENCE, default: "New" },
  nextReview: { type: Date, required: true },
  bookmarked: { type: Boolean, default: false }
}, { timestamps: true });

cardSchema.index({ nextReview: 1, confidence: 1 });
export default mongoose.model("Card", cardSchema);

