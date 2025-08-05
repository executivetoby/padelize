// src/routes/notificationRoutes.js
import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationStats,
  getRecentNotifications,
  updateNotificationPreferences,
} from '../controllers/notificationController.js';
import { protect } from '../controllers/authController.js';

const router = express.Router();

// Protect all notification routes
router.use(protect);

// Get all notifications with pagination and filters
router.get('/', getNotifications);

// Get unread notifications count
router.get('/unread-count', getUnreadCount);

// Get recent notifications (last 24 hours)
router.get('/recent', getRecentNotifications);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Mark all notifications as read
router.patch('/mark-all-read', markAllAsRead);

// Delete all notifications
router.delete('/delete-all', deleteAllNotifications);

// Update notification preferences
router.patch('/preferences', updateNotificationPreferences);

// Mark specific notification as read
router.patch('/:notificationId/read', markAsRead);

// Delete specific notification
router.delete('/:notificationId', deleteNotification);

export default router;
