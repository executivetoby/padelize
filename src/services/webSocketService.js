// src/services/websocketService.js (Updated with notification integration)
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import notificationService from './notificationService.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.userSockets = new Map(); // socketId -> userId mapping
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      },
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);

      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);

      // Join user to their personal room for direct notifications
      socket.join(`user_${socket.userId}`);

      // Join the main community room (everyone sees all posts)
      socket.join('community');

      // Broadcast user online status
      this.broadcastUserStatus(socket.userId, 'online');

      // Send unread notification count on connect
      this.sendUnreadCount(socket.userId);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);
        this.broadcastUserStatus(socket.userId, 'offline');
      });

      // Handle notification events from client
      socket.on('markNotificationRead', async (notificationId) => {
        try {
          // You could handle this here or let the HTTP API handle it
          console.log(
            `User ${socket.userId} marked notification ${notificationId} as read`
          );
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      });

      // Handle real-time notification preferences
      socket.on('updateNotificationPreferences', (preferences) => {
        // Store user preferences for real-time notifications
        console.log(
          `User ${socket.userId} updated notification preferences:`,
          preferences
        );
      });
    });

    return this.io;
  }

  // Send notification to specific user
  sendNotificationToUser(userId, notification) {
    this.io.to(`user_${userId}`).emit('notification', notification);
    // Also send updated unread count
    this.sendUnreadCount(userId);
  }

  // Send unread notification count to user
  async sendUnreadCount(userId) {
    try {
      const unreadCount =
        (await notificationService.getUnreadCount?.(userId)) || 0;
      this.io.to(`user_${userId}`).emit('unreadCount', { count: unreadCount });
    } catch (error) {
      console.error('Error sending unread count:', error);
    }
  }

  // Broadcast to entire community
  broadcastToCommunity(event, data) {
    this.io.to('community').emit(event, data);
  }

  // Send to specific user by userId
  sendToUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Broadcast user status (online/offline)
  broadcastUserStatus(userId, status) {
    this.io.to('community').emit('userStatusChange', { userId, status });
  }

  // Handle new post creation - broadcast to entire community
  handleNewPost(post, author) {
    const postData = {
      post,
      author,
      timestamp: new Date(),
    };

    // Broadcast to all users in the community for real-time UI update
    this.broadcastToCommunity('newPost', postData);

    console.log(`New post by ${author.fullName} broadcasted to community`);
  }

  // Handle post update - broadcast to community
  handlePostUpdate(postId, updatedData, updatedBy) {
    const updateData = {
      postId,
      updatedData,
      updatedBy,
      timestamp: new Date(),
    };

    this.broadcastToCommunity('postUpdated', updateData);
  }

  // Handle post deletion - broadcast to community
  handlePostDeletion(postId, deletedBy) {
    const deleteData = {
      postId,
      deletedBy,
      timestamp: new Date(),
    };

    this.broadcastToCommunity('postDeleted', deleteData);
  }

  // Handle like - create notification and broadcast UI update
  async handleLikeNotification(postId, likedBy, postOwner) {
    // 1. Create notification in database and send to post owner
    if (postOwner._id.toString() !== likedBy._id.toString()) {
      await notificationService.handleLikeNotification(
        postId,
        likedBy,
        postOwner
      );
    }

    // 2. Broadcast like update to community for real-time UI update
    this.broadcastToCommunity('postLiked', {
      postId,
      likedBy: {
        _id: likedBy._id,
        fullName: likedBy.fullName,
        image: likedBy.image,
      },
      timestamp: new Date(),
    });
  }

  // Handle unlike - broadcast to community for real-time count update
  handleUnlikeUpdate(postId, unlikedBy) {
    this.broadcastToCommunity('postUnliked', {
      postId,
      unlikedBy: {
        _id: unlikedBy._id,
        fullName: unlikedBy.fullName,
        image: unlikedBy.image,
      },
      timestamp: new Date(),
    });
  }

  // Handle new reply - create notification and broadcast
  async handleReplyNotification(postId, replyBy, postOwner, reply) {
    // 1. Create notification in database and send to post owner
    if (postOwner._id.toString() !== replyBy._id.toString()) {
      await notificationService.handleReplyNotification(
        postId,
        replyBy,
        postOwner,
        reply
      );
    }

    // 2. Broadcast reply to community for real-time UI update
    this.broadcastToCommunity('newReply', {
      postId,
      reply,
      replyBy: {
        _id: replyBy._id,
        fullName: replyBy.fullName,
        image: replyBy.image,
      },
      timestamp: new Date(),
    });
  }

  // Handle reply like - create notification and broadcast
  async handleReplyLikeNotification(postId, replyId, likedBy, replyOwner) {
    // 1. Create notification in database and send to reply owner
    if (replyOwner._id.toString() !== likedBy._id.toString()) {
      await notificationService.handleReplyLikeNotification(
        postId,
        replyId,
        likedBy,
        replyOwner
      );
    }

    // 2. Broadcast to community for real-time UI update
    this.broadcastToCommunity('replyLiked', {
      postId,
      replyId,
      likedBy: {
        _id: likedBy._id,
        fullName: likedBy.fullName,
        image: likedBy.image,
      },
      timestamp: new Date(),
    });
  }

  // Handle reply unlike - broadcast to community
  handleReplyUnlikeUpdate(postId, replyId, unlikedBy) {
    this.broadcastToCommunity('replyUnliked', {
      postId,
      replyId,
      unlikedBy: {
        _id: unlikedBy._id,
        fullName: unlikedBy.fullName,
        image: unlikedBy.image,
      },
      timestamp: new Date(),
    });
  }

  // Handle follow notification
  async handleFollowNotification(followedUser, follower) {
    await notificationService.handleFollowNotification(followedUser, follower);
  }

  // Broadcast system-wide announcements
  broadcastAnnouncement(announcement) {
    this.io.emit('announcement', {
      ...announcement,
      timestamp: new Date(),
    });
  }

  // Get online users
  getOnlineUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Get total connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Send typing indicator
  handleTypingIndicator(postId, userId, isTyping) {
    this.io.to('community').emit('typing', {
      postId,
      userId,
      isTyping,
      timestamp: new Date(),
    });
  }
}

