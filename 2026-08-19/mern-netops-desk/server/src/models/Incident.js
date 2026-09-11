import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    site: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    device: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    category: {
      type: String,
      required: true,
      enum: ["LAN", "WAN", "Wireless", "DNS", "VPN", "Firewall", "Other"],
      index: true,
    },
    priority: { type: String, enum: ["P1", "P2", "P3", "P4"], default: "P3", index: true },
    status: {
      type: String,
      enum: ["Open", "Investigating", "Monitoring", "Resolved", "Closed"],
      default: "Open",
      index: true,
    },
    owner: { type: String, trim: true, maxlength: 60, default: "Unassigned" },
    symptoms: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
    resolution: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Incident", incidentSchema);

