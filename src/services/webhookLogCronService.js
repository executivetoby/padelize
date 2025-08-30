import cron from 'node-cron';
import WebhookLogService from './webhookLogService.js';

/**
 * Webhook Log Maintenance Cron Service
 * Handles automated cleanup and maintenance tasks for webhook logs
 */
class WebhookLogCronService {
  static isRunning = false;

  /**
   * Initialize and start all webhook log cron jobs
   */
  static async initialize() {
    if (this.isRunning) {
      console.log('Webhook log cron service is already running');
      return;
    }

    console.log('🕐 Initializing Webhook Log Cron Service...');

    // Start cleanup job - runs daily at 2 AM
    this.startCleanupJob();

    // Start statistics job - runs every hour
    this.startStatsJob();

    this.isRunning = true;
    console.log('✅ Webhook Log Cron Service initialized successfully');
  }

  /**
   * Daily cleanup job to remove old webhook logs
   * Runs every day at 2:00 AM
   */
  static startCleanupJob() {
    cron.schedule(
      '0 2 * * *',
      async () => {
        try {
          console.log('🧹 Starting daily webhook log cleanup...');

          // Clean up logs older than 30 days
          const result = await WebhookLogService.cleanupOldLogs(30);

          console.log(
            `✅ Webhook log cleanup completed - removed ${result.deletedCount} old logs`
          );

          // Log cleanup statistics
          const stats = await WebhookLogService.getWebhookStats();
          console.log(`📊 Current webhook log statistics:`, {
            total: stats.overview.total,
            completed: stats.overview.completed,
            failed: stats.overview.failed,
            pending: stats.overview.pending,
          });
        } catch (error) {
          console.error('❌ Error during webhook log cleanup:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    );

    console.log('✅ Webhook log cleanup job scheduled (daily at 2 AM UTC)');
  }

  /**
   * Hourly statistics job to monitor webhook health
   * Runs every hour at minute 0
   */
  static startStatsJob() {
    cron.schedule(
      '0 * * * *',
      async () => {
        try {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

          // Get statistics for the last hour
          const stats = await WebhookLogService.getWebhookStats({
            dateFrom: oneHourAgo.toISOString(),
          });

          const { overview } = stats;

          // Log hourly stats
          console.log(`📊 Hourly webhook stats:`, {
            total: overview.total,
            completed: overview.completed,
            failed: overview.failed,
            pending: overview.pending,
            avgProcessingTime: Math.round(overview.avgProcessingTime || 0),
          });

          // Alert if high failure rate
          if (overview.total > 0) {
            const failureRate = (overview.failed / overview.total) * 100;
            if (failureRate > 10) {
              // More than 10% failure rate
              console.warn(
                `⚠️ High webhook failure rate detected: ${failureRate.toFixed(
                  2
                )}%`
              );
            }

            // Alert if high processing time
            if (overview.avgProcessingTime > 5000) {
              // More than 5 seconds
              console.warn(
                `⚠️ High webhook processing time detected: ${Math.round(
                  overview.avgProcessingTime
                )}ms`
              );
            }
          }

          // Alert if pending webhooks are stuck
          if (overview.pending > 5) {
            console.warn(
              `⚠️ Multiple pending webhooks detected: ${overview.pending}`
            );
          }
        } catch (error) {
          console.error('❌ Error during webhook stats collection:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    );

    console.log('✅ Webhook log statistics job scheduled (hourly)');
  }

  /**
   * Manual cleanup trigger
   * @param {number} daysOld - Days old threshold for cleanup
   */
  static async manualCleanup(daysOld = 30) {
    try {
      console.log(
        `🧹 Starting manual webhook log cleanup (${daysOld} days)...`
      );

      const result = await WebhookLogService.cleanupOldLogs(daysOld);

      console.log(
        `✅ Manual cleanup completed - removed ${result.deletedCount} old logs`
      );

      return result;
    } catch (error) {
      console.error('❌ Error during manual webhook log cleanup:', error);
      throw error;
    }
  }

  /**
   * Get current webhook health status
   */
  static async getHealthStatus() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [hourlyStats, dailyStats] = await Promise.all([
        WebhookLogService.getWebhookStats({
          dateFrom: oneHourAgo.toISOString(),
        }),
        WebhookLogService.getWebhookStats({
          dateFrom: oneDayAgo.toISOString(),
        }),
      ]);

      const hourly = hourlyStats.overview;
      const daily = dailyStats.overview;

      // Calculate health indicators
      const hourlyFailureRate =
        hourly.total > 0 ? (hourly.failed / hourly.total) * 100 : 0;
      const dailyFailureRate =
        daily.total > 0 ? (daily.failed / daily.total) * 100 : 0;

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        hourly: {
          total: hourly.total,
          completed: hourly.completed,
          failed: hourly.failed,
          pending: hourly.pending,
          failureRate: parseFloat(hourlyFailureRate.toFixed(2)),
          avgProcessingTime: Math.round(hourly.avgProcessingTime || 0),
        },
        daily: {
          total: daily.total,
          completed: daily.completed,
          failed: daily.failed,
          pending: daily.pending,
          failureRate: parseFloat(dailyFailureRate.toFixed(2)),
          avgProcessingTime: Math.round(daily.avgProcessingTime || 0),
        },
        alerts: [],
      };

      // Determine overall health status
      if (hourlyFailureRate > 20 || dailyFailureRate > 15) {
        healthStatus.status = 'critical';
        healthStatus.alerts.push('High failure rate detected');
      } else if (hourlyFailureRate > 10 || dailyFailureRate > 10) {
        healthStatus.status = 'warning';
        healthStatus.alerts.push('Elevated failure rate');
      }

      if (hourly.avgProcessingTime > 10000 || daily.avgProcessingTime > 5000) {
        healthStatus.status =
          healthStatus.status === 'critical' ? 'critical' : 'warning';
        healthStatus.alerts.push('High processing time');
      }

      if (hourly.pending > 10 || daily.pending > 20) {
        healthStatus.status =
          healthStatus.status === 'critical' ? 'critical' : 'warning';
        healthStatus.alerts.push('Multiple pending webhooks');
      }

      return healthStatus;
    } catch (error) {
      console.error('❌ Error getting webhook health status:', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Stop all cron jobs
   */
  static stop() {
    if (this.isRunning) {
      console.log('🛑 Stopping Webhook Log Cron Service...');
      // Note: node-cron doesn't provide a direct way to stop specific jobs
      // In a production environment, you'd want to keep references to the tasks
      this.isRunning = false;
      console.log('✅ Webhook Log Cron Service stopped');
    }
  }
}

export default WebhookLogCronService;