export default new WebSocketService();

// // src/services/websocketService.js
// import { Server } from 'socket.io';
// import jwt from 'jsonwebtoken';
// import User from '../models/User.js';

// class WebSocketService {
//   constructor() {
//     this.io = null;
//     this.connectedUsers = new Map(); // userId -> socketId mapping
//     this.userSockets = new Map(); // socketId -> userId mapping
//   }

//   initialize(server) {
//     this.io = new Server(server, {
//       cors: {
//         origin: '*',
//         methods: ['GET', 'POST', 'PATCH', 'DELETE'],
//       },
//     });

//     // Authentication middleware
//     this.io.use(async (socket, next) => {
//       try {
//         const token =
//           socket.handshake.auth.token ||
//           socket.handshake.headers.authorization?.split(' ')[1];

//         if (!token) {
//           return next(new Error('Authentication error'));
//         }

//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         const user = await User.findById(decoded.id);

//         if (!user) {
//           return next(new Error('User not found'));
//         }

//         socket.userId = user._id.toString();
//         socket.user = user;
//         next();
//       } catch (error) {
//         next(new Error('Authentication error'));
//       }
//     });

//     this.io.on('connection', (socket) => {
//       console.log(`User ${socket.userId} connected`);

//       // Store user connection
//       this.connectedUsers.set(socket.userId, socket.id);
//       this.userSockets.set(socket.id, socket.userId);

//       // Join user to their personal room for direct notifications
//       socket.join(`user_${socket.userId}`);

//       // Join the main community room (everyone sees all posts)
//       socket.join('community');

//       // Broadcast user online status
//       this.broadcastUserStatus(socket.userId, 'online');

//       // Handle disconnection
//       socket.on('disconnect', () => {
//         console.log(`User ${socket.userId} disconnected`);
//         this.connectedUsers.delete(socket.userId);
//         this.userSockets.delete(socket.id);
//         this.broadcastUserStatus(socket.userId, 'offline');
//       });

//       // Handle post viewing (optional - for analytics or specific post features)
//       socket.on('viewPost', (postId) => {
//         console.log(`User ${socket.userId} is viewing post ${postId}`);
//         // You can store this info if needed for analytics
//       });
//     });

//     return this.io;
//   }

//   // Send notification to specific user
//   sendNotificationToUser(userId, notification) {
//     this.io.to(`user_${userId}`).emit('notification', notification);
//   }

//   // Broadcast to entire community
//   broadcastToCommunity(event, data) {
//     this.io.to('community').emit(event, data);
//   }

//   // Send to specific user by userId
//   sendToUser(userId, event, data) {
//     this.io.to(`user_${userId}`).emit(event, data);
//   }

//   // Broadcast user status (online/offline)
//   broadcastUserStatus(userId, status) {
//     this.io.to('community').emit('userStatusChange', { userId, status });
//   }

//   // Handle new post creation - broadcast to entire community
//   handleNewPost(post, author) {
//     const postData = {
//       post,
//       author,
//       timestamp: new Date(),
//     };

//     // Broadcast to all users in the community for real-time UI update
//     this.broadcastToCommunity('newPost', postData);

//     console.log(`New post by ${author.fullName} broadcasted to community`);
//   }

//   // Handle post update - broadcast to community
//   handlePostUpdate(postId, updatedData, updatedBy) {
//     const updateData = {
//       postId,
//       updatedData,
//       updatedBy,
//       timestamp: new Date(),
//     };

