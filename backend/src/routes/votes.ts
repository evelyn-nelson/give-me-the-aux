import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiRoutesLimiter } from "../middleware/rateLimit";

const router = Router();
const prisma = new PrismaClient();

// Get all votes for a submission
router.get(
  "/:submissionId/votes",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user!.id;

      // Check if submission exists and user has access
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

      const votes = await prisma.vote.findMany({
        where: { submissionId },
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
      });

      res.json({ data: votes });
    } catch (error) {
      console.error("Get votes error:", error);
      res.status(500).json({ error: "Failed to get votes" });
    }
  }
);

// Create a new vote
router.post(
  "/:submissionId/votes",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { submissionId } = req.params;
      const { count, comment } = req.body;
      const userId = req.user!.id;

      if (!count || count < 1) {
        return res.status(400).json({ error: "Vote count must be at least 1" });
      }

      // Validate comment length
      if (comment && comment.length > 500) {
        return res.status(400).json({
          error: "Comment must be 500 characters or less",
        });
      }

      // Check if submission exists and get context
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          user: { select: { id: true } },
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

      // Check if round is in voting phase
      if (submission.round.status !== "VOTING") {
        return res.status(400).json({
          error: "Voting is only allowed during the voting phase",
        });
      }

      // Check if voting period has ended
      const now = new Date();
      if (now > submission.round.endDate) {
        return res.status(400).json({
          error: "Voting period has ended",
        });
      }

      // Users cannot vote on their own submissions
      if (submission.user.id === userId) {
        return res.status(400).json({
          error: "You cannot vote on your own submission",
        });
      }

      // Check if vote count exceeds max votes per song
      if (count > submission.round.group.maxVotesPerSong) {
        return res.status(400).json({
          error: `Cannot vote more than ${submission.round.group.maxVotesPerSong} times on a single song`,
        });
      }

      // Check if user already voted for this submission
      const existingVote = await prisma.vote.findUnique({
        where: {
          submissionId_userId: {
            submissionId: submissionId,
            userId: userId,
          },
        },
      });

      if (existingVote) {
        return res.status(400).json({
          error:
            "You have already voted on this submission. Use PUT to update your vote.",
        });
      }

      // Check user's total votes for this round
      const userVotesInRound = await prisma.vote.findMany({
        where: {
          userId: userId,
          submission: {
            roundId: submission.round.id,
          },
        },
      });

      const totalVotesUsed = userVotesInRound.reduce(
        (sum, vote) => sum + vote.count,
        0
      );

      if (
        totalVotesUsed + count >
        submission.round.group.votesPerUserPerRound
      ) {
        return res.status(400).json({
          error: `Cannot exceed ${submission.round.group.votesPerUserPerRound} total votes per round. You have ${totalVotesUsed} votes used.`,
        });
      }

      // Create the vote
      const vote = await prisma.vote.create({
        data: {
          submissionId: submissionId,
          userId: userId,
          count: count,
          comment: comment?.trim() || null,
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

      res.status(201).json({ data: vote });
    } catch (error) {
      console.error("Create vote error:", error);
      res.status(500).json({ error: "Failed to create vote" });
    }
  }
);

// Update an existing vote
router.put(
  "/:submissionId/votes/:voteId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { submissionId, voteId } = req.params;
      const { count, comment } = req.body;
      const userId = req.user!.id;

      if (!count || count < 1) {
        return res.status(400).json({ error: "Vote count must be at least 1" });
      }

      // Validate comment length
      if (comment && comment.length > 500) {
        return res.status(400).json({
          error: "Comment must be 500 characters or less",
        });
      }

      // Check if vote exists and belongs to user
      const existingVote = await prisma.vote.findUnique({
        where: { id: voteId },
        include: {
          submission: {
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
          },
        },
      });

      if (!existingVote) {
        return res.status(404).json({ error: "Vote not found" });
      }

      if (existingVote.submissionId !== submissionId) {
        return res
          .status(400)
          .json({ error: "Vote does not belong to this submission" });
      }

      if (existingVote.userId !== userId) {
        return res
          .status(403)
          .json({ error: "You can only update your own votes" });
      }

      // Check if vote is finalized
      if (existingVote.isFinalized) {
        return res.status(400).json({
          error:
            "Cannot update finalized votes. Finalized votes are locked in.",
        });
      }

      // Check if user is a member of the group
      if (existingVote.submission.round.group.members.length === 0) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      // Check if round is still in voting phase
      if (existingVote.submission.round.status !== "VOTING") {
        return res.status(400).json({
          error: "Votes can only be updated during the voting phase",
        });
      }

      // Check if voting period has ended
      const now = new Date();
      if (now > existingVote.submission.round.endDate) {
        return res.status(400).json({
          error: "Voting period has ended",
        });
      }

      // Check if vote count exceeds max votes per song
      if (count > existingVote.submission.round.group.maxVotesPerSong) {
        return res.status(400).json({
          error: `Cannot vote more than ${existingVote.submission.round.group.maxVotesPerSong} times on a single song`,
        });
      }

      // Check user's total votes for this round (excluding current vote)
      const userVotesInRound = await prisma.vote.findMany({
        where: {
          userId: userId,
          submission: {
            roundId: existingVote.submission.round.id,
          },
          id: { not: voteId }, // Exclude the current vote being updated
        },
      });

      const totalVotesUsed = userVotesInRound.reduce(
        (sum, vote) => sum + vote.count,
        0
      );

      if (
        totalVotesUsed + count >
        existingVote.submission.round.group.votesPerUserPerRound
      ) {
        return res.status(400).json({
          error: `Cannot exceed ${existingVote.submission.round.group.votesPerUserPerRound} total votes per round. You have ${totalVotesUsed} votes used (excluding this vote).`,
        });
      }

      // Update the vote
      const updatedVote = await prisma.vote.update({
        where: { id: voteId },
        data: {
          count: count,
          comment: comment?.trim() || null,
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

      res.json({ data: updatedVote });
    } catch (error) {
      console.error("Update vote error:", error);
      res.status(500).json({ error: "Failed to update vote" });
    }
  }
);

// Delete a vote
router.delete(
  "/:submissionId/votes/:voteId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { submissionId, voteId } = req.params;
      const userId = req.user!.id;

      // Check if vote exists and belongs to user
      const existingVote = await prisma.vote.findUnique({
        where: { id: voteId },
        include: {
          submission: {
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
          },
        },
      });

      if (!existingVote) {
        return res.status(404).json({ error: "Vote not found" });
      }

      if (existingVote.submissionId !== submissionId) {
        return res
          .status(400)
          .json({ error: "Vote does not belong to this submission" });
      }

      if (existingVote.userId !== userId) {
        return res
          .status(403)
          .json({ error: "You can only delete your own votes" });
      }

      // Check if user is a member of the group
      if (existingVote.submission.round.group.members.length === 0) {
        return res
          .status(403)
          .json({ error: "You are not a member of this group" });
      }

      // Check if round is still in voting phase
      if (existingVote.submission.round.status !== "VOTING") {
        return res.status(400).json({
          error: "Votes can only be deleted during the voting phase",
        });
      }

      // Check if voting period has ended
      const now = new Date();
      if (now > existingVote.submission.round.endDate) {
        return res.status(400).json({
          error: "Voting period has ended",
        });
      }

      // Delete the vote
      await prisma.vote.delete({
        where: { id: voteId },
      });

      res.json({ message: "Vote deleted successfully" });
    } catch (error) {
      console.error("Delete vote error:", error);
      res.status(500).json({ error: "Failed to delete vote" });
    }
  }
);

export default router;
