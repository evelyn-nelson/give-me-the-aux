import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiRoutesLimiter } from "../middleware/rateLimit";

const router = Router();
const prisma = new PrismaClient();

// Get messages for a group (with pagination)
router.get(
  "/group/:groupId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const { limit = "5", offset = "0" } = req.query;
      const userId = req.user!.id;

      if (!groupId) {
        return res.status(400).json({ error: "Group ID is required" });
      }

      // Validate pagination parameters
      const parsedLimit = Math.min(
        Math.max(parseInt(limit as string) || 50, 1),
        100
      );
      const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);

      // Check if user is a member of the group
      const groupMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!groupMember) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      // Get messages with user information
      const messages = await prisma.message.findMany({
        where: { groupId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: parsedLimit,
        skip: parsedOffset,
      });

      // Reverse to show newest at bottom
      const reversedMessages = messages.reverse();

      res.json({ data: reversedMessages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  }
);

// Create a new message
router.post(
  "/",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { groupId, content } = req.body;
      const userId = req.user!.id;

      if (!groupId || !content) {
        return res
          .status(400)
          .json({ error: "Group ID and content are required" });
      }

      // Validate content length
      if (content.length > 1000) {
        return res
          .status(400)
          .json({ error: "Message must be 1000 characters or less" });
      }

      // Check if user is a member of the group
      const groupMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!groupMember) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      // Create the message
      const message = await prisma.message.create({
        data: {
          groupId,
          userId,
          content: content.trim(),
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      res.status(201).json({ data: message });
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  }
);

export default router;
