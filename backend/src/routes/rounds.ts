import { Router } from "express";
import { PrismaClient, RoundStatus } from "@prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiRoutesLimiter } from "../middleware/rateLimit";

const router = Router();
const prisma = new PrismaClient();

// Create a new round in a group
router.post(
  "/",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const {
        groupId,
        theme,
        description,
        startDate,
        endDate,
        votingStartDate,
        order,
      } = req.body;
      const userId = req.user!.id;

      if (!groupId) {
        return res.status(400).json({ error: "Group ID is required" });
      }

      if (!theme || theme.trim().length === 0) {
        return res.status(400).json({ error: "Theme is required" });
      }

      // Check if user is admin of the group
      const group = await prisma.group.findFirst({
        where: {
          id: groupId,
          adminId: userId,
        },
      });

      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or you are not the admin" });
      }

      // Check if there's already an active round (SUBMISSION or VOTING status)
      const activeRound = await prisma.round.findFirst({
        where: {
          groupId: groupId,
          status: {
            in: ["SUBMISSION", "VOTING"],
          },
        },
      });

      // Get the last round to determine the start date for the new round
      const lastRound = await prisma.round.findFirst({
        where: { groupId: groupId },
        orderBy: { order: "desc" },
      });

      let roundStartDate: Date;
      let roundEndDate: Date;
      let roundVotingStartDate: Date;
      let roundStatus: RoundStatus = "SUBMISSION";

      // If there's an active round, new rounds should be INACTIVE
      if (activeRound) {
        roundStatus = "INACTIVE" as RoundStatus;
      }

      if (!lastRound) {
        // First round - require only start date
        if (!startDate) {
          return res.status(400).json({
            error: "Start date is required for the first round",
          });
        }

        // Parse start date
        roundStartDate = new Date(startDate);

        // Validate start date
        if (isNaN(roundStartDate.getTime())) {
          return res.status(400).json({ error: "Invalid start date format" });
        }

        // Calculate voting start date and end date based on group settings
        roundVotingStartDate = new Date(roundStartDate);
        roundVotingStartDate.setDate(
          roundVotingStartDate.getDate() + group.submissionDurationDays
        );

        roundEndDate = new Date(roundStartDate);
        roundEndDate.setDate(
          roundEndDate.getDate() +
            group.submissionDurationDays +
            group.votingDurationDays
        );
      } else {
        // Subsequent rounds - calculate dates automatically based on group settings
        // Start date = end date of previous round
        roundStartDate = new Date(lastRound.endDate);

        // End date = start date + submission duration + voting duration
        roundEndDate = new Date(roundStartDate);
        roundEndDate.setDate(
          roundEndDate.getDate() +
            group.submissionDurationDays +
            group.votingDurationDays
        );

        // Voting start date = start date + submission duration
        roundVotingStartDate = new Date(roundStartDate);
        roundVotingStartDate.setDate(
          roundVotingStartDate.getDate() + group.submissionDurationDays
        );
      }

      // Determine the order for the new round
      let roundOrder = order;
      if (!roundOrder) {
        // If no order specified, find the highest order and add 1
        roundOrder = lastRound ? lastRound.order + 1 : 1;
      } else {
        // Validate that the order is positive
        if (roundOrder < 1) {
          return res
            .status(400)
            .json({ error: "Order must be a positive number" });
        }

        // Check if the order already exists
        const existingRound = await prisma.round.findUnique({
          where: {
            groupId_order: {
              groupId: groupId,
              order: roundOrder,
            },
          },
        });

        if (existingRound) {
          return res
            .status(400)
            .json({ error: "A round with this order already exists" });
        }
      }

      const round = await prisma.round.create({
        data: {
          groupId: groupId,
          theme: theme.trim(),
          description: description?.trim() || null,
          order: roundOrder,
          startDate: roundStartDate,
          endDate: roundEndDate,
          votingStartDate: roundVotingStartDate,
          status: roundStatus,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              admin: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              votesPerUserPerRound: true,
              maxVotesPerSong: true,
            },
          },
          submissions: {
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
              submissions: true,
            },
          },
        },
      });

      res.status(201).json({ data: round });
    } catch (error) {
      console.error("Create round error:", error);
      res.status(500).json({ error: "Failed to create round" });
    }
  }
);

