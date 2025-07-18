import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiRoutesLimiter } from "../middleware/rateLimit";

const router = Router();
const prisma = new PrismaClient();

// Create or update a submission for an active round
router.post(
  "/",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const {
        roundId,
        spotifyTrackId,
        trackName,
        artistName,
        albumName,
        imageUrl,
        previewUrl,
        spotifyUrl,
      } = req.body;
      const userId = req.user!.id;

      if (!roundId) {
        return res.status(400).json({ error: "Round ID is required" });
      }

      if (
        !spotifyTrackId ||
        !trackName ||
        !artistName ||
        !albumName ||
        !spotifyUrl
      ) {
        return res.status(400).json({
          error:
            "Spotify track ID, track name, artist name, album name, and Spotify URL are required",
        });
      }

      // Check if the round exists and is active
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: {
          group: {
            include: {
              members: {
                where: { userId: userId },
              },
            },
          },
        },
      });

      if (!round) {
        return res.status(404).json({ error: "Round not found" });
      }

      // Check if user is a member of the group
      if (round.group.members.length === 0) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      // Check if round is in submission phase
      if (round.status !== "SUBMISSION") {
        return res.status(400).json({
          error: "Submissions are only allowed during the submission phase",
        });
      }

      // Check if submission period has ended
      const now = new Date();
      if (now > round.endDate) {
        return res.status(400).json({
          error: "Submission period has ended",
        });
      }

      // Check if user already has a submission for this round
      const existingSubmission = await prisma.submission.findUnique({
        where: {
          roundId_userId: {
            roundId: roundId,
            userId: userId,
          },
        },
      });

      const submissionData = {
        roundId,
        userId,
        spotifyTrackId,
        trackName: trackName.trim(),
        artistName: artistName.trim(),
        albumName: albumName.trim(),
        imageUrl: imageUrl?.trim() || null,
        previewUrl: previewUrl?.trim() || null,
        spotifyUrl: spotifyUrl.trim(),
      };

      let submission;
      if (existingSubmission) {
        // Update existing submission
        submission = await prisma.submission.update({
          where: { id: existingSubmission.id },
          data: submissionData,
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            round: {
              select: {
                id: true,
                theme: true,
                status: true,
              },
            },
          },
        });
      } else {
        // Create new submission
        submission = await prisma.submission.create({
          data: submissionData,
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            round: {
              select: {
                id: true,
                theme: true,
                status: true,
              },
            },
          },
        });
      }

      res.status(200).json({ data: submission });
    } catch (error) {
      console.error("Create/update submission error:", error);
      res.status(500).json({ error: "Failed to create/update submission" });
    }
  }
);

// Get submissions for a specific round
router.get(
  "/round/:roundId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { roundId } = req.params;
      const userId = req.user!.id;

      // Check if the round exists
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: {
          group: {
            include: {
              members: {
                where: { userId: userId },
              },
            },
          },
        },
      });

      if (!round) {
        return res.status(404).json({ error: "Round not found" });
      }

      // Check if user is a member of the group
      if (round.group.members.length === 0) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      const submissions = await prisma.submission.findMany({
        where: { roundId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          votes: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
        orderBy: { submittedAt: "asc" },
      });

      res.json({ data: submissions });
    } catch (error) {
      console.error("Get submissions error:", error);
      res.status(500).json({ error: "Failed to get submissions" });
    }
  }
);

// Get a specific submission
router.get(
  "/:submissionId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user!.id;

      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          round: {
            include: {
              group: {
                include: {
                  members: {
                    where: { userId: userId },
                  },
                },
              },
            },
          },
          votes: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
      });

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Check if user is a member of the group
      if (submission.round.group.members.length === 0) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      res.json({ data: submission });
    } catch (error) {
      console.error("Get submission error:", error);
      res.status(500).json({ error: "Failed to get submission" });
    }
  }
);

// Delete a submission (only by the user who created it)
router.delete(
  "/:submissionId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user!.id;

      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          round: {
            include: {
              group: {
                include: {
                  members: {
                    where: { userId: userId },
                  },
                },
              },
            },
          },
        },
      });

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Check if user is a member of the group
      if (submission.round.group.members.length === 0) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      // Check if user owns the submission
      if (submission.userId !== userId) {
        return res
          .status(403)
          .json({ error: "You can only delete your own submissions" });
      }

      // Check if round is still in submission phase
      if (submission.round.status !== "SUBMISSION") {
        return res.status(400).json({
          error: "Submissions can only be deleted during the submission phase",
        });
      }

      await prisma.submission.delete({
        where: { id: submissionId },
      });

      res.json({ message: "Submission deleted successfully" });
    } catch (error) {
      console.error("Delete submission error:", error);
      res.status(500).json({ error: "Failed to delete submission" });
    }
  }
);

export default router;
