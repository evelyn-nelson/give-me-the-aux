import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import SpotifyWebApi from "spotify-web-api-node";
import crypto from "crypto";

const prisma = new PrismaClient();

export interface SpotifyUser {
  spotifyId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  country?: string;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface JWTPayload {
  userId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  static async findOrCreateUser(
    spotifyUser: SpotifyUser,
    tokens?: SpotifyTokens
  ) {
    let user = await prisma.user.findUnique({
      where: { spotifyId: spotifyUser.spotifyId },
    });

    const userData = {
      spotifyId: spotifyUser.spotifyId,
      email: spotifyUser.email,
      displayName: spotifyUser.displayName,
      avatarUrl: spotifyUser.avatarUrl,
      country: spotifyUser.country,
      ...(tokens && {
        spotifyAccessToken: tokens.accessToken,
        spotifyRefreshToken: tokens.refreshToken,
        spotifyTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
      }),
    };

    if (!user) {
      user = await prisma.user.create({
        data: userData,
      });
    } else {
      // Update user info and tokens
      user = await prisma.user.update({
        where: { id: user.id },
        data: userData,
      });
    }

    return user;
  }

  static async updateUserTokens(userId: string, tokens: SpotifyTokens) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        spotifyAccessToken: tokens.accessToken,
        spotifyRefreshToken: tokens.refreshToken,
        spotifyTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });
  }

  static async refreshSpotifyToken(
    refreshToken: string
  ): Promise<SpotifyTokens | null> {
    try {
      const tokenUrl = "https://accounts.spotify.com/api/token";
      const tokenParams = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
      });

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams,
      });

      if (!response.ok) {
        console.error("Token refresh failed:", await response.text());
        return null;
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep the old one
        expiresIn: data.expires_in,
      };
    } catch (error) {
      console.error("Error refreshing Spotify token:", error);
      return null;
    }
  }

  static async getUserWithValidToken(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.spotifyRefreshToken) {
      return user;
    }

    // Check if token needs refreshing (refresh 5 minutes before expiry)
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (
      user.spotifyTokenExpiry &&
      user.spotifyTokenExpiry <= fiveMinutesFromNow
    ) {
      console.log("Refreshing Spotify token for user:", user.id);
      const newTokens = await this.refreshSpotifyToken(
        user.spotifyRefreshToken
      );

      if (newTokens) {
        return await this.updateUserTokens(user.id, newTokens);
      } else {
        console.error("Failed to refresh token for user:", user.id);
      }
    }

    return user;
  }

  static generateJWT(userId: string): string {
    const payload: JWTPayload = { userId };
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
  }

  static verifyJWT(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (error) {
      console.error("JWT verification failed:", error);
      return null;
    }
  }

  static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString("hex");
  }

  static async createRefreshToken(
    userId: string,
    expiresInDays: number = 30
  ): Promise<string> {
    const token = this.generateRefreshToken();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    );

    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  static async validateRefreshToken(token: string): Promise<string | null> {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (
      !refreshToken ||
      refreshToken.isRevoked ||
      refreshToken.expiresAt < new Date()
    ) {
      return null;
    }

    return refreshToken.userId;
  }

  static async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true },
    });
  }

  static async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  static async generateTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = this.generateJWT(userId);
    const refreshToken = await this.createRefreshToken(userId);

    return { accessToken, refreshToken };
  }

  static async refreshAccessToken(
    refreshToken: string
  ): Promise<TokenPair | null> {
    const userId = await this.validateRefreshToken(refreshToken);

    if (!userId) {
      return null;
    }

    // Revoke the old refresh token and create a new one (token rotation)
    await this.revokeRefreshToken(refreshToken);

    return await this.generateTokenPair(userId);
  }

  static createSpotifyApi(redirectUri?: string): SpotifyWebApi {
    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: redirectUri || "givemetheaux://auth",
    });

    return spotifyApi;
  }
}
