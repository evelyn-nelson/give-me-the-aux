import {
  PrismaClient,
  RoundStatus,
  PlaylistType,
  NotificationType,
} from "@prisma/client";
import * as cron from "node-cron";
import { AuthService } from "./auth";
import { SpotifyService } from "./spotify";
import { sendToRoundMembers } from "./notifications";

const prisma = new PrismaClient();

export interface RoundManagementConfig {
  // How often to run round management (cron expression)
  schedule: string;
  // Whether to log round management operations
  enableLogging: boolean;
  // Whether to run round management on server start
  runOnStartup: boolean;
}

export class RoundManagementService {
  private static managementJob: cron.ScheduledTask | null = null;
  private static config: RoundManagementConfig = {
    schedule: "0 * * * *", // Every hour at minute 0
    enableLogging: true,
    runOnStartup: true,
  };

  /**
   * Configure the round management service
   */
  static configure(config: Partial<RoundManagementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Advance round stages and finalize votes
   */
  static async processRounds(): Promise<{
    roundsAdvancedToSubmission: number;
    roundsAdvancedToVoting: number;
    roundsAdvancedToCompleted: number;
    votesFinalized: number;
    totalOperations: number;
  }> {
    try {
      const now = new Date();
      let roundsAdvancedToSubmission = 0;
      let roundsAdvancedToVoting = 0;
      let roundsAdvancedToCompleted = 0;
      let votesFinalized = 0;

      // Track the rounds that transitioned to VOTING so we can create playlists after the transaction
      let votingRoundIds: string[] = [];

      // Use a transaction to ensure consistency
      await prisma.$transaction(async (tx) => {
        // 0. Notifications: SUBMISSION_ENDING_SOON (1 hour before votingStartDate)
        const submissionEndingSoon = await tx.round.findMany({
          where: {
            status: RoundStatus.SUBMISSION,
            votingStartDate: {
              lte: new Date(now.getTime() + 60 * 60 * 1000),
              gt: now,
            },
          },
          select: { id: true },
        });
        for (const r of submissionEndingSoon) {
          const alreadyExists = await tx.notificationEvent.findFirst({
            where: {
              roundId: r.id,
              type: NotificationType.SUBMISSION_ENDING_SOON,
            },
          });
          if (!alreadyExists) {
            await tx.notificationEvent.create({
              data: {
                roundId: r.id,
                type: NotificationType.SUBMISSION_ENDING_SOON,
              },
            });
          }
        }

        // 1. Advance rounds from INACTIVE to SUBMISSION
        const roundsToSubmission = await tx.round.updateMany({
          where: {
            status: RoundStatus.INACTIVE,
            startDate: {
              lte: now,
            },
          },
          data: {
            status: RoundStatus.SUBMISSION,
          },
        });
        roundsAdvancedToSubmission = roundsToSubmission.count;

        // 2. Advance rounds from SUBMISSION to VOTING
        const roundsNeedingVoting = await tx.round.findMany({
          where: {
            status: RoundStatus.SUBMISSION,
            votingStartDate: { lte: now },
          },
          include: {
            group: true,
            submissions: true,
          },
        });
        if (roundsNeedingVoting.length > 0) {
          const updateResult = await tx.round.updateMany({
            where: { id: { in: roundsNeedingVoting.map((r) => r.id) } },
            data: { status: RoundStatus.VOTING },
          });
          roundsAdvancedToVoting = updateResult.count;
          votingRoundIds = roundsNeedingVoting.map((r) => r.id);

          // Record VOTING_STARTED events
          for (const r of roundsNeedingVoting) {
            const exists = await tx.notificationEvent.findFirst({
              where: { roundId: r.id, type: NotificationType.VOTING_STARTED },
            });
            if (!exists) {
              await tx.notificationEvent.create({
                data: { roundId: r.id, type: NotificationType.VOTING_STARTED },
              });
            }
          }
        }

        // 3. Advance rounds from VOTING to COMPLETED
        const roundsToCompleted = await tx.round.updateMany({
          where: {
            status: RoundStatus.VOTING,
            endDate: {
              lte: now,
            },
          },
          data: {
            status: RoundStatus.COMPLETED,
          },
        });
        roundsAdvancedToCompleted = roundsToCompleted.count;

        // Record VOTING_ENDED for rounds that just completed
        const justCompleted = await tx.round.findMany({
          where: { status: RoundStatus.COMPLETED, endDate: { lte: now } },
          select: { id: true },
        });
        for (const r of justCompleted) {
          const existing = await tx.notificationEvent.findFirst({
            where: { roundId: r.id, type: NotificationType.VOTING_ENDED },
          });
          if (!existing) {
            await tx.notificationEvent.create({
              data: { roundId: r.id, type: NotificationType.VOTING_ENDED },
            });
          }
        }

        // 4. Finalize all non-finalized votes
        const finalizedVotes = await tx.vote.updateMany({
          where: {
            isFinalized: false,
          },
          data: {
            isFinalized: true,
          },
        });
        votesFinalized = finalizedVotes.count;
      });

      // Create Spotify playlists for rounds that just transitioned to VOTING
      if (votingRoundIds.length > 0) {
        const rounds = await prisma.round.findMany({
          where: { id: { in: votingRoundIds } },
          include: {
            group: { include: { admin: true } },
            submissions: true,
          },
        });

        for (const round of rounds) {
          try {
            const ownerUserId = round.group.adminId; // default owner is the group admin
            const owner = await AuthService.getUserWithValidToken(ownerUserId);
            if (!owner || !owner.spotifyAccessToken) {
              console.warn(
                `[Round Management] Skipping playlist creation for round ${round.id} - missing admin Spotify token`
              );
              continue;
            }

            const spotify = new SpotifyService(owner.spotifyAccessToken);
            const playlistName = `${round.group.name} · ${round.theme}`;
            const description = `Give Me The Aux – Round playlist for "${round.theme}"`;

            const created = await spotify.createPlaylist(
              owner.spotifyId,
              playlistName,
              description,
              false
            );

            // Persist a playlist record and attach to round/group
            const trackUris = round.submissions.map(
              (s) => `spotify:track:${s.spotifyTrackId}`
            );
            if (trackUris.length > 0) {
              await spotify.addTracksToPlaylist(created.id, trackUris);
            }
            const dbPlaylist = await prisma.playlist.create({
              data: {
                name: playlistName,
                userId: owner.id,
                groupId: round.groupId,
                roundId: round.id,
                type: PlaylistType.ROUND_ALL,
                isPublic: false,
                spotifyPlaylistId: created.id,
                spotifyUrl: created.external_urls?.spotify || null,
              },
            });

            if (round.submissions.length > 0) {
              await prisma.playlistItem.createMany({
                data: round.submissions.map((s, index) => ({
                  playlistId: dbPlaylist.id,
                  spotifyTrackId: s.spotifyTrackId,
                  trackName: s.trackName,
                  artistName: s.artistName,
                  albumName: s.albumName,
                  imageUrl: s.imageUrl,
                  order: index + 1,
                })),
              });
            }

            if (this.config.enableLogging) {
              console.log(
                `[Round Management] Created Spotify playlist ${created.id} for round ${round.id}`
              );
            }
          } catch (err) {
            console.error(
              `[Round Management] Failed to create playlist for round ${round.id}:`,
              err
            );
          }
        }
      }

      // Send notifications OUTSIDE the transaction
      // SUBMISSION_ENDING_SOON (unsent events only)
      const submissionSoonEvents = await prisma.notificationEvent.findMany({
        where: { type: NotificationType.SUBMISSION_ENDING_SOON, sentAt: null },
        include: { round: { include: { group: true } } },
      });
      for (const ev of submissionSoonEvents) {
        await sendToRoundMembers(ev.roundId, {
          title: `${ev.round.group.name}: Submissions closing soon`,
          body: `"${ev.round.theme}" submissions end in 1 hour. Get yours in!`,
          data: {
            roundId: ev.roundId,
            groupId: ev.round.group.id,
            type: ev.type,
          },
        });
        await prisma.notificationEvent.update({
          where: { id: ev.id },
          data: { sentAt: new Date() },
        });
      }

      // VOTING_STARTED (unsent events only)
      const votingStartedEvents = await prisma.notificationEvent.findMany({
        where: { type: NotificationType.VOTING_STARTED, sentAt: null },
        include: { round: { include: { group: true } } },
      });
      for (const ev of votingStartedEvents) {
        await sendToRoundMembers(ev.roundId, {
          title: `${ev.round.group.name}: Voting started`,
          body: `Round "${ev.round.theme}" is open for voting now!`,
          data: {
            roundId: ev.roundId,
            groupId: ev.round.group.id,
            type: ev.type,
          },
        });
        await prisma.notificationEvent.update({
          where: { id: ev.id },
          data: { sentAt: new Date() },
        });
      }

      // VOTING_ENDING_SOON: 1 hour before endDate (create event if missing, then send + mark)
      const votingEndingSoon = await prisma.round.findMany({
        where: {
          status: RoundStatus.VOTING,
          endDate: { lte: new Date(now.getTime() + 60 * 60 * 1000), gt: now },
        },
        select: {
          id: true,
          theme: true,
          group: { select: { id: true, name: true } },
        },
      });
      for (const r of votingEndingSoon) {
        const ev = await prisma.notificationEvent.upsert({
          where: {
            roundId_type: {
              roundId: r.id,
              type: NotificationType.VOTING_ENDING_SOON,
            },
          },
          create: { roundId: r.id, type: NotificationType.VOTING_ENDING_SOON },
          update: {},
        });
        if (!ev.sentAt) {
          await sendToRoundMembers(r.id, {
            title: `Voting closing soon`,
            body: `"${r.theme}" voting ends in 1 hour—cast your votes!`,
            data: {
              roundId: r.id,
              groupId: r.group.id,
              type: NotificationType.VOTING_ENDING_SOON,
            },
          });
          await prisma.notificationEvent.update({
            where: { id: ev.id },
            data: { sentAt: new Date() },
          });
        }
      }

      // VOTING_ENDED notifications (unsent events only)
      const votingEndedToSend = await prisma.notificationEvent.findMany({
        where: { type: NotificationType.VOTING_ENDED, sentAt: null },
        include: { round: { include: { group: true } } },
      });
      for (const ev of votingEndedToSend) {
        await sendToRoundMembers(ev.roundId, {
          title: `${ev.round.group.name}: Voting ended`,
          body: `Round "${ev.round.theme}" has ended. Check results soon!`,
          data: {
            roundId: ev.roundId,
            groupId: ev.round.group.id,
            type: ev.type,
          },
        });
        await prisma.notificationEvent.update({
          where: { id: ev.id },
          data: { sentAt: new Date() },
        });
      }

      const totalOperations =
        roundsAdvancedToSubmission +
        roundsAdvancedToVoting +
        roundsAdvancedToCompleted +
        votesFinalized;

      if (this.config.enableLogging && totalOperations > 0) {
        console.log(
          `[Round Management] Advanced ${roundsAdvancedToSubmission} rounds to SUBMISSION, ${roundsAdvancedToVoting} rounds to VOTING, ${roundsAdvancedToCompleted} rounds to COMPLETED, finalized ${votesFinalized} votes`
        );
      }

      return {
        roundsAdvancedToSubmission,
        roundsAdvancedToVoting,
        roundsAdvancedToCompleted,
        votesFinalized,
        totalOperations,
      };
    } catch (error) {
      console.error("[Round Management] Error processing rounds:", error);
      throw error;
    }
  }

  /**
   * Get statistics about rounds and votes
   */
  static async getRoundStats(): Promise<{
    totalRounds: number;
    submissionRounds: number;
    votingRounds: number;
    completedRounds: number;
    inactiveRounds: number;
    unfinalizedVotes: number;
    roundsReadyToStart: number;
    roundsReadyForVoting: number;
    roundsReadyForCompletion: number;
  }> {
    try {
      const now = new Date();

      const [
        total,
        submission,
        voting,
        completed,
        inactive,
        unfinalizedVotes,
        readyToStart,
        readyForVoting,
        readyForCompletion,
      ] = await Promise.all([
        prisma.round.count(),
        prisma.round.count({
          where: { status: RoundStatus.SUBMISSION },
        }),
        prisma.round.count({
          where: { status: RoundStatus.VOTING },
        }),
        prisma.round.count({
          where: { status: RoundStatus.COMPLETED },
        }),
        prisma.round.count({
          where: { status: RoundStatus.INACTIVE },
        }),
        prisma.vote.count({
          where: { isFinalized: false },
        }),
        prisma.round.count({
          where: {
            status: RoundStatus.INACTIVE,
            startDate: {
              lte: now,
            },
          },
        }),
        prisma.round.count({
          where: {
            status: RoundStatus.SUBMISSION,
            votingStartDate: {
              lte: now,
            },
          },
        }),
        prisma.round.count({
          where: {
            status: RoundStatus.VOTING,
            endDate: {
              lte: now,
            },
          },
        }),
      ]);

      return {
        totalRounds: total,
        submissionRounds: submission,
        votingRounds: voting,
        completedRounds: completed,
        inactiveRounds: inactive,
        unfinalizedVotes,
        roundsReadyToStart: readyToStart,
        roundsReadyForVoting: readyForVoting,
        roundsReadyForCompletion: readyForCompletion,
      };
    } catch (error) {
      console.error("[Round Management] Error getting round stats:", error);
      throw error;
    }
  }

  /**
   * Start the cron job to periodically manage rounds
   */
  static startManagementJob(): void {
    if (this.managementJob) {
      console.log("[Round Management] Management job already running");
      return;
    }

    this.managementJob = cron.schedule(this.config.schedule, async () => {
      if (this.config.enableLogging) {
        console.log(
          "[Round Management] Starting scheduled round processing..."
        );
      }

      try {
        const result = await this.processRounds();
        if (this.config.enableLogging && result.totalOperations > 0) {
          console.log(
            `[Round Management] Completed: ${result.roundsAdvancedToSubmission} rounds to submission, ${result.roundsAdvancedToVoting} rounds to voting, ${result.roundsAdvancedToCompleted} rounds completed, ${result.votesFinalized} votes finalized`
          );
        }
      } catch (error) {
        console.error("[Round Management] Scheduled processing failed:", error);
      }
    });

    if (this.config.enableLogging) {
      console.log(
        `[Round Management] Scheduled management job started (${this.config.schedule})`
      );
    }

    // Run processing on startup if configured
    if (this.config.runOnStartup) {
      this.runInitialProcessing();
    }
  }

  /**
   * Run initial round processing on server startup
   */
  private static async runInitialProcessing(): Promise<void> {
    try {
      if (this.config.enableLogging) {
        console.log(
          "[Round Management] Running initial processing on startup..."
        );
      }

      const result = await this.processRounds();
      if (this.config.enableLogging) {
        console.log(
          `[Round Management] Initial processing completed: ${result.totalOperations} operations performed`
        );
      }
    } catch (error) {
      console.error("[Round Management] Initial processing failed:", error);
    }
  }

  /**
   * Stop the cron job
   */
  static stopManagementJob(): void {
    if (this.managementJob) {
      this.managementJob.stop();
      this.managementJob = null;
      if (this.config.enableLogging) {
        console.log("[Round Management] Management job stopped");
      }
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): RoundManagementConfig {
    return { ...this.config };
  }
}
