import { PrismaClient, RoundStatus } from "@prisma/client";
import * as cron from "node-cron";

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

      // Use a transaction to ensure consistency
      await prisma.$transaction(async (tx) => {
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
        const roundsToVoting = await tx.round.updateMany({
          where: {
            status: RoundStatus.SUBMISSION,
            votingStartDate: {
              lte: now,
            },
          },
          data: {
            status: RoundStatus.VOTING,
          },
        });
        roundsAdvancedToVoting = roundsToVoting.count;

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
