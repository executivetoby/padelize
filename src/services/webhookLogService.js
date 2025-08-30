import WebhookLog from '../models/WebhookLog.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

class WebhookLogService {
  /**
   * Log incoming webhook request
   * @param {Object} req - Express request object
   * @param {Object} stripeEvent - Parsed Stripe event object
   * @param {boolean} signatureVerified - Whether Stripe signature was verified
   * @returns {Promise<WebhookLog>} - Created webhook log
   */
  static async logIncomingWebhook(
    req,
    stripeEvent = null,
    signatureVerified = false
  ) {
    try {
      const webhookData = {
        method: req.method,
        headers: req.headers,
        rawBody: JSON.stringify(req.body),
        sourceIp: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        signatureVerified,
        status: 'pending',
      };

      // If we have a parsed Stripe event, extract information
      if (stripeEvent) {
        webhookData.stripeEventId = stripeEvent.id;
        webhookData.eventType = stripeEvent.type;
        webhookData.data = stripeEvent.data;

        // Extract customer and subscription IDs
        if (stripeEvent.data && stripeEvent.data.object) {
          const object = stripeEvent.data.object;

          if (object.customer) {
            webhookData.stripeCustomerId = object.customer;
          }

          if (object.subscription) {
            webhookData.stripeSubscriptionId = object.subscription;
          }

          // For subscription objects
          if (object.object === 'subscription') {
            webhookData.stripeCustomerId = object.customer;
            webhookData.stripeSubscriptionId = object.id;
          }

          // For invoice objects
          if (object.object === 'invoice') {
            webhookData.stripeCustomerId = object.customer;
            webhookData.stripeSubscriptionId = object.subscription;
          }
        }

        // Try to find related user and subscription
        if (webhookData.stripeCustomerId) {
          const user = await User.findOne({
            stripeCustomerId: webhookData.stripeCustomerId,
          });
          if (user) {
            webhookData.userId = user._id;

            // Find associated subscription
            const subscription = await Subscription.findOne({
              user: user._id,
              status: 'active',
            });
            if (subscription) {
              webhookData.subscriptionId = subscription._id;
            }
          }
        }
      } else {
        // If no parsed event, try to extract from raw body
        try {
          const rawEvent = JSON.parse(webhookData.rawBody);
          if (rawEvent.id && rawEvent.type) {
            webhookData.stripeEventId = rawEvent.id;
            webhookData.eventType = rawEvent.type;
            webhookData.data = rawEvent.data || rawEvent;
          }
        } catch (parseError) {
          console.warn('Could not parse webhook raw body:', parseError.message);
        }
      }

      const webhookLog = await WebhookLog.create(webhookData);
      console.log(
        `Webhook logged: ${webhookLog.stripeEventId} (${webhookLog.eventType})`
      );

      return webhookLog;
    } catch (error) {
      console.error('Error logging webhook:', error);
      throw new AppError('Failed to log webhook', 500);
    }
  }

  /**
   * Update webhook log with processing status
   * @param {string} webhookLogId - Webhook log ID
   * @param {string} status - New status ('processing', 'completed', 'failed', 'ignored')
   * @param {Object} options - Additional options
   * @returns {Promise<WebhookLog>} - Updated webhook log
   */
  static async updateWebhookStatus(webhookLogId, status, options = {}) {
    try {
      const webhookLog = await WebhookLog.findById(webhookLogId);
      if (!webhookLog) {
        throw new AppError('Webhook log not found', 404);
      }

      webhookLog.status = status;

      if (options.responseStatus) {
        webhookLog.responseStatus = options.responseStatus;
      }

      if (options.responseBody) {
        webhookLog.responseBody = options.responseBody;
      }

      if (options.errorMessage) {
        webhookLog.errorMessage = options.errorMessage;
      }

      if (options.errorStack) {
        webhookLog.errorStack = options.errorStack;
      }

      if (options.metadata) {
        webhookLog.metadata = { ...webhookLog.metadata, ...options.metadata };
      }

      await webhookLog.save();
      return webhookLog;
    } catch (error) {
      console.error('Error updating webhook status:', error);
      throw error;
    }
  }

