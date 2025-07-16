import express from "express";
import cors from "cors";
import helmet from "helmet";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth";
import spotifyRoutes from "./routes/spotify";
import { TokenCleanupService } from "./services/tokenCleanup";

// Load environment variables
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: "../.env" });
}

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/spotify", spotifyRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start the token cleanup cron job
  TokenCleanupService.startCleanupJob();
});
