import express from 'express';
import {
  getWebhookLogs,
  getWebhookStats,
  getWebhookLog,
  retryWebhook,
  cleanupOldLogs,
  getUserWebhookLogs,
  getCustomerWebhookLogs,
  getEventDistribution,
  getProcessingTimeline,
} from '../controllers/webhookLogController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// Protect all webhook log routes - only admins should access
router.use(protect);
router.use(restrictTo('admin'));

// General webhook log routes
router.get('/', getWebhookLogs);
router.get('/stats', getWebhookStats);
router.get('/distribution', getEventDistribution);
router.get('/timeline', getProcessingTimeline);
router.post('/cleanup', cleanupOldLogs);

// Specific webhook log routes
router.get('/:id', getWebhookLog);
router.post('/:id/retry', retryWebhook);

// User and customer specific routes
router.get('/user/:userId', getUserWebhookLogs);
router.get('/customer/:customerId', getCustomerWebhookLogs);

export default router;
