# Stripe Webhook Logging System

This document describes the comprehensive webhook logging system implemented for the Padelize application. The system provides robust logging, monitoring, and analytics for all Stripe webhook events.

## Overview

The webhook logging system captures, stores, and analyzes all incoming Stripe webhook events. It provides:

- **Complete audit trail** of all webhook events
- **Performance monitoring** and analytics
- **Error tracking** and retry functionality
- **Automated cleanup** and maintenance
- **Real-time health monitoring**

## Components

### 1. WebhookLog Model (`src/models/WebhookLog.js`)

The core data model that stores webhook event information:

```javascript
{
  // Basic webhook information
  stripeEventId: String,        // Stripe event ID (e.g., "evt_...")
  eventType: String,            // Event type (e.g., "customer.subscription.updated")
  status: String,               // 'pending', 'processing', 'completed', 'failed', 'ignored'

  // Request data
  method: String,               // HTTP method (usually POST)
  headers: Object,              // Request headers
  rawBody: String,              // Raw request body
  data: Object,                 // Parsed Stripe event data

  // Response data
  responseStatus: Number,       // HTTP response status
  responseBody: Object,         // Response body sent back to Stripe

  // Processing information
  processingTime: Number,       // Time taken to process (milliseconds)
  signatureVerified: Boolean,   // Whether Stripe signature was verified

  // Error tracking
  errorMessage: String,         // Error message if processing failed
  errorStack: String,           // Error stack trace

  // Retry logic
  retryCount: Number,           // Number of retry attempts
  lastRetryAt: Date,            // Last retry timestamp
  maxRetries: Number,           // Maximum retry attempts allowed

  // Associations
  userId: ObjectId,             // Associated user (if found)
  subscriptionId: ObjectId,     // Associated subscription (if found)
  stripeCustomerId: String,     // Stripe customer ID
  stripeSubscriptionId: String, // Stripe subscription ID

  // Metadata
  sourceIp: String,             // Source IP address
  userAgent: String,            // User agent header
  metadata: Object,             // Additional metadata

  // Timestamps
  createdAt: Date,              // When webhook was received
  updatedAt: Date               // Last update time
}
```

### 2. WebhookLogService (`src/services/webhookLogService.js`)

Service layer providing webhook logging functionality:

#### Key Methods:

- `logIncomingWebhook(req, stripeEvent, signatureVerified)` - Log incoming webhook
- `updateWebhookStatus(webhookLogId, status, options)` - Update processing status
- `markWebhookCompleted(webhookLogId, responseStatus, responseBody, processingTime)` - Mark as completed
- `markWebhookFailed(webhookLogId, errorMessage, errorStack, responseStatus)` - Mark as failed
- `getWebhookLogs(filters, pagination)` - Retrieve logs with filtering/pagination
- `getWebhookStats(filters)` - Get statistics and analytics
- `retryWebhook(webhookLogId)` - Retry failed webhook
- `cleanupOldLogs(daysOld)` - Clean up old logs

### 3. Enhanced Stripe Webhook Handler

The existing `stripeWebhook` function in `src/services/subscriptionService.js` has been enhanced to integrate logging:

```javascript
export const stripeWebhook = catchAsync(async (req, res, next) => {
  let webhookLog;

  try {
    // 1. Log incoming webhook
    webhookLog = await WebhookLogService.logIncomingWebhook(req, null, false);

    // 2. Verify signature and parse event
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

    // 3. Update log with parsed event data
    await WebhookLogService.updateWebhookStatus(webhookLog._id, 'processing');

    // 4. Process the webhook event
    const startTime = Date.now();
    await processWebhookEvent(event);
    const processingTime = Date.now() - startTime;

    // 5. Mark as completed
    await WebhookLogService.markWebhookCompleted(
      webhookLog._id,
      200,
      { received: true },
      processingTime
    );

    res.status(200).json({ received: true });
  } catch (error) {
    // Mark as failed
    if (webhookLog) {
      await WebhookLogService.markWebhookFailed(
        webhookLog._id,
        error.message,
        error.stack,
        500
      );
    }
    res.status(500).send('Webhook handler failed');
  }
});
```

### 4. WebhookLogController (`src/controllers/webhookLogController.js`)

REST API endpoints for webhook log management:

