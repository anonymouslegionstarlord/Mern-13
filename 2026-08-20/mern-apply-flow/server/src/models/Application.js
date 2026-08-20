import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    role: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    location: { type: String, trim: true, maxlength: 80, default: "Not specified" },
    source: {
      type: String,
      enum: ["Company Website", "LinkedIn", "Naukri", "Referral", "Campus", "Other"],
      default: "Company Website",
    },
    status: {
      type: String,
      enum: ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"],
      default: "Applied",
      index: true,
    },
    appliedOn: { type: Date, default: Date.now },
    nextActionAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 1500, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);