//     this.broadcastToCommunity('postUpdated', updateData);
//   }

//   // Handle post deletion - broadcast to community
//   handlePostDeletion(postId, deletedBy) {
//     const deleteData = {
//       postId,
//       deletedBy,
//       timestamp: new Date(),
//     };

//     this.broadcastToCommunity('postDeleted', deleteData);
//   }

//   // Handle like - notify post owner and broadcast to community for real-time count update
//   handleLikeNotification(postId, likedBy, postOwner) {
//     // 1. Send private notification to post owner only
//     if (postOwner._id.toString() !== likedBy._id.toString()) {
//       const notification = {
//         type: 'like',
//         title: 'Post Liked',
//         message: `${likedBy.fullName} liked your post`,
//         postId,
//         from: likedBy,
//         timestamp: new Date(),
//         read: false,
//       };

//       this.sendNotificationToUser(postOwner._id.toString(), notification);
//     }

//     // 2. Broadcast like update to community for real-time UI update (like count, button state)
//     this.broadcastToCommunity('postLiked', {
//       postId,
//       likedBy: {
//         _id: likedBy._id,
//         fullName: likedBy.fullName,
//         image: likedBy.image,
//       },
//       timestamp: new Date(),
//     });
//   }

//   // Handle unlike - broadcast to community for real-time count update
//   handleUnlikeUpdate(postId, unlikedBy) {
//     this.broadcastToCommunity('postUnliked', {
//       postId,
//       unlikedBy: {
//         _id: unlikedBy._id,
//         fullName: unlikedBy.fullName,
//         image: unlikedBy.image,
//       },
//       timestamp: new Date(),
//     });
//   }

//   // Handle new reply - notify post owner and broadcast to community
//   handleReplyNotification(postId, replyBy, postOwner, reply) {
//     // 1. Send private notification to post owner only
//     if (postOwner._id.toString() !== replyBy._id.toString()) {
//       const notification = {
//         type: 'reply',
//         title: 'New Reply',
//         message: `${replyBy.fullName} replied to your post`,
//         postId,
//         from: replyBy,
//         reply: reply,
//         timestamp: new Date(),
//         read: false,
//       };

//       this.sendNotificationToUser(postOwner._id.toString(), notification);
//     }

//     // 2. Broadcast reply to community for real-time UI update
//     this.broadcastToCommunity('newReply', {
//       postId,
//       reply,
//       replyBy: {
//         _id: replyBy._id,
//         fullName: replyBy.fullName,
//         image: replyBy.image,
//       },
//       timestamp: new Date(),
//     });
//   }

//   // Handle reply like - notify reply owner and broadcast to community
//   handleReplyLikeNotification(postId, replyId, likedBy, replyOwner) {
//     // 1. Send private notification to reply owner only
//     if (replyOwner._id.toString() !== likedBy._id.toString()) {
//       const notification = {
//         type: 'replyLike',
//         title: 'Reply Liked',
//         message: `${likedBy.fullName} liked your reply`,
//         postId,
//         replyId,
//         from: likedBy,
//         timestamp: new Date(),
//         read: false,
//       };

//       this.sendNotificationToUser(replyOwner._id.toString(), notification);
//     }

//     // 2. Broadcast to community for real-time UI update
//     this.broadcastToCommunity('replyLiked', {
//       postId,
//       replyId,
//       likedBy: {
//         _id: likedBy._id,
//         fullName: likedBy.fullName,
//         image: likedBy.image,
//       },
//       timestamp: new Date(),
//     });
//   }

//   // Handle reply unlike - broadcast to community
//   handleReplyUnlikeUpdate(postId, replyId, unlikedBy) {
//     this.broadcastToCommunity('replyUnliked', {
//       postId,
//       replyId,
//       unlikedBy: {
//         _id: unlikedBy._id,
//         fullName: unlikedBy.fullName,
//         image: unlikedBy.image,
//       },
//       timestamp: new Date(),
//     });
//   }

//   // Handle follow notification
//   handleFollowNotification(followedUser, follower) {
//     const notification = {
//       type: 'follow',
//       title: 'New Follower',
//       message: `${follower.fullName} started following you`,
//       from: follower,
//       timestamp: new Date(),
//       read: false,
//     };

//     this.sendNotificationToUser(followedUser._id.toString(), notification);
//   }

//   // Get online users
//   getOnlineUsers() {
//     return Array.from(this.connectedUsers.keys());
//   }

//   // Check if user is online
//   isUserOnline(userId) {
//     return this.connectedUsers.has(userId);
//   }

//   // Get total connected users count
//   getConnectedUsersCount() {
//     return this.connectedUsers.size;
//   }
// }

// export default new WebSocketService();
