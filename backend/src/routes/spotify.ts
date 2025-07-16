import { Router } from "express";
import { SpotifyService } from "../services/spotify";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { userSpecificLimiter } from "../middleware/rateLimit";

const router = Router();

// Search tracks
router.get(
  "/search",
  userSpecificLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { q, limit } = req.query;

      if (!q) {
        return res.status(400).json({ error: "Query parameter required" });
      }

      const spotifyService = new SpotifyService();
      const tracks = await spotifyService.searchTracks(
        q as string,
        limit ? parseInt(limit as string) : 20
      );

      res.json({ data: tracks });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Failed to search tracks" });
    }
  }
);

// Get track by ID
router.get(
  "/tracks/:id",
  userSpecificLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const spotifyService = new SpotifyService();
      const track = await spotifyService.getTrack(id);

      res.json({ data: track });
    } catch (error) {
      console.error("Get track error:", error);
      res.status(500).json({ error: "Failed to get track" });
    }
  }
);

export default router;
