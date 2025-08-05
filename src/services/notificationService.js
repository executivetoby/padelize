// src/services/notificationService.js
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Reply from '../models/Reply.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import webSocketService from './webSocketService.js';
import { createOne, findOne, updateOne, deleteOne } from '../factory/repo.js';

class NotificationService {
  // Create a new notification
  async createNotification(data) {
    try {
      const {
        recipient,
        sender,
        type,
        relatedPost = null,
        relatedReply = null,
        customTitle = null,
        customMessage = null,
        priority = 'medium',
      } = data;

      // Don't send notification to self
      if (recipient.toString() === sender.toString()) {
        return null;
      }

      // Generate title and message based on type
      const senderUser = await findOne(User, { _id: sender });
      const { title, message } = await this.generateNotificationContent(
        type,
        senderUser,
        { relatedPost, relatedReply, customTitle, customMessage }
      );

      // Create or update grouped notification
      const notification = await Notification.createOrUpdateGrouped({
        recipient,
        sender,
        type,
        title,
        message,
        relatedPost,
        relatedReply,
        priority,
      });

      // Send real-time notification via WebSocket
      const populatedNotification = await this.populateNotification(
        notification
      );
      webSocketService.sendNotificationToUser(
        recipient.toString(),
        populatedNotification
      );

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new AppError('Failed to create notification', 500);
    }
  }

  // Generate notification content based on type
  async generateNotificationContent(type, sender, options = {}) {
    const { relatedPost, relatedReply, customTitle, customMessage } = options;

    if (customTitle && customMessage) {
      return { title: customTitle, message: customMessage };
    }

    switch (type) {
      case 'like':
        return {
          title: 'Post Liked',
          message: `${sender.fullName} liked your post`,
        };

      case 'reply':
        return {
          title: 'New Reply',
          message: `${sender.fullName} replied to your post`,
        };

      case 'replyLike':
        return {
          title: 'Reply Liked',
          message: `${sender.fullName} liked your reply`,
        };

      case 'follow':
        return {
          title: 'New Follower',
          message: `${sender.fullName} started following you`,
        };

      case 'mention':
        return {
          title: 'You were mentioned',
          message: `${sender.fullName} mentioned you in a post`,
        };

      default:
        return {
          title: 'New Notification',
          message: `${sender.fullName} interacted with your content`,
        };
    }
  }

  // Populate notification with related data
  async populateNotification(notification) {
    return await Notification.findById(notification._id)
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
      });
  }

  // Notification type handlers
  async handleLikeNotification(postId, likedBy, postOwner) {
    return await this.createNotification({
      recipient: postOwner._id,
      sender: likedBy._id,
      type: 'like',
      relatedPost: postId,
    });
  }

  async handleReplyNotification(postId, replyBy, postOwner, reply) {
    return await this.createNotification({
      recipient: postOwner._id,
      sender: replyBy._id,
      type: 'reply',
      relatedPost: postId,
      relatedReply: reply._id,
    });
  }

  async handleReplyLikeNotification(postId, replyId, likedBy, replyOwner) {
    return await this.createNotification({
      recipient: replyOwner._id,
      sender: likedBy._id,
      type: 'replyLike',
      relatedPost: postId,
      relatedReply: replyId,
    });
  }

  async handleFollowNotification(followedUser, follower) {
    return await this.createNotification({
      recipient: followedUser._id,
      sender: follower._id,
      type: 'follow',
    });
  }

  // Bulk operations
  async markAllAsRead(userId) {
    return await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );
  }

  async deleteOldNotifications(userId, days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return await Notification.deleteMany({
      recipient: userId,
      createdAt: { $lt: cutoffDate },
    });
  }

  // Cleanup job (run periodically)
  async cleanupNotifications() {
    return await Notification.cleanupOldNotifications();
  }
}

export default new NotificationService();
