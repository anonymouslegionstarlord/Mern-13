import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    amount: { type: Number, required: true, min: 0.01, max: 10000000 },
    paidBy: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    participants: {
      type: [{ type: String, trim: true, minlength: 2, maxlength: 40 }],
      validate: {
        validator: (values) => values.length > 0 && new Set(values.map((value) => value.toLowerCase())).size === values.length,
        message: "Participants must contain at least one unique name",
      },
    },
    category: {
      type: String,
      enum: ["Food", "Travel", "Home", "Entertainment", "Other"],
      default: "Other",
    },
    spentOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);

