import mongoose from 'mongoose';

const webhookLogSchema = new mongoose.Schema(
  {
    // Stripe webhook event ID
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Event type (e.g., 'customer.subscription.updated', 'invoice.payment_succeeded')
    eventType: {
      type: String,
      required: true,
      index: true,
    },

    // Webhook processing status
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed', 'ignored'],
      default: 'pending',
      index: true,
    },

    // HTTP method used
    method: {
      type: String,
      required: true,
      default: 'POST',
    },

    // Request headers
    headers: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Raw request body
    rawBody: {
      type: String,
      required: true,
    },

    // Parsed webhook data
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Response status code
    responseStatus: {
      type: Number,
      index: true,
    },

    // Response body
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Processing duration in milliseconds
    processingTime: {
      type: Number,
    },

    // Error message if processing failed
    errorMessage: {
      type: String,
    },

    // Error stack trace
    errorStack: {
      type: String,
    },

    // Number of retry attempts
    retryCount: {
      type: Number,
      default: 0,
    },

    // Maximum retry attempts allowed
    maxRetries: {
      type: Number,
      default: 3,
    },

    // Next retry attempt time
    nextRetryAt: {
      type: Date,
    },

    // User ID if the webhook is related to a specific user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Subscription ID if the webhook is related to a subscription
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },

    // Stripe customer ID
    stripeCustomerId: {
      type: String,
      index: true,
    },

    // Stripe subscription ID
    stripeSubscriptionId: {
      type: String,
      index: true,
    },

    // Source IP address
    sourceIp: {
      type: String,
    },

    // User agent
    userAgent: {
      type: String,
    },

    // Stripe signature verification status
    signatureVerified: {
      type: Boolean,
      default: false,
    },

    // Processing started at
    processingStartedAt: {
      type: Date,
    },

    // Processing completed at
    processingCompletedAt: {
      type: Date,
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Environment (development, staging, production)
    environment: {
      type: String,
      default: process.env.NODE_ENV || 'development',
    },
  },
  {
    timestamps: true,
    collection: 'webhook_logs',
  }
);

// Indexes for better performance
webhookLogSchema.index({ eventType: 1, status: 1 });
webhookLogSchema.index({ stripeCustomerId: 1, eventType: 1 });
webhookLogSchema.index({ createdAt: -1 });
webhookLogSchema.index({ status: 1, nextRetryAt: 1 });

// Virtual for checking if webhook can be retried
webhookLogSchema.virtual('canRetry').get(function () {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
});

// Virtual for checking if webhook is expired (older than 7 days)
webhookLogSchema.virtual('isExpired').get(function () {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.createdAt < sevenDaysAgo;
});

// Method to increment retry count
webhookLogSchema.methods.incrementRetryCount = function () {
  this.retryCount += 1;
  if (this.retryCount >= this.maxRetries) {
    this.status = 'failed';
    this.nextRetryAt = null;
  } else {
    // Exponential backoff: 1 min, 5 min, 30 min
    const backoffMinutes = Math.pow(5, this.retryCount);
    this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    this.status = 'pending';
  }
  return this.save();
};

// Method to mark as completed
webhookLogSchema.methods.markCompleted = function (
  responseStatus = 200,
  responseBody = null,
  processingTime = null
) {
  this.status = 'completed';
  this.responseStatus = responseStatus;
  this.responseBody = responseBody;
  this.processingTime = processingTime;
  this.processingCompletedAt = new Date();
  return this.save();
};

// Method to mark as failed
webhookLogSchema.methods.markFailed = function (
  errorMessage,
  errorStack = null,
  responseStatus = null
) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.errorStack = errorStack;
  this.responseStatus = responseStatus;
  this.processingCompletedAt = new Date();
  return this.save();
};

// Static method to find webhooks that need retry
webhookLogSchema.statics.findPendingRetries = function () {
  return this.find({
    status: 'pending',
    retryCount: { $gt: 0 },
    nextRetryAt: { $lte: new Date() },
  });
};

// Static method to find failed webhooks within retry limit
webhookLogSchema.statics.findRetryableWebhooks = function () {
  return this.find({
    status: 'failed',
    $expr: { $lt: ['$retryCount', '$maxRetries'] },
  });
};

// Static method to cleanup old webhook logs
webhookLogSchema.statics.cleanupOldLogs = function (daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['completed', 'ignored'] },
  });
};

// Pre-save middleware to set processing time
webhookLogSchema.pre('save', function (next) {
  if (
    this.isModified('status') &&
    this.status === 'processing' &&
    !this.processingStartedAt
  ) {
    this.processingStartedAt = new Date();
  }

  if (
    this.isModified('status') &&
    ['completed', 'failed'].includes(this.status) &&
    !this.processingCompletedAt
  ) {
    this.processingCompletedAt = new Date();

    // Calculate processing time
    if (this.processingStartedAt) {
      this.processingTime =
        this.processingCompletedAt - this.processingStartedAt;
    }
  }

  next();
});

const WebhookLog = mongoose.model('WebhookLog', webhookLogSchema);

export default WebhookLog;
