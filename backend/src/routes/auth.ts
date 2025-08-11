import { Router } from "express";
import { AuthService } from "../services/auth";
import { requireAuth, AuthRequest } from "../middleware/auth";
import {
  spotifyLoginLimiter,
  tokenRefreshLimiter,
  authEndpointsLimiter,
  userSpecificLimiter,
} from "../middleware/rateLimit";

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

export default router;
