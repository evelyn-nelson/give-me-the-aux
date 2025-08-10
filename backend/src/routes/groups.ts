import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { apiRoutesLimiter } from "../middleware/rateLimit";

const router = Router();
const prisma = new PrismaClient();

// Create a new group
router.post(
  "/",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const {
        name,
        submissionDurationDays,
        votingDurationDays,
        votesPerUserPerRound,
        maxVotesPerSong,
      } = req.body;
      const userId = req.user!.id;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Group name is required" });
      }

      // Validate optional settings
      const settings = {
        submissionDurationDays: submissionDurationDays ?? 3,
        votingDurationDays: votingDurationDays ?? 2,
        votesPerUserPerRound: votesPerUserPerRound ?? 10,
        maxVotesPerSong: maxVotesPerSong ?? 3,
      };

      // Validate ranges
      if (
        settings.submissionDurationDays < 1 ||
        settings.submissionDurationDays > 30
      ) {
        return res
          .status(400)
          .json({ error: "Submission duration must be between 1 and 30 days" });
      }
      if (settings.votingDurationDays < 1 || settings.votingDurationDays > 14) {
        return res
          .status(400)
          .json({ error: "Voting duration must be between 1 and 14 days" });
      }
      if (
        settings.votesPerUserPerRound < 1 ||
        settings.votesPerUserPerRound > 50
      ) {
        return res
          .status(400)
          .json({ error: "Votes per user per round must be between 1 and 50" });
      }
      if (settings.maxVotesPerSong < 1 || settings.maxVotesPerSong > 10) {
        return res
          .status(400)
          .json({ error: "Max votes per song must be between 1 and 10" });
      }

      const group = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Create the group
          const newGroup = await tx.group.create({
            data: {
              name: name.trim(),
              adminId: userId,
              submissionDurationDays: settings.submissionDurationDays,
              votingDurationDays: settings.votingDurationDays,
              votesPerUserPerRound: settings.votesPerUserPerRound,
              maxVotesPerSong: settings.maxVotesPerSong,
            },
            include: {
              admin: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              members: {
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
            },
          });

          // Add the creator as a member
          await tx.groupMember.create({
            data: {
              groupId: newGroup.id,
              userId: userId,
            },
          });

          return newGroup;
        }
      );

      res.status(201).json({ data: group });
    } catch (error) {
      console.error("Create group error:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  }
);

// Get groups the user is a member of
router.get(
  "/",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const groups = await prisma.group.findMany({
        where: {
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          admin: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          members: {
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
          rounds: {
            select: {
              id: true,
              theme: true,
              status: true,
              startDate: true,
              endDate: true,
              votingStartDate: true,
              _count: {
                select: {
                  submissions: true,
                },
              },
              group: {
                select: {
                  id: true,
                  name: true,
                  admin: {
                    select: {
                      id: true,
                      displayName: true,
                    },
                  },
                  votesPerUserPerRound: true,
                  maxVotesPerSong: true,
                },
              },
              submissions: {
                select: {
                  id: true,
                  spotifyTrackId: true,
                  trackName: true,
                  artistName: true,
                  albumName: true,
                  imageUrl: true,
                  user: {
                    select: {
                      id: true,
                      displayName: true,
                    },
                  },
                  votes: {
                    select: {
                      id: true,
                      count: true,
                      comment: true,
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
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              members: true,
              rounds: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json({ data: groups });
    } catch (error) {
      console.error("Get groups error:", error);
      res.status(500).json({ error: "Failed to retrieve groups" });
    }
  }
);

// Get a specific group by ID
router.get(
  "/:id",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const group = await prisma.group.findFirst({
        where: {
          id: id,
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          admin: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          members: {
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
          rounds: {
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
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              members: true,
              rounds: true,
            },
          },
        },
      });

      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or access denied" });
      }

      res.json({ data: group });
    } catch (error) {
      console.error("Get group error:", error);
      res.status(500).json({ error: "Failed to retrieve group" });
    }
  }
);

// Update group settings (admin only)
router.patch(
  "/:id",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const {
        name,
        submissionDurationDays,
        votingDurationDays,
        votesPerUserPerRound,
        maxVotesPerSong,
      } = req.body;

      // Check if user is admin of the group
      const group = await prisma.group.findFirst({
        where: {
          id: id,
          adminId: userId,
        },
      });

      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or you are not the admin" });
      }

      // Prepare update data
      const updateData: any = {};

      if (name !== undefined) {
        if (!name || name.trim().length === 0) {
          return res.status(400).json({ error: "Group name cannot be empty" });
        }
        updateData.name = name.trim();
      }

      if (submissionDurationDays !== undefined) {
        if (submissionDurationDays < 1 || submissionDurationDays > 30) {
          return res.status(400).json({
            error: "Submission duration must be between 1 and 30 days",
          });
        }
        updateData.submissionDurationDays = submissionDurationDays;
      }

      if (votingDurationDays !== undefined) {
        if (votingDurationDays < 1 || votingDurationDays > 14) {
          return res
            .status(400)
            .json({ error: "Voting duration must be between 1 and 14 days" });
        }
        updateData.votingDurationDays = votingDurationDays;
      }

      if (votesPerUserPerRound !== undefined) {
        if (votesPerUserPerRound < 1 || votesPerUserPerRound > 50) {
          return res.status(400).json({
            error: "Votes per user per round must be between 1 and 50",
          });
        }
        updateData.votesPerUserPerRound = votesPerUserPerRound;
      }

      if (maxVotesPerSong !== undefined) {
        if (maxVotesPerSong < 1 || maxVotesPerSong > 10) {
          return res
            .status(400)
            .json({ error: "Max votes per song must be between 1 and 10" });
        }
        updateData.maxVotesPerSong = maxVotesPerSong;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updatedGroup = await prisma.group.update({
        where: { id: id },
        data: updateData,
        include: {
          admin: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          members: {
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
          rounds: {
            select: {
              id: true,
              theme: true,
              status: true,
              startDate: true,
              endDate: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              members: true,
              rounds: true,
            },
          },
        },
      });

      res.json({ data: updatedGroup });
    } catch (error) {
      console.error("Update group error:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  }
);

// Delete group (admin only)
router.delete(
  "/:id",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check if user is admin of the group
      const group = await prisma.group.findFirst({
        where: {
          id: id,
          adminId: userId,
        },
      });

      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or you are not the admin" });
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.vote.deleteMany({
          where: {
            submission: {
              round: {
                groupId: id,
              },
            },
          },
        });

        await tx.submission.deleteMany({
          where: {
            round: {
              groupId: id,
            },
          },
        });

        await tx.round.deleteMany({
          where: {
            groupId: id,
          },
        });

        await tx.groupMember.deleteMany({
          where: {
            groupId: id,
          },
        });

        await tx.message.deleteMany({
          where: {
            groupId: id,
          },
        });

        await tx.group.delete({
          where: { id: id },
        });
      });

      res.json({ data: { message: "Group deleted successfully" } });
    } catch (error) {
      console.error("Delete group error:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  }
);

// Get group members with submission status for a specific round
router.get(
  "/:groupId/rounds/:roundId/members",
  apiRoutesLimiter,
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { groupId, roundId } = req.params;
      const userId = req.user!.id;

      // Check if user is a member of the group
      const group = await prisma.group.findFirst({
        where: {
          id: groupId,
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          members: {
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
        },
      });

      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or you are not a member" });
      }

      // Check if round exists and belongs to this group
      const round = await prisma.round.findFirst({
        where: {
          id: roundId,
          groupId: groupId,
        },
      });

      if (!round) {
        return res
          .status(404)
          .json({ error: "Round not found or doesn't belong to this group" });
      }

      // Get all submissions for this round
      const submissions: Array<{ userId: string }> =
        await prisma.submission.findMany({
          where: {
            roundId: roundId,
          },
          select: {
            userId: true,
          },
        });

      const submittedUserIds = new Set(
        submissions.map((s: { userId: string }) => s.userId)
      );

      // Map members with submission status
      type MemberWithUser = {
        user: { id: string; displayName: string; avatarUrl: string | null };
      };
      const membersWithStatus = (group.members as MemberWithUser[]).map(
        (member: MemberWithUser) => ({
          id: member.user.id,
          displayName: member.user.displayName,
          avatarUrl: member.user.avatarUrl,
          hasSubmitted: submittedUserIds.has(member.user.id),
          isCurrentUser: member.user.id === userId,
        })
      );

      res.json({ data: membersWithStatus });
    } catch (error) {
      console.error("Get group members with submission status error:", error);
      res
        .status(500)
        .json({ error: "Failed to get group members with submission status" });
    }
  }
);

export default router;
