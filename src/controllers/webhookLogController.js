import WebhookLogService from '../services/webhookLogService.js';
import WebhookLog from '../models/WebhookLog.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

/**
 * Get webhook logs with filtering and pagination
 */
export const getWebhookLogs = catchAsync(async (req, res, next) => {
  const {
    eventType,
    status,
    stripeCustomerId,
    userId,
    dateFrom,
    dateTo,
    signatureVerified,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filters = {
    eventType,
    status,
    stripeCustomerId,
    userId,
    dateFrom,
    dateTo,
    signatureVerified:
      signatureVerified !== undefined
        ? signatureVerified === 'true'
        : undefined,
  };

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder,
  };

  const result = await WebhookLogService.getWebhookLogs(filters, pagination);

  res.status(200).json({
    status: 'success',
    message: 'Webhook logs retrieved successfully',
    data: result,
  });
});

/**
 * Get webhook statistics
 */
export const getWebhookStats = catchAsync(async (req, res, next) => {
  const { dateFrom, dateTo } = req.query;

  const filters = {
    dateFrom,
    dateTo,
  };

  const stats = await WebhookLogService.getWebhookStats(filters);

  res.status(200).json({
    status: 'success',
    message: 'Webhook statistics retrieved successfully',
    data: stats,
  });
});

/**
 * Get a specific webhook log by ID
 */
export const getWebhookLog = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const webhookLog = await WebhookLog.findById(id)
    .populate('userId', 'email fullName')
    .populate('subscriptionId', 'plan status');

  if (!webhookLog) {
    return next(new AppError('Webhook log not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Webhook log retrieved successfully',
    data: {
      webhookLog,
    },
  });
});

/**
 * Retry a failed webhook
 */
export const retryWebhook = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const webhookLog = await WebhookLogService.retryWebhook(id);

  res.status(200).json({
    status: 'success',
    message: 'Webhook retry initiated successfully',
    data: {
      webhookLog,
    },
  });
});

/**
 * Cleanup old webhook logs
 */
export const cleanupOldLogs = catchAsync(async (req, res, next) => {
  const { daysOld = 30 } = req.query;

  const result = await WebhookLogService.cleanupOldLogs(parseInt(daysOld));

  res.status(200).json({
    status: 'success',
    message: `Cleaned up ${result.deletedCount} old webhook logs`,
    data: {
      deletedCount: result.deletedCount,
    },
  });
});

/**
 * Get webhook logs for a specific user
 */
export const getUserWebhookLogs = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const {
    eventType,
    status,
    dateFrom,
    dateTo,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filters = {
    userId,
    eventType,
    status,
    dateFrom,
    dateTo,
  };

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder,
  };

  const result = await WebhookLogService.getWebhookLogs(filters, pagination);

  res.status(200).json({
    status: 'success',
    message: 'User webhook logs retrieved successfully',
    data: result,
  });
});

/**
 * Get webhook logs for a specific Stripe customer
 */
export const getCustomerWebhookLogs = catchAsync(async (req, res, next) => {
  const { customerId } = req.params;
  const {
    eventType,
    status,
    dateFrom,
    dateTo,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filters = {
    stripeCustomerId: customerId,
    eventType,
    status,
    dateFrom,
    dateTo,
  };

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder,
  };

  const result = await WebhookLogService.getWebhookLogs(filters, pagination);

  res.status(200).json({
    status: 'success',
    message: 'Customer webhook logs retrieved successfully',
    data: result,
  });
});

/**
 * Get webhook event distribution (for analytics)
 */
export const getEventDistribution = catchAsync(async (req, res, next) => {
  const { dateFrom, dateTo } = req.query;

  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.createdAt = {};
    if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
  }

  const distribution = await WebhookLog.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          eventType: '$eventType',
          status: '$status',
        },
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        lastOccurrence: { $max: '$createdAt' },
      },
    },
    {
      $group: {
        _id: '$_id.eventType',
        totalCount: { $sum: '$count' },
        statusBreakdown: {
          $push: {
            status: '$_id.status',
            count: '$count',
            avgProcessingTime: '$avgProcessingTime',
          },
        },
        lastOccurrence: { $max: '$lastOccurrence' },
      },
    },
    { $sort: { totalCount: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    message: 'Webhook event distribution retrieved successfully',
    data: {
      distribution,
    },
  });
});

/**
 * Get webhook processing timeline (for monitoring)
 */
export const getProcessingTimeline = catchAsync(async (req, res, next) => {
  const { dateFrom, dateTo, interval = 'hour' } = req.query;

  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.createdAt = {};
    if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
  }

  // Group by time interval
  let groupId;
  switch (interval) {
    case 'minute':
      groupId = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' },
        minute: { $minute: '$createdAt' },
      };
      break;
    case 'hour':
      groupId = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' },
      };
      break;
    case 'day':
      groupId = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
      break;
    default:
      groupId = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' },
      };
  }

  const timeline = await WebhookLog.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupId,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        processing: {
          $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] },
        },
        avgProcessingTime: { $avg: '$processingTime' },
        maxProcessingTime: { $max: '$processingTime' },
        timestamp: { $min: '$createdAt' },
      },
    },
    { $sort: { timestamp: 1 } },
  ]);

  res.status(200).json({
    status: 'success',
    message: 'Webhook processing timeline retrieved successfully',
    data: {
      timeline,
      interval,
    },
  });
});
