import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import { errorHandler, notFound } from "./middleware/errors.js";
import expenseRoutes from "./routes/expenses.js";

dotenv.config();
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "30kb" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/expenses", expenseRoutes);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/split_smart")
  .then(() => app.listen(port, () => console.log(`SplitSmart API listening on ${port}`)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

