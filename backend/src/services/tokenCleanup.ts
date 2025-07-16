import { PrismaClient } from "@prisma/client";
import * as cron from "node-cron";

const prisma = new PrismaClient();

export interface CleanupConfig {
  // How often to run cleanup (cron expression)
  schedule: string;
  // How many days to keep revoked tokens before deletion
  revokedTokenRetentionDays: number;
  // Whether to log cleanup operations
  enableLogging: boolean;
  // Whether to run cleanup on server start
  runOnStartup: boolean;
}

export class TokenCleanupService {
  private static cleanupJob: cron.ScheduledTask | null = null;
  private static config: CleanupConfig = {
    schedule: "0 2 * * *", // Daily at 2:00 AM
    revokedTokenRetentionDays: 7,
    enableLogging: true,
    runOnStartup: true,
  };

  /**
   * Configure the cleanup service
   */
  static configure(config: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Prune expired and revoked refresh tokens from the database
   */
  static async pruneExpiredTokens(): Promise<{
    expiredTokensRemoved: number;
    revokedTokensRemoved: number;
    totalRemoved: number;
  }> {
    try {
      const now = new Date();

      // Delete expired tokens
      const expiredResult = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      // Delete revoked tokens that are older than retention period
      const retentionDate = new Date(
        now.getTime() -
          this.config.revokedTokenRetentionDays * 24 * 60 * 60 * 1000
      );
      const revokedResult = await prisma.refreshToken.deleteMany({
        where: {
          isRevoked: true,
          createdAt: {
            lt: retentionDate,
          },
        },
      });

      const totalRemoved = expiredResult.count + revokedResult.count;

      if (this.config.enableLogging && totalRemoved > 0) {
        console.log(
          `[Token Cleanup] Removed ${expiredResult.count} expired tokens and ${revokedResult.count} revoked tokens`
        );
      }

      return {
        expiredTokensRemoved: expiredResult.count,
        revokedTokensRemoved: revokedResult.count,
        totalRemoved,
      };
    } catch (error) {
      console.error("[Token Cleanup] Error pruning tokens:", error);
      throw error;
    }
  }

  /**
   * Get statistics about refresh tokens
   */
  static async getTokenStats(): Promise<{
    totalTokens: number;
    expiredTokens: number;
    revokedTokens: number;
    activeTokens: number;
    revokedTokensOlderThanRetention: number;
  }> {
    try {
      const now = new Date();
      const retentionDate = new Date(
        now.getTime() -
          this.config.revokedTokenRetentionDays * 24 * 60 * 60 * 1000
      );

      const [total, expired, revoked, active, oldRevoked] = await Promise.all([
        prisma.refreshToken.count(),
        prisma.refreshToken.count({
          where: {
            expiresAt: {
              lt: now,
            },
          },
        }),
        prisma.refreshToken.count({
          where: {
            isRevoked: true,
          },
        }),
        prisma.refreshToken.count({
          where: {
            expiresAt: {
              gte: now,
            },
            isRevoked: false,
          },
        }),
        prisma.refreshToken.count({
          where: {
            isRevoked: true,
            createdAt: {
              lt: retentionDate,
            },
          },
        }),
      ]);

      return {
        totalTokens: total,
        expiredTokens: expired,
        revokedTokens: revoked,
        activeTokens: active,
        revokedTokensOlderThanRetention: oldRevoked,
      };
    } catch (error) {
      console.error("[Token Cleanup] Error getting token stats:", error);
      throw error;
    }
  }

  /**
   * Start the cron job to periodically clean up tokens
   */
  static startCleanupJob(): void {
    if (this.cleanupJob) {
      console.log("[Token Cleanup] Cleanup job already running");
      return;
    }

    this.cleanupJob = cron.schedule(this.config.schedule, async () => {
      if (this.config.enableLogging) {
        console.log("[Token Cleanup] Starting scheduled cleanup...");
      }

      try {
        const result = await this.pruneExpiredTokens();
        if (this.config.enableLogging) {
          console.log(
            `[Token Cleanup] Completed: ${result.expiredTokensRemoved} expired, ${result.revokedTokensRemoved} revoked tokens removed`
          );
        }
      } catch (error) {
        console.error("[Token Cleanup] Scheduled cleanup failed:", error);
      }
    });

    if (this.config.enableLogging) {
      console.log(
        `[Token Cleanup] Scheduled cleanup job started (${this.config.schedule})`
      );
    }

    // Run cleanup on startup if configured
    if (this.config.runOnStartup) {
      this.runInitialCleanup();
    }
  }

  /**
   * Run initial cleanup on server startup
   */
  private static async runInitialCleanup(): Promise<void> {
    try {
      if (this.config.enableLogging) {
        console.log("[Token Cleanup] Running initial cleanup on startup...");
      }

      const result = await this.pruneExpiredTokens();
      if (this.config.enableLogging) {
        console.log(
          `[Token Cleanup] Initial cleanup completed: ${result.totalRemoved} tokens removed`
        );
      }
    } catch (error) {
      console.error("[Token Cleanup] Initial cleanup failed:", error);
    }
  }

  /**
   * Stop the cron job
   */
  static stopCleanupJob(): void {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
      if (this.config.enableLogging) {
        console.log("[Token Cleanup] Cleanup job stopped");
      }
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): CleanupConfig {
    return { ...this.config };
  }
}
