// src/services/websocketService.js - Enhanced for match events
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import notificationService from './notificationService.js';
import matchNotificationService from './matchNotificationService.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.userSockets = new Map(); // socketId -> userId mapping
    this.matchRooms = new Map(); // matchId -> Set of userIds
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

      // Handle match-specific room joining
      socket.on('joinMatchRoom', (matchId) => {
        socket.join(`match_${matchId}`);
        if (!this.matchRooms.has(matchId)) {
          this.matchRooms.set(matchId, new Set());
        }
        this.matchRooms.get(matchId).add(socket.userId);
        console.log(`User ${socket.userId} joined match room ${matchId}`);
      });

      socket.on('leaveMatchRoom', (matchId) => {
        socket.leave(`match_${matchId}`);
        if (this.matchRooms.has(matchId)) {
          this.matchRooms.get(matchId).delete(socket.userId);
          if (this.matchRooms.get(matchId).size === 0) {
            this.matchRooms.delete(matchId);
          }
        }
        console.log(`User ${socket.userId} left match room ${matchId}`);
      });

      // Handle match analysis status requests
      socket.on('requestMatchStatus', (matchId) => {
        console.log(
          `User ${socket.userId} requested status for match ${matchId}`
        );
        // You could emit current status here if needed
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);

        // Remove from all match rooms
        for (const [matchId, userSet] of this.matchRooms.entries()) {
          if (userSet.has(socket.userId)) {
            userSet.delete(socket.userId);
            if (userSet.size === 0) {
              this.matchRooms.delete(matchId);
            }
          }
        }

        this.broadcastUserStatus(socket.userId, 'offline');
      });

      // Handle notification events from client
      socket.on('markNotificationRead', async (notificationId) => {
        try {
          console.log(
            `User ${socket.userId} marked notification ${notificationId} as read`
          );
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      });

      // Handle real-time notification preferences
      socket.on('updateNotificationPreferences', (preferences) => {
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

  // Send to specific match room
  sendToMatchRoom(matchId, event, data) {
    this.io.to(`match_${matchId}`).emit(event, data);
  }

  // Broadcast user status (online/offline)
  broadcastUserStatus(userId, status) {
    this.io.to('community').emit('userStatusChange', { userId, status });
  }

  // === MATCH-SPECIFIC WEBSOCKET HANDLERS ===

  // Handle match creation - notify user and potentially followers
  handleMatchCreated(match, creator) {
    const matchData = {
      match,
      creator: {
        _id: creator._id,
        fullName: creator.fullName,
        image: creator.image,
      },
      timestamp: new Date(),
    };

    // Send to creator
    this.sendToUser(creator._id.toString(), 'matchCreated', matchData);

    console.log(`Match created by ${creator.fullName} - notification sent`);
  }

  // Handle match update
  handleMatchUpdated(match, updatedBy) {
    const updateData = {
      match,
      updatedBy: {
        _id: updatedBy._id,
        fullName: updatedBy.fullName,
        image: updatedBy.image,
      },
      timestamp: new Date(),
    };

    // Send to match owner
    this.sendToUser(updatedBy._id.toString(), 'matchUpdated', updateData);

    // Send to anyone currently viewing this match
    this.sendToMatchRoom(match._id.toString(), 'matchUpdated', updateData);
  }

  // Handle match deletion
  handleMatchDeleted(matchId, deletedBy) {
    const deleteData = {
      matchId,
      deletedBy: {
        _id: deletedBy._id,
        fullName: deletedBy.fullName,
        image: deletedBy.image,
      },
      timestamp: new Date(),
    };

    // Send to match owner
    this.sendToUser(deletedBy._id.toString(), 'matchDeleted', deleteData);

    // Send to anyone currently viewing this match
    this.sendToMatchRoom(matchId.toString(), 'matchDeleted', deleteData);
  }

  // Handle video upload completion
  handleVideoUploaded(match, uploadedBy, videoUrl) {
    const uploadData = {
      match,
      videoUrl,
      uploadedBy: {
        _id: uploadedBy._id,
        fullName: uploadedBy.fullName,
        image: uploadedBy.image,
      },
      timestamp: new Date(),
    };

    // Send to match owner
    this.sendToUser(uploadedBy._id.toString(), 'videoUploaded', uploadData);

    // Send to anyone currently viewing this match
    this.sendToMatchRoom(match._id.toString(), 'videoUploaded', uploadData);
  }

  // Handle analysis status changes
  handleAnalysisStatusChange(match, status, progress = null, error = null) {
    const statusData = {
      matchId: match._id.toString(),
      status,
      progress,
      error,
      timestamp: new Date(),
    };

    // Send to match owner
    this.sendToUser(
      match.creator.toString(),
      'analysisStatusChanged',
      statusData
    );

    // Send to anyone currently viewing this match
    this.sendToMatchRoom(
      match._id.toString(),
      'analysisStatusChanged',
      statusData
    );
  }

  // Handle analysis starting
  handleAnalysisStarting(match, startedBy) {
    this.handleAnalysisStatusChange(match, 'starting');

    console.log(
      `Analysis starting for match ${match._id} by ${startedBy.fullName}`
    );
  }

  // Handle analysis started successfully
  handleAnalysisStarted(match, analysisId, startedBy) {
    const startData = {
      matchId: match._id.toString(),
      analysisId,
      status: 'processing',
      startedBy: {
        _id: startedBy._id,
        fullName: startedBy.fullName,
        image: startedBy.image,
      },
      timestamp: new Date(),
    };

    this.sendToUser(startedBy._id.toString(), 'analysisStarted', startData);
    this.sendToMatchRoom(match._id.toString(), 'analysisStarted', startData);
  }

  // Handle analysis progress updates
  handleAnalysisProgress(match, progress) {
    this.handleAnalysisStatusChange(match, 'processing', progress);
  }

  // Handle analysis completion
  handleAnalysisCompleted(match, analysisId, results = null) {
    const completionData = {
      matchId: match._id.toString(),
      analysisId,
      status: 'completed',
      results,
      timestamp: new Date(),
    };

    this.sendToUser(
      match.creator.toString(),
      'analysisCompleted',
      completionData
    );
    this.sendToMatchRoom(
      match._id.toString(),
      'analysisCompleted',
      completionData
    );

    console.log(`Analysis completed for match ${match._id}`);
  }

  // Handle analysis errors
  handleAnalysisError(match, error) {
    this.handleAnalysisStatusChange(match, 'failed', null, error);

    console.log(`Analysis failed for match ${match._id}: ${error}`);
  }

  // Handle analysis restart
  handleAnalysisRestart(match, restartedBy) {
    const restartData = {
      matchId: match._id.toString(),
      status: 'restarting',
      restartedBy: {
        _id: restartedBy._id,
        fullName: restartedBy.fullName,
        image: restartedBy.image,
      },
      timestamp: new Date(),
    };

    this.sendToUser(
      restartedBy._id.toString(),
      'analysisRestarted',
      restartData
    );
    this.sendToMatchRoom(
      match._id.toString(),
      'analysisRestarted',
      restartData
    );
  }

  // === EXISTING SOCIAL FEATURES (PRESERVED) ===

  // Handle new post creation - broadcast to entire community
  async handleNewPost(post, author) {
    const postData = {
      post,
      author,
      timestamp: new Date(),
    };

    await notificationService.handleNewPostNotification(post, author);

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
    if (postOwner._id.toString() !== likedBy._id.toString()) {
      await notificationService.handleLikeNotification(
        postId,
        likedBy,
        postOwner
      );
    }

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
    if (postOwner._id.toString() !== replyBy._id.toString()) {
      await notificationService.handleReplyNotification(
        postId,
        replyBy,
        postOwner,
        reply
      );
    }

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
    if (replyOwner._id.toString() !== likedBy._id.toString()) {
      await notificationService.handleReplyLikeNotification(
        postId,
        replyId,
        likedBy,
        replyOwner
      );
    }

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

  // Get users in a specific match room
  getUsersInMatchRoom(matchId) {
    return this.matchRooms.get(matchId) || new Set();
  }

  // Get all active match rooms
  getActiveMatchRooms() {
    return Array.from(this.matchRooms.keys());
  }

  // Send typing indicator for posts
  handleTypingIndicator(postId, userId, isTyping) {
    this.io.to('community').emit('typing', {
      postId,
      userId,
      isTyping,
      timestamp: new Date(),
    });
  }

  // Send typing indicator for match rooms (e.g., when commenting on analysis)
  handleMatchTypingIndicator(matchId, userId, isTyping) {
    this.sendToMatchRoom(matchId, 'matchTyping', {
      matchId,
      userId,
      isTyping,
      timestamp: new Date(),
    });
  }

  // Handle bulk operations
  async handleBulkMatchUpdate(matches, updatedBy, updateType) {
    const bulkUpdateData = {
      matches: matches.map((match) => ({
        _id: match._id,
        status: match.analysisStatus,
      })),
      updateType,
      updatedBy: {
        _id: updatedBy._id,
        fullName: updatedBy.fullName,
        image: updatedBy.image,
      },
      timestamp: new Date(),
    };

    // Send to user who initiated the bulk update
    this.sendToUser(
      updatedBy._id.toString(),
      'bulkMatchUpdate',
      bulkUpdateData
    );
  }

  // Handle system maintenance notifications
  broadcastMaintenanceNotification(maintenanceInfo) {
    this.io.emit('systemMaintenance', {
      ...maintenanceInfo,
      timestamp: new Date(),
    });
  }

  // Handle user session events
  handleUserSessionEvent(userId, event, data = {}) {
    this.sendToUser(userId, 'sessionEvent', {
      event,
      data,
      timestamp: new Date(),
    });
  }

  // Enhanced error handling for match operations
  handleMatchOperationError(userId, operation, error, matchId = null) {
    const errorData = {
      operation,
      error: error.message || 'An error occurred',
      matchId,
      timestamp: new Date(),
    };

    this.sendToUser(userId, 'matchOperationError', errorData);
  }

  // Handle real-time match statistics updates
  handleMatchStatsUpdate(matchId, stats) {
    const statsData = {
      matchId,
      stats,
      timestamp: new Date(),
    };

    this.sendToMatchRoom(matchId, 'matchStatsUpdated', statsData);
  }

  // Handle user achievement notifications for matches
  handleMatchAchievement(userId, achievement) {
    const achievementData = {
      achievement,
      timestamp: new Date(),
    };

    this.sendToUser(userId, 'matchAchievement', achievementData);
  }

  // Clean up resources when shutting down
  cleanup() {
    if (this.io) {
      this.io.close();
    }
    this.connectedUsers.clear();
    this.userSockets.clear();
    this.matchRooms.clear();
  }
}

export default new WebSocketService();

// // src/services/websocketService.js (Updated with notification integration)
// import { Server } from 'socket.io';
// import jwt from 'jsonwebtoken';
// import User from '../models/User.js';
// import notificationService from './notificationService.js';

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

//       // Send unread notification count on connect
//       this.sendUnreadCount(socket.userId);

//       // Handle disconnection
//       socket.on('disconnect', () => {
//         console.log(`User ${socket.userId} disconnected`);
//         this.connectedUsers.delete(socket.userId);
//         this.userSockets.delete(socket.id);
//         this.broadcastUserStatus(socket.userId, 'offline');
//       });

//       // Handle notification events from client
//       socket.on('markNotificationRead', async (notificationId) => {
//         try {
//           // You could handle this here or let the HTTP API handle it
//           console.log(
//             `User ${socket.userId} marked notification ${notificationId} as read`
//           );
//         } catch (error) {
//           console.error('Error marking notification as read:', error);
//         }
//       });

//       // Handle real-time notification preferences
//       socket.on('updateNotificationPreferences', (preferences) => {
//         // Store user preferences for real-time notifications
//         console.log(
//           `User ${socket.userId} updated notification preferences:`,
//           preferences
//         );
//       });
//     });

//     return this.io;
//   }

//   // Send notification to specific user
//   sendNotificationToUser(userId, notification) {
//     this.io.to(`user_${userId}`).emit('notification', notification);
//     // Also send updated unread count
//     this.sendUnreadCount(userId);
//   }

//   // Send unread notification count to user
//   async sendUnreadCount(userId) {
//     try {
//       const unreadCount =
//         (await notificationService.getUnreadCount?.(userId)) || 0;
//       this.io.to(`user_${userId}`).emit('unreadCount', { count: unreadCount });
//     } catch (error) {
//       console.error('Error sending unread count:', error);
//     }
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

//   // Handle like - create notification and broadcast UI update
//   async handleLikeNotification(postId, likedBy, postOwner) {
//     // 1. Create notification in database and send to post owner
//     if (postOwner._id.toString() !== likedBy._id.toString()) {
//       await notificationService.handleLikeNotification(
//         postId,
//         likedBy,
//         postOwner
//       );
//     }

//     // 2. Broadcast like update to community for real-time UI update
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

//   // Handle new reply - create notification and broadcast
//   async handleReplyNotification(postId, replyBy, postOwner, reply) {
//     // 1. Create notification in database and send to post owner
//     if (postOwner._id.toString() !== replyBy._id.toString()) {
//       await notificationService.handleReplyNotification(
//         postId,
//         replyBy,
//         postOwner,
//         reply
//       );
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

//   // Handle reply like - create notification and broadcast
//   async handleReplyLikeNotification(postId, replyId, likedBy, replyOwner) {
//     // 1. Create notification in database and send to reply owner
//     if (replyOwner._id.toString() !== likedBy._id.toString()) {
//       await notificationService.handleReplyLikeNotification(
//         postId,
//         replyId,
//         likedBy,
//         replyOwner
//       );
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
//   async handleFollowNotification(followedUser, follower) {
//     await notificationService.handleFollowNotification(followedUser, follower);
//   }

//   // Broadcast system-wide announcements
//   broadcastAnnouncement(announcement) {
//     this.io.emit('announcement', {
//       ...announcement,
//       timestamp: new Date(),
//     });
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

//   // Send typing indicator
//   handleTypingIndicator(postId, userId, isTyping) {
//     this.io.to('community').emit('typing', {
//       postId,
//       userId,
//       isTyping,
//       timestamp: new Date(),
//     });
//   }
// }

// export default new WebSocketService();

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