// Get rounds for a specific group
router.get(
  "/group/:groupId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;

      // Check if user is a member of the group
      const groupMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: groupId,
            userId: userId,
          },
        },
      });

      if (!groupMember) {
        return res
          .status(404)
          .json({ error: "Group not found or you are not a member" });
      }

      const rounds = await prisma.round.findMany({
        where: {
          groupId: groupId,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              admin: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              votesPerUserPerRound: true,
              maxVotesPerSong: true,
            },
          },
          submissions: {
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
                    },
                  },
                },
              },
            },
          },
          playlists: {
            select: {
              id: true,
              name: true,
              spotifyUrl: true,
              isPublic: true,
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      });

      res.json({ data: rounds });
    } catch (error) {
      console.error("Get rounds error:", error);
      res.status(500).json({ error: "Failed to retrieve rounds" });
    }
  }
);

// Get a specific round by ID
router.get(
  "/:id",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const round = await prisma.round.findFirst({
        where: {
          id: id,
          group: {
            members: {
              some: {
                userId: userId,
              },
            },
          },
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              admin: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              votesPerUserPerRound: true,
              maxVotesPerSong: true,
            },
          },
          submissions: {
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
                    },
                  },
                },
              },
            },
          },
          playlists: {
            select: {
              id: true,
              name: true,
              spotifyUrl: true,
              isPublic: true,
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
      });

      if (!round) {
        return res
          .status(404)
          .json({ error: "Round not found or access denied" });
      }

      res.json({ data: round });
    } catch (error) {
      console.error("Get round error:", error);
      res.status(500).json({ error: "Failed to retrieve round" });
    }
  }
);