- `GET /api/v1/webhook-logs` - Get webhook logs with filtering
- `GET /api/v1/webhook-logs/stats` - Get webhook statistics
- `GET /api/v1/webhook-logs/distribution` - Get event distribution analytics
- `GET /api/v1/webhook-logs/timeline` - Get processing timeline
- `GET /api/v1/webhook-logs/:id` - Get specific webhook log
- `POST /api/v1/webhook-logs/:id/retry` - Retry failed webhook
- `POST /api/v1/webhook-logs/cleanup` - Cleanup old logs
- `GET /api/v1/webhook-logs/user/:userId` - Get logs for specific user
- `GET /api/v1/webhook-logs/customer/:customerId` - Get logs for Stripe customer

### 5. WebhookLogCronService (`src/services/webhookLogCronService.js`)

Automated maintenance and monitoring:

- **Daily Cleanup Job** (2 AM UTC) - Removes logs older than 30 days
- **Hourly Statistics Job** - Monitors webhook health and alerts on issues
- **Health Status Monitoring** - Tracks failure rates and processing times

### 6. Routes (`src/routes/webhookLogRoutes.js`)

Protected routes for webhook log management (admin only):

```javascript
// General routes
router.get('/', getWebhookLogs);
router.get('/stats', getWebhookStats);
router.get('/distribution', getEventDistribution);
router.get('/timeline', getProcessingTimeline);

// Management routes
router.get('/:id', getWebhookLog);
router.post('/:id/retry', retryWebhook);
router.post('/cleanup', cleanupOldLogs);

// User-specific routes
router.get('/user/:userId', getUserWebhookLogs);
router.get('/customer/:customerId', getCustomerWebhookLogs);
```

## Usage Examples

### 1. Get Webhook Logs with Filtering

```javascript
GET /api/v1/webhook-logs?eventType=customer.subscription.updated&status=completed&page=1&limit=20
```

### 2. Get Webhook Statistics

```javascript
GET /api/v1/webhook-logs/stats?dateFrom=2025-01-01&dateTo=2025-01-31
```

Response:

```json
{
  "status": "success",
  "data": {
    "overview": {
      "total": 1250,
      "completed": 1200,
      "failed": 30,
      "pending": 20,
      "avgProcessingTime": 245
    },
    "byEventType": [
      {
        "_id": "customer.subscription.updated",
        "count": 500,
        "completed": 485,
        "failed": 15
      }
    ]
  }
}
```

### 3. Get Event Distribution Analytics

```javascript
GET /api/v1/webhook-logs/distribution?dateFrom=2025-01-01
```

### 4. Retry Failed Webhook

```javascript
POST /api/v1/webhook-logs/64f123456789abcdef123456/retry
```

### 5. Manual Cleanup

```javascript
POST /api/v1/webhook-logs/cleanup?daysOld=60
```

## Monitoring and Alerting

### Health Status Monitoring

The system automatically monitors webhook health and provides alerts for:

- **High failure rates** (>10% hourly, >15% daily)
- **High processing times** (>5 seconds average)
- **Stuck pending webhooks** (>10 pending)

### Accessing Health Status

```javascript
import WebhookLogCronService from './src/services/webhookLogCronService.js';

const healthStatus = await WebhookLogCronService.getHealthStatus();
console.log(healthStatus);
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "hourly": {
    "total": 45,
    "completed": 44,
    "failed": 1,
    "pending": 0,
    "failureRate": 2.22,
    "avgProcessingTime": 156
  },
  "daily": {
    "total": 1089,
    "completed": 1065,
    "failed": 22,
    "pending": 2,
    "failureRate": 2.02,
    "avgProcessingTime": 198
  },
  "alerts": []
}
```

## Security Features

### 1. Signature Verification

All webhooks are verified using Stripe's signature verification:

```javascript
const event = stripe.webhooks.constructEvent(
  req.body,
  signature,
  config.stripe.webhookSecret
);
```

### 2. Access Control

Webhook log endpoints are protected and only accessible by admin users:

```javascript
router.use(protect);
router.use(restrictTo('admin'));
```

### 3. Data Sanitization

Sensitive data is handled carefully:

- Raw request bodies are stored for debugging but access is restricted
- Personal information is not exposed in logs
- Error messages are sanitized

