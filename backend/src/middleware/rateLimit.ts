import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { AuthRequest } from "./auth";

// Rate limiter for Spotify OAuth login
export const spotifyLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error:
      "Too many login attempts from this IP, please try again after 15 minutes",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error:
        "Too many login attempts from this IP, please try again after 15 minutes",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});

// Rate limiter for token refresh
export const tokenRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 refresh attempts per windowMs
  message: {
    error:
      "Too many token refresh attempts from this IP, please try again after 15 minutes",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error:
        "Too many token refresh attempts from this IP, please try again after 15 minutes",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});

// Rate limiter for general auth endpoints (me, logout)
export const authEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error:
        "Too many requests from this IP, please try again after 15 minutes",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});

// Rate limiter for authenticated endpoints that tracks by user ID
export const userSpecificLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each user to 50 requests per window
  keyGenerator: (req: AuthRequest) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip || "anonymous";
  },
  message: {
    error:
      "Too many requests from this user, please try again after 15 minutes",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: AuthRequest, res: Response) => {
    res.status(429).json({
      error:
        "Too many requests from this user, please try again after 15 minutes",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});

// Rate limiter for normal API routes (groups, rounds, etc.)
export const apiRoutesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each user to 200 requests per window
  keyGenerator: (req: AuthRequest) => {
    return req.user?.id || req.ip || "anonymous";
  },
  message: {
    error:
      "Too many requests from this user, please try again after 15 minutes",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: AuthRequest, res: Response) => {
    res.status(429).json({
      error:
        "Too many requests from this user, please try again after 15 minutes",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});
