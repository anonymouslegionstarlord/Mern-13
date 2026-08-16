import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import habitsRouter from "./routes/habits.js";
import { errorHandler, notFound } from "./middleware/error.js";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/habits", habitsRouter);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/habit_heat";

mongoose
  .connect(mongoUri)
  .then(() => app.listen(port, () => console.log(`HabitHeat API listening on ${port}`)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

