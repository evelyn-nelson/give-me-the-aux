import express from "express";
import cors from "cors";
import helmet from "helmet";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth";
import spotifyRoutes from "./routes/spotify";
import groupRoutes from "./routes/groups";
import roundRoutes from "./routes/rounds";
import submissionRoutes from "./routes/submissions";
import voteRoutes from "./routes/votes";
import messageRoutes from "./routes/messages";
import inviteRoutes from "./routes/invites";
import { TokenCleanupService } from "./services/tokenCleanup";
import { RoundManagementService } from "./services/roundManagement";

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
app.use("/api/groups", groupRoutes);
app.use("/api/rounds", roundRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/submissions", voteRoutes); // Mount votes under /api/submissions to maintain URL structure
app.use("/api/messages", messageRoutes);
app.use("/api/invites", inviteRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  TokenCleanupService.startCleanupJob();
  RoundManagementService.startManagementJob();
});
