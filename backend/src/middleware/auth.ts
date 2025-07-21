import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthService } from "../services/auth";

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    spotifyId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    country?: string;
    spotifyAccessToken?: string;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = AuthService.verifyJWT(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Get user with valid Spotify token (auto-refreshes if needed)
    const user = await AuthService.getUserWithValidToken(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      id: user.id,
      spotifyId: user.spotifyId,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? undefined,
      country: user.country ?? undefined,
      spotifyAccessToken: user.spotifyAccessToken ?? undefined,
    };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    const decoded = AuthService.verifyJWT(token);

    if (decoded) {
      const user = await AuthService.getUserWithValidToken(decoded.userId);
      if (user) {
        // Map nullable fields to undefined to match AuthRequest user type
        req.user = {
          id: user.id,
          spotifyId: user.spotifyId,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl ?? undefined,
          country: user.country ?? undefined,
          spotifyAccessToken: user.spotifyAccessToken ?? undefined,
        };
      }
    }

    next();
  } catch (error) {
    // Continue without user if auth fails
    next();
  }
};
