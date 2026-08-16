import mongoose from "mongoose";

const habitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    category: {
      type: String,
      required: true,
      enum: ["Health", "Learning", "Work", "Mindfulness", "Other"],
    },
    targetDays: { type: Number, min: 1, max: 7, default: 7 },
    completedDates: { type: [Date], default: [] },
  },
  { timestamps: true }
);

habitSchema.virtual("totalCompletions").get(function () {
  return this.completedDates.length;
});

habitSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Habit", habitSchema);

