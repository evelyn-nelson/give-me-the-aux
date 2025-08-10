import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiRoutesLimiter } from "../middleware/rateLimit";

const router = Router();
const prisma = new PrismaClient();

function generateInviteToken(length = 32): string {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  // Convert to URL-safe base64 without padding
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// Create an invite (admin only)
router.post(
  "/:groupId/invites",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const { expiresInDays, maxUses } = req.body as {
        expiresInDays?: number;
        maxUses?: number;
      };
      const userId = req.user!.id;

      // Verify admin
      const group = await prisma.group.findFirst({
        where: { id: groupId, adminId: userId },
      });
      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or you are not the admin" });
      }

      // Validate inputs
      let expiresAt: Date | null = null;
      if (expiresInDays !== undefined) {
        if (
          !Number.isFinite(expiresInDays) ||
          expiresInDays < 1 ||
          expiresInDays > 365
        ) {
          return res
            .status(400)
            .json({ error: "expiresInDays must be between 1 and 365" });
        }
        const now = new Date();
        expiresAt = new Date(
          now.getTime() + expiresInDays * 24 * 60 * 60 * 1000
        );
      } else {
        // Default 14 days
        const now = new Date();
        expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      }

      if (maxUses !== undefined) {
        if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
          return res
            .status(400)
            .json({ error: "maxUses must be an integer between 1 and 10000" });
        }
      }

      // Generate unique token
      let token = "";
      // Loop to avoid extremely rare collision
      for (let i = 0; i < 5; i++) {
        token = generateInviteToken(24);
        const existing = await prisma.groupInvite.findUnique({
          where: { token },
        });
        if (!existing) break;
        if (i === 4) {
          return res
            .status(500)
            .json({ error: "Failed to generate unique token" });
        }
      }

      const invite = await prisma.groupInvite.create({
        data: {
          token,
          groupId: groupId,
          createdByUserId: userId,
          expiresAt: expiresAt!,
          maxUses: maxUses ?? null,
        },
      });

      const scheme = process.env.DEEPLINK_SCHEME || "givemetheaux";
      const url = `${scheme}://join/${invite.token}`;

      res.status(201).json({
        data: {
          token: invite.token,
          url,
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses,
          usedCount: invite.usedCount,
          isRevoked: invite.isRevoked,
          groupId: invite.groupId,
        },
      });
    } catch (error) {
      console.error("Create invite error:", error);
      res.status(500).json({ error: "Failed to create invite" });
    }
  }
);

// Accept an invite
router.post(
  "/accept/:token",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { token } = req.params;
      const userId = req.user!.id;

      const invite = await prisma.groupInvite.findUnique({ where: { token } });
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      if (invite.isRevoked) {
        return res.status(400).json({ error: "Invite has been revoked" });
      }
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invite has expired" });
      }
      if (
        invite.maxUses !== null &&
        invite.maxUses !== undefined &&
        invite.usedCount >= invite.maxUses
      ) {
        return res
          .status(400)
          .json({ error: "Invite has reached its maximum uses" });
      }

      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Check if already a member
          const existingMember = await tx.groupMember.findUnique({
            where: {
              groupId_userId: {
                groupId: invite.groupId,
                userId,
              },
            },
          });

          let createdMembership = false;
          if (!existingMember) {
            await tx.groupMember.create({
              data: {
                groupId: invite.groupId,
                userId,
              },
            });
            createdMembership = true;
          }

          if (createdMembership) {
            await tx.groupInvite.update({
              where: { token },
              data: { usedCount: { increment: 1 } },
            });
          }

          // Return group with basic info
          const group = await tx.group.findUnique({
            where: { id: invite.groupId },
            include: {
              admin: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
              _count: { select: { members: true, rounds: true } },
            },
          });
          return { group, createdMembership };
        }
      );

      if (!result.group) {
        return res.status(404).json({ error: "Group not found" });
      }

      res.json({
        data: {
          group: result.group,
          joined: result.createdMembership,
        },
      });
    } catch (error) {
      console.error("Accept invite error:", error);
      res.status(500).json({ error: "Failed to accept invite" });
    }
  }
);

export default router;
