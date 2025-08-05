// src/models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    // Who receives the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Who triggered the notification
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Type of notification
    type: {
      type: String,
      enum: [
        'like', // Someone liked your post
        'reply', // Someone replied to your post
        'replyLike', // Someone liked your reply
        'follow', // Someone followed you
        'mention', // Someone mentioned you (future feature)
        'comment', // Someone commented on your post (if different from reply)
      ],
      required: true,
      index: true,
    },

    // Dynamic title and message
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },

    message: {
      type: String,
      required: true,
      maxlength: 255,
    },

    // Related entities (flexible for different notification types)
    relatedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
      index: true,
    },

    relatedReply: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reply',
      default: null,
    },

    // Additional data (stored as JSON for flexibility)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Notification status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    // For grouping similar notifications (e.g., "John and 5 others liked your post")
    groupKey: {
      type: String,
      default: null,
      index: true,
    },

    // Priority for sorting/filtering
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },

    // Soft delete
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better query performance
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ groupKey: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, deleted: 1, createdAt: -1 });

// Virtual for checking if notification is recent (within 24 hours)
notificationSchema.virtual('isRecent').get(function () {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.createdAt > oneDayAgo;
});

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to create grouped notifications
notificationSchema.statics.createOrUpdateGrouped = async function (data) {
  const { recipient, sender, type, relatedPost, relatedReply } = data;

  // Create group key for similar notifications
  const groupKey = `${recipient}_${type}_${relatedPost || relatedReply}`;

  // Check if there's an existing unread notification of the same type
  const existingNotification = await this.findOne({
    recipient,
    type,
    relatedPost,
    relatedReply,
    read: false,
    groupKey,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Within 24 hours
  });

  if (existingNotification) {
    // Update existing notification with new sender info
    const senders = existingNotification.metadata.senders || [
      existingNotification.sender,
    ];
    if (!senders.some((s) => s.toString() === sender.toString())) {
      senders.push(sender);
      existingNotification.metadata.senders = senders;
      existingNotification.sender = sender; // Most recent sender
      existingNotification.createdAt = new Date(); // Update timestamp

      // Update message for multiple users
      if (senders.length === 2) {
        existingNotification.message = existingNotification.message.replace(
          /^(\w+)/,
          `$1 and 1 other`
        );
      } else if (senders.length > 2) {
        existingNotification.message = existingNotification.message.replace(
          /and \d+ others?/,
          `and ${senders.length - 1} others`
        );
      }

      return await existingNotification.save();
    }
    return existingNotification;
  }

  // Create new notification
  return await this.create({
    ...data,
    groupKey,
    metadata: { senders: [sender] },
  });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    recipient: userId,
    read: false,
    deleted: false,
  });
};

// Auto-delete old notifications (keep for 30 days)
notificationSchema.statics.cleanupOldNotifications = async function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return await this.deleteMany({
    createdAt: { $lt: thirtyDaysAgo },
  });
};

export default mongoose.model('Notification', notificationSchema);
