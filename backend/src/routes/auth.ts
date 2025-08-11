import { Router } from "express";
import { AuthService } from "../services/auth";
import { requireAuth, AuthRequest } from "../middleware/auth";
import {
  spotifyLoginLimiter,
  tokenRefreshLimiter,
  authEndpointsLimiter,
  userSpecificLimiter,
} from "../middleware/rateLimit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const router = Router();

// Mobile OAuth - exchange code for user info
router.post("/spotify", spotifyLoginLimiter, async (req, res) => {
  try {
    const { code, redirectUri, codeVerifier } = req.body;

    // Debug logging
    console.log("Received OAuth request:", {
      code: code?.substring(0, 10) + "...",
      redirectUri,
      hasCodeVerifier: !!codeVerifier,
    });

    if (!code) {
      return res.status(400).json({ error: "Authorization code required" });
    }

    if (!codeVerifier) {
      return res.status(400).json({ error: "Code verifier required for PKCE" });
    }

    // Exchange code for access token using PKCE
    // Make direct HTTP request since spotify-web-api-node v5.0.2 doesn't handle PKCE properly
    const tokenUrl = "https://accounts.spotify.com/api/token";
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return res.status(400).json({ error: "Token exchange failed" });
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };
    const { access_token, refresh_token, expires_in } = tokenData;

    // Create Spotify API client to get user info
    const spotifyApi = AuthService.createSpotifyApi(redirectUri);

    // Set access token and get user info
    spotifyApi.setAccessToken(access_token);
    const userResponse = await spotifyApi.getMe();
    const spotifyUser = userResponse.body;

    if (!spotifyUser.id || !spotifyUser.email) {
      return res
        .status(400)
        .json({ error: "Failed to get user info from Spotify" });
    }

    // Enforce US-only access
    if (spotifyUser.country !== "US") {
      console.warn(
        "Region restricted login attempt:",
        spotifyUser.id,
        spotifyUser.country
      );
      return res.status(403).json({
        error: "Service is only available in the United States",
        code: "REGION_RESTRICTED",
      });
    }

    // Create or find user and store tokens
    const user = await AuthService.findOrCreateUser(
      {
        spotifyId: spotifyUser.id,
        email: spotifyUser.email,
        displayName: spotifyUser.display_name || spotifyUser.email,
        avatarUrl: spotifyUser.images?.[0]?.url,
        country: spotifyUser.country,
      },
      {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
      }
    );

    // Generate JWT and refresh token pair
    const tokenPair = await AuthService.generateTokenPair(user.id);

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      },
    });
  } catch (error) {
    console.error("Spotify OAuth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Get current user
router.get("/me", userSpecificLimiter, requireAuth, (req: AuthRequest, res) => {
  res.json({ data: req.user });
});

// Refresh access token using refresh token
router.post("/refresh", tokenRefreshLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const tokenPair = await AuthService.refreshAccessToken(refreshToken);

    if (!tokenPair) {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    res.json({
      data: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh tokens" });
  }
});

// Logout - revoke all refresh tokens for the user
router.post(
  "/logout",
  userSpecificLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      await AuthService.revokeAllUserRefreshTokens(req.user!.id);
      res.json({ data: { message: "Logged out successfully" } });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  }
);

// Delete current user and all their data
router.delete(
  "/me",
  userSpecificLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      await prisma.$transaction(async (tx) => {
        // 1. Delete groups where the user is admin, including related data
        const adminGroups = await tx.group.findMany({
          where: { adminId: userId },
          select: { id: true },
        });
        const adminGroupIds = adminGroups.map((g) => g.id);

        if (adminGroupIds.length > 0) {
          // Votes on submissions in those groups
          await tx.vote.deleteMany({
            where: {
              submission: {
                round: {
                  groupId: { in: adminGroupIds },
                },
              },
            },
          });

          // Submissions in those groups
          await tx.submission.deleteMany({
            where: {
              round: { groupId: { in: adminGroupIds } },
            },
          });

          // Rounds in those groups (NotificationEvents cascade on round)
          await tx.round.deleteMany({
            where: { groupId: { in: adminGroupIds } },
          });

          // Group messages
          await tx.message.deleteMany({
            where: { groupId: { in: adminGroupIds } },
          });

          // Group invites
          await tx.groupInvite.deleteMany({
            where: { groupId: { in: adminGroupIds } },
          });

          // Playlists tied to those groups (and their items)
          const groupPlaylists = await tx.playlist.findMany({
            where: { groupId: { in: adminGroupIds } },
            select: { id: true },
          });
          const groupPlaylistIds = groupPlaylists.map((p) => p.id);
          if (groupPlaylistIds.length > 0) {
            await tx.playlistItem.deleteMany({
              where: { playlistId: { in: groupPlaylistIds } },
            });
            await tx.playlist.deleteMany({
              where: { id: { in: groupPlaylistIds } },
            });
          }

          // Group memberships
          await tx.groupMember.deleteMany({
            where: { groupId: { in: adminGroupIds } },
          });

          // Finally delete groups
          await tx.group.deleteMany({ where: { id: { in: adminGroupIds } } });
        }

        // 2. Delete votes cast by the user
        await tx.vote.deleteMany({ where: { userId } });

        // 3. Delete votes on the user's submissions, then the submissions
        const userSubmissions = await tx.submission.findMany({
          where: { userId },
          select: { id: true },
        });
        const userSubmissionIds = userSubmissions.map((s) => s.id);
        if (userSubmissionIds.length > 0) {
          await tx.vote.deleteMany({
            where: { submissionId: { in: userSubmissionIds } },
          });
          await tx.submission.deleteMany({
            where: { id: { in: userSubmissionIds } },
          });
        }

        // 4. Remove user from other groups
        await tx.groupMember.deleteMany({ where: { userId } });

        // 5. Delete user's messages (any remaining)
        await tx.message.deleteMany({ where: { userId } });

        // 6. Delete invites created by the user
        await tx.groupInvite.deleteMany({ where: { createdByUserId: userId } });

        // 7. Delete user's playlists and items
        const userPlaylists = await tx.playlist.findMany({
          where: { userId },
          select: { id: true },
        });
        const userPlaylistIds = userPlaylists.map((p) => p.id);
        if (userPlaylistIds.length > 0) {
          await tx.playlistItem.deleteMany({
            where: { playlistId: { in: userPlaylistIds } },
          });
          await tx.playlist.deleteMany({
            where: { id: { in: userPlaylistIds } },
          });
        }

        // 8. Revoke push tokens and refresh tokens
        await tx.pushToken.deleteMany({ where: { userId } });
        await tx.refreshToken.deleteMany({ where: { userId } });

        // 9. Finally delete the user
        await tx.user.delete({ where: { id: userId } });
      });

      return res.json({ data: { message: "Account and data deleted" } });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ error: "Failed to delete account" });
    }
  }
);

export default router;
