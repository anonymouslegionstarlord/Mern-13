import mongoose from "mongoose";

const defectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    module: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Ready for Retest", "Resolved", "Closed"],
      default: "Open",
      index: true,
    },
    steps: {
      type: [{ type: String, trim: true, minlength: 2, maxlength: 300 }],
      validate: { validator: (steps) => steps.length > 0, message: "Add at least one reproduction step" },
    },
    expected: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    actual: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  },
  { timestamps: true }
);

export default mongoose.model("Defect", defectSchema);

