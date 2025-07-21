import { Router } from "express";
import { SpotifyService } from "../services/spotify";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { userSpecificLimiter } from "../middleware/rateLimit";

const router = Router();

// Search tracks with enhanced functionality
router.get(
  "/search",
  userSpecificLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const {
        q,
        limit = "20",
        offset = "0",
        type = "track",
        market = "US",
      } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          error: "Query parameter 'q' is required and must be a string",
        });
      }

      // Validate and parse numeric parameters
      const parsedLimit = Math.min(
        Math.max(parseInt(limit as string) || 20, 1),
        50
      );
      const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);

      // Check if user has a valid Spotify access token
      if (!req.user?.spotifyAccessToken) {
        return res.status(401).json({
          error:
            "Spotify access token not available. Please re-authenticate with Spotify.",
          code: "NO_SPOTIFY_TOKEN",
        });
      }

      const spotifyService = new SpotifyService(req.user.spotifyAccessToken);
      const tracks = await spotifyService.searchTracks(
        q,
        parsedLimit,
        parsedOffset,
        type as string,
        market as string
      );

      res.json({
        data: tracks,
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          total: tracks.length,
        },
      });
    } catch (error) {
      console.error("Search error:", error);

      // Handle specific Spotify API errors
      if (error instanceof Error) {
        if (error.message.includes("rate limit")) {
          return res.status(429).json({
            error: "Rate limit exceeded. Please try again later.",
            code: "RATE_LIMIT_EXCEEDED",
          });
        }
        if (error.message.includes("invalid")) {
          return res.status(400).json({
            error: "Invalid search query",
            code: "INVALID_QUERY",
          });
        }
      }

      res.status(500).json({
        error: "Failed to search tracks",
        code: "SEARCH_FAILED",
      });
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

      if (!id) {
        return res.status(400).json({
          error: "Track ID is required",
          code: "MISSING_TRACK_ID",
        });
      }

      // Check if user has a valid Spotify access token
      if (!req.user?.spotifyAccessToken) {
        return res.status(401).json({
          error:
            "Spotify access token not available. Please re-authenticate with Spotify.",
          code: "NO_SPOTIFY_TOKEN",
        });
      }

      const spotifyService = new SpotifyService(req.user.spotifyAccessToken);
      const track = await spotifyService.getTrack(id);

      res.json({ data: track });
    } catch (error) {
      console.error("Get track error:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({
            error: "Track not found",
            code: "TRACK_NOT_FOUND",
          });
        }
      }

      res.status(500).json({
        error: "Failed to get track",
        code: "TRACK_FETCH_FAILED",
      });
    }
  }
);

// Get multiple tracks by IDs
router.get(
  "/tracks",
  userSpecificLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { ids } = req.query;

      if (!ids || typeof ids !== "string") {
        return res.status(400).json({
          error: "Track IDs parameter 'ids' is required (comma-separated)",
          code: "MISSING_TRACK_IDS",
        });
      }

      const trackIds = ids
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id);

      if (trackIds.length === 0) {
        return res.status(400).json({
          error: "At least one valid track ID is required",
          code: "NO_VALID_TRACK_IDS",
        });
      }

      if (trackIds.length > 50) {
        return res.status(400).json({
          error: "Maximum 50 track IDs allowed per request",
          code: "TOO_MANY_TRACK_IDS",
        });
      }

      // Check if user has a valid Spotify access token
      if (!req.user?.spotifyAccessToken) {
        return res.status(401).json({
          error:
            "Spotify access token not available. Please re-authenticate with Spotify.",
          code: "NO_SPOTIFY_TOKEN",
        });
      }

      const spotifyService = new SpotifyService(req.user.spotifyAccessToken);
      const tracks = await spotifyService.getTracks(trackIds);

      res.json({ data: tracks });
    } catch (error) {
      console.error("Get tracks error:", error);
      res.status(500).json({
        error: "Failed to get tracks",
        code: "TRACKS_FETCH_FAILED",
      });
    }
  }
);

export default router;