## Performance Considerations

### 1. Database Indexing

The WebhookLog model includes optimized indexes:

```javascript
// Compound indexes for common queries
webhookLogSchema.index({ eventType: 1, status: 1 });
webhookLogSchema.index({ createdAt: -1, status: 1 });
webhookLogSchema.index({ stripeCustomerId: 1, eventType: 1 });
webhookLogSchema.index({ userId: 1, createdAt: -1 });

// TTL index for automatic cleanup
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days
```

### 2. Automated Cleanup

- Daily cron job removes logs older than 30 days
- TTL index provides automatic MongoDB cleanup
- Manual cleanup endpoint for immediate cleanup

### 3. Pagination

All list endpoints support pagination to handle large datasets:

```javascript
const result = await WebhookLogService.getWebhookLogs(filters, {
  page: 1,
  limit: 50,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

## Testing

### Running Tests

```bash
node test_webhook_logging.js
```

The test suite covers:

- Basic webhook logging functionality
- Status updates and completion tracking
- Error handling and retry logic
- Filtering and pagination
- Statistics and analytics
- User and subscription associations
- Cleanup functionality

### Test Output Example

```
🚀 Starting Webhook Logging Tests...

✅ Connected to database
✅ Cleaned up existing test data

📝 Test 1: Log incoming webhook without parsed event
   ✅ Created log: 64f123456789abcdef123456
   📊 Status: pending
   🔒 Signature verified: false

📝 Test 2: Log incoming webhook with parsed Stripe event
   ✅ Created log: 64f123456789abcdef123457
   📊 Status: pending
   🎯 Event type: customer.subscription.updated
   🆔 Stripe event ID: evt_test_1642678901234
   🔒 Signature verified: true

🎉 All webhook logging tests completed successfully!
```

## Configuration

### Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URI=mongodb://localhost:27017/padelize
```

### Webhook Endpoint

The webhook endpoint is configured in `app.js`:

```javascript
app.post(
  '/api/v1/stripe_webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);
```

## Troubleshooting

### Common Issues

1. **Webhook Not Logging**: Check that WebhookLogService is properly imported
2. **Signature Verification Failing**: Verify STRIPE_WEBHOOK_SECRET is correct
3. **High Processing Times**: Check database performance and indexes
4. **Missing Associations**: Ensure user has correct stripeCustomerId

### Debug Logging

Enable debug logging in the webhook handler:

```javascript
console.log('Webhook event received:', {
  id: event.id,
  type: event.type,
  customerId: event.data.object.customer,
});
```

### Database Queries

Monitor webhook log queries:

```javascript
// Check recent failed webhooks
db.webhooklogs.find({
  status: 'failed',
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
});

// Check processing times
db.webhooklogs.aggregate([
  { $match: { status: 'completed' } },
  { $group: { _id: '$eventType', avgTime: { $avg: '$processingTime' } } },
]);
```

## Future Enhancements

1. **Real-time Dashboard**: Web-based dashboard for monitoring webhook health
2. **Alert Notifications**: Email/Slack notifications for critical issues
3. **Advanced Analytics**: Machine learning for anomaly detection
4. **Webhook Replay**: Ability to replay webhooks for testing
5. **Rate Limiting**: Protection against webhook flooding
6. **Batch Processing**: Handle high-volume webhook events

## API Reference

### Webhook Log Object

```typescript
interface WebhookLog {
  _id: string;
  stripeEventId?: string;
  eventType?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'ignored';
  method: string;
  headers: Record<string, any>;
  rawBody: string;
  data?: Record<string, any>;
  responseStatus?: number;
  responseBody?: Record<string, any>;
  processingTime?: number;
  signatureVerified: boolean;
  errorMessage?: string;
  errorStack?: string;
  retryCount: number;
  lastRetryAt?: Date;
  maxRetries: number;
  userId?: string;
  subscriptionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  sourceIp?: string;
  userAgent?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Filter Options

```typescript
interface WebhookLogFilters {
  eventType?: string;
  status?: string;
  stripeCustomerId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  signatureVerified?: boolean;
}
```

### Pagination Options

```typescript
interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

This comprehensive webhook logging system provides complete visibility into Stripe webhook events, enabling robust monitoring, debugging, and analytics for the Padelize application's subscription system.