  /**
   * Mark webhook as completed
   * @param {string} webhookLogId - Webhook log ID
   * @param {number} responseStatus - HTTP response status
   * @param {Object} responseBody - Response body
   * @param {number} processingTime - Processing time in ms
   * @returns {Promise<WebhookLog>} - Updated webhook log
   */
  static async markWebhookCompleted(
    webhookLogId,
    responseStatus = 200,
    responseBody = null,
    processingTime = null
  ) {
    try {
      const webhookLog = await WebhookLog.findById(webhookLogId);
      if (!webhookLog) {
        throw new AppError('Webhook log not found', 404);
      }

      return await webhookLog.markCompleted(
        responseStatus,
        responseBody,
        processingTime
      );
    } catch (error) {
      console.error('Error marking webhook as completed:', error);
      throw error;
    }
  }

  /**
   * Mark webhook as failed
   * @param {string} webhookLogId - Webhook log ID
   * @param {string} errorMessage - Error message
   * @param {string} errorStack - Error stack trace
   * @param {number} responseStatus - HTTP response status
   * @returns {Promise<WebhookLog>} - Updated webhook log
   */
  static async markWebhookFailed(
    webhookLogId,
    errorMessage,
    errorStack = null,
    responseStatus = 500
  ) {
    try {
      const webhookLog = await WebhookLog.findById(webhookLogId);
      if (!webhookLog) {
        throw new AppError('Webhook log not found', 404);
      }

      return await webhookLog.markFailed(
        errorMessage,
        errorStack,
        responseStatus
      );
    } catch (error) {
      console.error('Error marking webhook as failed:', error);
      throw error;
    }
  }

  /**
   * Get webhook logs with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Webhook logs with metadata
   */
  static async getWebhookLogs(filters = {}, pagination = {}) {
    try {
      const {
        eventType,
        status,
        stripeCustomerId,
        userId,
        dateFrom,
        dateTo,
        signatureVerified,
      } = filters;

      const {
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = pagination;

      // Build query
      const query = {};

      if (eventType) query.eventType = eventType;
      if (status) query.status = status;
      if (stripeCustomerId) query.stripeCustomerId = stripeCustomerId;
      if (userId) query.userId = userId;
      if (signatureVerified !== undefined)
        query.signatureVerified = signatureVerified;

      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Execute query
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [logs, total] = await Promise.all([
        WebhookLog.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('userId', 'email fullName')
          .populate('subscriptionId', 'plan status'),
        WebhookLog.countDocuments(query),
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error getting webhook logs:', error);
      throw error;
    }
  }

  /**
   * Get webhook statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Webhook statistics
   */
  static async getWebhookStats(filters = {}) {
    try {
      const { dateFrom, dateTo } = filters;

      const matchStage = {};
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
        if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
      }

      const stats = await WebhookLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            processing: {
              $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] },
            },
            ignored: {
              $sum: { $cond: [{ $eq: ['$status', 'ignored'] }, 1, 0] },
            },
            signatureVerified: {
              $sum: { $cond: ['$signatureVerified', 1, 0] },
            },
            avgProcessingTime: { $avg: '$processingTime' },
          },
        },
      ]);

      const eventTypeStats = await WebhookLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          },
        },
        { $sort: { count: -1 } },
      ]);

      return {
        overview: stats[0] || {
          total: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          processing: 0,
          ignored: 0,
          signatureVerified: 0,
          avgProcessingTime: 0,
        },
        byEventType: eventTypeStats,
      };
    } catch (error) {
      console.error('Error getting webhook stats:', error);
      throw error;
    }
  }

  /**
   * Retry failed webhooks
   * @param {string} webhookLogId - Specific webhook log ID to retry
   * @returns {Promise<WebhookLog>} - Updated webhook log
   */
  static async retryWebhook(webhookLogId) {
    try {
      const webhookLog = await WebhookLog.findById(webhookLogId);
      if (!webhookLog) {
        throw new AppError('Webhook log not found', 404);
      }

      if (!webhookLog.canRetry) {
        throw new AppError(
          'Webhook cannot be retried (max retries reached)',
          400
        );
      }

      await webhookLog.incrementRetryCount();
      return webhookLog;
    } catch (error) {
      console.error('Error retrying webhook:', error);
      throw error;
    }
  }

  /**
   * Clean up old webhook logs
   * @param {number} daysOld - Days old threshold
   * @returns {Promise<Object>} - Cleanup result
   */
  static async cleanupOldLogs(daysOld = 30) {
    try {
      const result = await WebhookLog.cleanupOldLogs(daysOld);
      console.log(`Cleaned up ${result.deletedCount} old webhook logs`);
      return result;
    } catch (error) {
      console.error('Error cleaning up webhook logs:', error);
      throw error;
    }
  }
}

export default WebhookLogService;
