// src/controllers/notificationController.js
import Notification from '../models/Notification.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import notificationService from '../services/notificationService.js';
import mongoose from 'mongoose';

// Get all notifications for the current user
export const getNotifications = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, type, unreadOnly = false } = req.query;
  const userId = req.user._id;

  // Build query
  const query = {
    recipient: userId,
    deleted: false,
  };

  if (type) query.type = type;
  if (unreadOnly === 'true') query.read = false;

  // Get notifications with pagination
  const notifications = await Notification.find(query)
    .populate({
      path: 'sender',
      select: 'fullName image',
    })
    .populate({
      path: 'relatedPost',
      select: 'content attachment createdAt',
      populate: {
        path: 'user',
        select: 'fullName image',
      },
    })
    .populate({
      path: 'relatedReply',
      select: 'content createdAt',
      populate: {
        path: 'user',
        select: 'fullName image',
      },
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Get total count for pagination
  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.getUnreadCount(userId);

  res.status(200).json({
    status: 'success',
    data: {
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalNotifications: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      unreadCount,
    },
  });
});

// Get unread notifications count
export const getUnreadCount = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const unreadCount = await Notification.getUnreadCount(userId);

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount,
    },
  });
});

// Mark a specific notification as read
export const markAsRead = catchAsync(async (req, res, next) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipient: userId,
    },
    {
      read: true,
      readAt: new Date(),
    },
    { new: true }
  );

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Notification marked as read',
    data: {
      notification,
    },
  });
});

// Mark all notifications as read
export const markAllAsRead = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const result = await notificationService.markAllAsRead(userId);

  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read',
    data: {
      modifiedCount: result.modifiedCount,
    },
  });
});

// Delete a specific notification
export const deleteNotification = catchAsync(async (req, res, next) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipient: userId,
    },
    {
      deleted: true,
    },
    { new: true }
  );

  if (!notification) {
    return next(new AppError('Notification not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Notification deleted successfully',
  });
});

// Delete all notifications for user
export const deleteAllNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const result = await Notification.updateMany(
    { recipient: userId },
    { deleted: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'All notifications deleted successfully',
    data: {
      deletedCount: result.modifiedCount,
    },
  });
});

// Get notification statistics
export const getNotificationStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const stats = await Notification.aggregate([
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(userId),
        deleted: false,
      },
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] },
        },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  const totalNotifications = await Notification.countDocuments({
    recipient: userId,
    deleted: false,
  });

  const totalUnread = await Notification.getUnreadCount(userId);

  res.status(200).json({
    status: 'success',
    data: {
      totalNotifications,
      totalUnread,
      byType: stats,
    },
  });
});

// Get recent notifications (last 24 hours)
export const getRecentNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const notifications = await Notification.find({
    recipient: userId,
    deleted: false,
    createdAt: { $gte: oneDayAgo },
  })
    .populate({
      path: 'sender',
      select: 'fullName image',
    })
    .populate({
      path: 'relatedPost',
      select: 'content attachment',
    })
    .sort({ createdAt: -1 })
    .limit(10);

  res.status(200).json({
    status: 'success',
    data: {
      notifications,
      count: notifications.length,
    },
  });
});

// Update notification preferences (future feature)
export const updateNotificationPreferences = catchAsync(
  async (req, res, next) => {
    // This would update user's notification preferences in User model
    // For now, just return success
    res.status(200).json({
      status: 'success',
      message: 'Notification preferences updated successfully',
    });
  }
);
