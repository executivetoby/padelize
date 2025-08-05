// src/utils/notificationUtils.js
import Notification from '../models/Notification.js';
import cron from 'node-cron';

export class NotificationUtils {
  // Format notification for different contexts
  static formatNotificationForMobile(notification) {
    return {
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: notification.read,
      createdAt: notification.createdAt,
      sender: {
        id: notification.sender._id,
        name: notification.sender.fullName,
        avatar: notification.sender.image,
      },
      relatedContent: {
        postId: notification.relatedPost?._id,
        replyId: notification.relatedReply?._id,
      },
      metadata: notification.metadata,
    };
  }

  // Format for web dashboard
  static formatNotificationForWeb(notification) {
    return {
      ...this.formatNotificationForMobile(notification),
      isRecent: notification.isRecent,
      readAt: notification.readAt,
      priority: notification.priority,
      relatedPost: notification.relatedPost,
      relatedReply: notification.relatedReply,
    };
  }

  // Group notifications by type and date
  static groupNotifications(notifications) {
    const grouped = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    notifications.forEach((notification) => {
      const createdAt = new Date(notification.createdAt);

      if (createdAt >= today) {
        grouped.today.push(notification);
      } else if (createdAt >= yesterday) {
        grouped.yesterday.push(notification);
      } else if (createdAt >= weekAgo) {
        grouped.thisWeek.push(notification);
      } else {
        grouped.older.push(notification);
      }
    });

    return grouped;
  }

  // Calculate notification priority based on content
  static calculatePriority(type, senderFollowerCount = 0, engagement = 0) {
    switch (type) {
      case 'follow':
        return senderFollowerCount > 1000 ? 'high' : 'medium';
      case 'like':
        return engagement > 100 ? 'medium' : 'low';
      case 'reply':
        return 'high'; // Replies are always important
      case 'replyLike':
        return 'medium';
      default:
        return 'medium';
    }
  }

  // Batch process notifications
  static async batchProcessNotifications(notifications, processor) {
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((notification) => processor(notification))
      );
      results.push(...batchResults);
    }

    return results;
  }
}

// Notification Cleanup Jobs
export class NotificationCleanupJobs {
  static initialize() {
    // Clean up old notifications every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('Starting notification cleanup job...');
        await this.cleanupOldNotifications();
        console.log('Notification cleanup job completed');
      } catch (error) {
        console.error('Error in notification cleanup job:', error);
      }
    });

    // Update notification statistics every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.updateNotificationStats();
      } catch (error) {
        console.error('Error updating notification stats:', error);
      }
    });

    // Clean up grouped notifications every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        await this.cleanupGroupedNotifications();
      } catch (error) {
        console.error('Error cleaning grouped notifications:', error);
      }
    });
  }

  // Delete notifications older than 30 days
  static async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await Notification.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
    });

    console.log(`Cleaned up ${result.deletedCount} old notifications`);
    return result;
  }

  // Clean up duplicate grouped notifications
  static async cleanupGroupedNotifications() {
    const duplicateGroups = await Notification.aggregate([
      {
        $match: {
          groupKey: { $ne: null },
          read: true,
        },
      },
      {
        $group: {
          _id: '$groupKey',
          count: { $sum: 1 },
          docs: { $push: '$_id' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ]);

    let deletedCount = 0;
    for (const group of duplicateGroups) {
      // Keep the most recent one, delete the rest
      const toDelete = group.docs.slice(1);
      const result = await Notification.deleteMany({
        _id: { $in: toDelete },
      });
      deletedCount += result.deletedCount;
    }

    console.log(`Cleaned up ${deletedCount} duplicate grouped notifications`);
    return deletedCount;
  }

  // Update notification statistics (could be used for analytics)
  static async updateNotificationStats() {
    // This could update some statistics collection or cache
    // For now, just log
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unreadCount: {
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] },
          },
        },
      },
    ]);

    console.log('Current notification stats:', stats);
    return stats;
  }
}

// Notification Templates for different types
export class NotificationTemplates {
  static templates = {
    like: {
      title: 'Post Liked',
      getMessage: (senderName) => `${senderName} liked your post`,
      getGroupedMessage: (senderName, count) =>
        count === 2
          ? `${senderName} and 1 other liked your post`
          : `${senderName} and ${count - 1} others liked your post`,
    },
    reply: {
      title: 'New Reply',
      getMessage: (senderName) => `${senderName} replied to your post`,
      getGroupedMessage: (senderName, count) =>
        count === 2
          ? `${senderName} and 1 other replied to your post`
          : `${senderName} and ${count - 1} others replied to your post`,
    },
    replyLike: {
      title: 'Reply Liked',
      getMessage: (senderName) => `${senderName} liked your reply`,
      getGroupedMessage: (senderName, count) =>
        count === 2
          ? `${senderName} and 1 other liked your reply`
          : `${senderName} and ${count - 1} others liked your reply`,
    },
    follow: {
      title: 'New Follower',
      getMessage: (senderName) => `${senderName} started following you`,
      getGroupedMessage: (senderName, count) =>
        count === 2
          ? `${senderName} and 1 other started following you`
          : `${senderName} and ${count - 1} others started following you`,
    },
  };

  static getTemplate(type) {
    return (
      this.templates[type] || {
        title: 'New Notification',
        getMessage: (senderName) =>
          `${senderName} interacted with your content`,
        getGroupedMessage: (senderName, count) =>
          `${senderName} and ${count - 1} others interacted with your content`,
      }
    );
  }
}

// Push notification helpers (for mobile apps)
export class PushNotificationHelper {
  // Format for Firebase Cloud Messaging
  static formatForFCM(notification, deviceToken) {
    return {
      to: deviceToken,
      notification: {
        title: notification.title,
        body: notification.message,
        icon: notification.sender?.image || '/default-avatar.png',
        click_action: this.getClickAction(notification),
      },
      data: {
        notificationId: notification._id.toString(),
        type: notification.type,
        postId: notification.relatedPost?._id?.toString(),
        replyId: notification.relatedReply?._id?.toString(),
        senderId: notification.sender._id.toString(),
      },
    };
  }

  // Get appropriate click action based on notification type
  static getClickAction(notification) {
    switch (notification.type) {
      case 'like':
      case 'reply':
        return notification.relatedPost
          ? `/posts/${notification.relatedPost._id}`
          : '/notifications';
      case 'replyLike':
        return notification.relatedPost
          ? `/posts/${notification.relatedPost._id}`
          : '/notifications';
      case 'follow':
        return `/profile/${notification.sender._id}`;
      default:
        return '/notifications';
    }
  }

  // Format for Apple Push Notification Service
  static formatForAPNS(notification, deviceToken) {
    return {
      deviceToken,
      payload: {
        aps: {
          alert: {
            title: notification.title,
            body: notification.message,
          },
          badge: 1, // You'd typically get this from unread count
          sound: 'default',
          category: notification.type,
        },
        notificationId: notification._id.toString(),
        type: notification.type,
        postId: notification.relatedPost?._id?.toString(),
        senderId: notification.sender._id.toString(),
      },
    };
  }
}