// Update round details (admin only)
router.patch(
  "/:id",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const {
        theme,
        description,
        startDate,
        endDate,
        votingStartDate,
        status,
        order,
      } = req.body;

      // Check if user is admin of the group that contains this round
      const round = await prisma.round.findFirst({
        where: {
          id: id,
          group: {
            adminId: userId,
          },
        },
        include: {
          group: true,
        },
      });

      if (!round) {
        return res
          .status(404)
          .json({ error: "Round not found or you are not the admin" });
      }

      // Only allow updates if round is still in SUBMISSION status
      if (round.status !== "SUBMISSION") {
        return res.status(400).json({
          error: "Cannot update round that has already started voting",
        });
      }

      // Prepare update data
      const updateData: any = {};

      if (theme !== undefined) {
        if (!theme || theme.trim().length === 0) {
          return res.status(400).json({ error: "Theme cannot be empty" });
        }
        updateData.theme = theme.trim();
      }

      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }

      if (startDate !== undefined) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({ error: "Invalid start date format" });
        }
        updateData.startDate = start;
      }

      if (endDate !== undefined) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({ error: "Invalid end date format" });
        }
        updateData.endDate = end;
      }

      if (votingStartDate !== undefined) {
        const votingStart = new Date(votingStartDate);
        if (isNaN(votingStart.getTime())) {
          return res
            .status(400)
            .json({ error: "Invalid voting start date format" });
        }
        updateData.votingStartDate = votingStart;
      }

      if (status !== undefined) {
        if (!["SUBMISSION", "VOTING", "COMPLETED"].includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }
        updateData.status = status;
      }

      if (order !== undefined) {
        if (order < 1) {
          return res
            .status(400)
            .json({ error: "Order must be a positive number" });
        }

        // Check if the order already exists for a different round in the same group
        const existingRound = await prisma.round.findFirst({
          where: {
            groupId: round.groupId,
            order: order,
            id: { not: id },
          },
        });

        if (existingRound) {
          return res
            .status(400)
            .json({ error: "A round with this order already exists" });
        }

        updateData.order = order;
      }

      // Validate date relationships if any dates are being updated
      if (
        updateData.startDate ||
        updateData.endDate ||
        updateData.votingStartDate
      ) {
        const finalStartDate = updateData.startDate || round.startDate;
        const finalEndDate = updateData.endDate || round.endDate;
        const finalVotingStartDate =
          updateData.votingStartDate || round.votingStartDate;

        if (finalStartDate >= finalEndDate) {
          return res
            .status(400)
            .json({ error: "Start date must be before end date" });
        }

        if (
          finalVotingStartDate < finalStartDate ||
          finalVotingStartDate >= finalEndDate
        ) {
          return res.status(400).json({
            error: "Voting start date must be between start and end dates",
          });
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updatedRound = await prisma.round.update({
        where: { id: id },
        data: updateData,
        include: {
          group: {
            select: {
              id: true,
              name: true,
              admin: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          submissions: {
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
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
      });

      res.json({ data: updatedRound });
    } catch (error) {
      console.error("Update round error:", error);
      res.status(500).json({ error: "Failed to update round" });
    }
  }
);

// Reorder rounds in a group (admin only)
router.patch(
  "/reorder/:groupId",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const { roundOrders } = req.body; // Array of { roundId, newOrder }
      const userId = req.user!.id;

      if (!roundOrders || !Array.isArray(roundOrders)) {
        return res.status(400).json({ error: "roundOrders array is required" });
      }

      // Check if user is admin of the group
      const group = await prisma.group.findFirst({
        where: {
          id: groupId,
          adminId: userId,
        },
      });

      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or you are not the admin" });
      }

      // Validate that all rounds belong to this group
      const roundIds = roundOrders.map((item: any) => item.roundId);
      const rounds = await prisma.round.findMany({
        where: {
          id: { in: roundIds },
          groupId: groupId,
        },
      });

      if (rounds.length !== roundIds.length) {
        return res
          .status(400)
          .json({ error: "Some rounds do not belong to this group" });
      }

      // Update orders in a transaction
      await prisma.$transaction(async (tx) => {
        for (const item of roundOrders) {
          await tx.round.update({
            where: { id: item.roundId },
            data: { order: item.newOrder },
          });
        }
      });

      // Return updated rounds
      const updatedRounds = await prisma.round.findMany({
        where: { groupId: groupId },
        include: {
          submissions: {
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
              submissions: true,
            },
          },
        },
        orderBy: { order: "asc" },
      });

      res.json({ data: updatedRounds });
    } catch (error) {
      console.error("Reorder rounds error:", error);
      res.status(500).json({ error: "Failed to reorder rounds" });
    }
  }
);

// Delete round (admin only)
router.delete(
  "/:id",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check if user is admin of the group that contains this round
      const round = await prisma.round.findFirst({
        where: {
          id: id,
          group: {
            adminId: userId,
          },
        },
      });

      if (!round) {
        return res
          .status(404)
          .json({ error: "Round not found or you are not the admin" });
      }

      // Only allow deletion if round is still in SUBMISSION status and has no submissions
      if (round.status !== "SUBMISSION") {
        return res.status(400).json({
          error: "Cannot delete round that has already started voting",
        });
      }

      // Check if there are any submissions
      const submissionCount = await prisma.submission.count({
        where: {
          roundId: id,
        },
      });

      if (submissionCount > 0) {
        return res
          .status(400)
          .json({ error: "Cannot delete round that has submissions" });
      }

      // Delete the round
      await prisma.round.delete({
        where: { id: id },
      });

      res.json({ data: { message: "Round deleted successfully" } });
    } catch (error) {
      console.error("Delete round error:", error);
      res.status(500).json({ error: "Failed to delete round" });
    }
  }
);

export default router;
