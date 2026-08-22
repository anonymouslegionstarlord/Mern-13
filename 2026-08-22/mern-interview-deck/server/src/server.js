import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import cards from "./routes/cards.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/cards", cards); app.use(notFound); app.use(errorHandler);
const port = Number(process.env.PORT || 5000); const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI is required"); process.exit(1); }
mongoose.connect(uri).then(() => app.listen(port, () => console.log(`InterviewDeck API listening on ${port}`))).catch(error => { console.error("MongoDB connection failed:", error.message); process.exit(1); });

