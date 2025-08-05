import mongoose from 'mongoose';
import Reply from '../models/Reply.js';
import { createOne, deleteOne, findOne } from '../factory/repo.js';
import Like from '../models/Like.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import Post from '../models/Post.js';
import webSocketService from './webSocketService.js';
import User from '../models/User.js';

export const createReplyService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;
  const { content } = req.body;
  const { postId } = req.params;

  if (!content) {
    return next(new AppError('Reply content is required', 400));
  }

  const post = await findOne(Post, { _id: postId });
  if (!post) return next(new AppError('Post not found', 404));

  const reply = await createOne(Reply, {
    user: userId,
    postId,
    content,
  });

  // Populate reply with author info
  const populatedReply = await Reply.findById(reply._id).populate({
    path: 'user',
    select: 'fullName image',
  });

  // Get post owner info
  const postOwner = await findOne(User, { _id: post.user });

  // 🔥 REAL-TIME: Send reply notification to post owner and broadcast to community
  webSocketService.handleReplyNotification(
    postId,
    req.user,
    postOwner,
    populatedReply
  );

  res.status(201).json({
    status: 'success',
    message: 'Reply created successfully',
    data: {
      reply: populatedReply,
    },
  });
});

export const getAllRepliesForAPost = catchAsync(async (req, res, next) => {
  const { postId } = req.params;

  const replies = await Reply.aggregate([
    // 1. Match replies for a post
    { $match: { postId: new mongoose.Types.ObjectId(postId) } },
    // 2. Join with Users for author details
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'author',
        pipeline: [{ $project: { fullName: 1, image: 1 } }],
      },
    },
    // 3. Join with Likes (targetType: Reply)
    {
      $lookup: {
        from: 'likes',
        let: { replyId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$replyId'] },
                  { $eq: ['$targetType', 'Reply'] }, // Only reply likes
                ],
              },
            },
          },
        ],
        as: 'replyLikes',
      },
    },
    // 4. Check if current user liked the reply
    {
      $lookup: {
        from: 'likes',
        let: { replyId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$replyId'] },
                  { $eq: ['$targetType', 'Reply'] },
                  { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
                ],
              },
            },
          },
        ],
        as: 'currentUserLike',
      },
    },
    // 5. Add computed fields
    {
      $addFields: {
        author: { $arrayElemAt: ['$author', 0] },
        likeCount: { $size: '$replyLikes' },
        isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
      },
    },
    // 6. Cleanup
    { $unset: ['replyLikes', 'currentUserLike'] },
    { $sort: { createdAt: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      replies,
    },
  });
});

export const likeAReplyService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;
  const { replyId } = req.params;

  const reply = await findOne(Reply, { _id: replyId });
  if (!reply) return next(new AppError('Reply not found', 404));

  // Check if already liked
  const existingLike = await findOne(Like, {
    user: userId,
    target: replyId,
    targetType: 'Reply',
  });

  if (existingLike) {
    return next(new AppError('Reply already liked', 400));
  }

  await createOne(Like, {
    user: userId,
    target: replyId,
    targetType: 'Reply',
  });

  // Get updated like count
  const likeCount = await Like.countDocuments({
    target: replyId,
    targetType: 'Reply',
  });

  // Get reply owner info
  const replyOwner = await findOne(User, { _id: reply.user });

  // 🔥 REAL-TIME: Send notification to reply owner and broadcast UI update
  if (replyOwner && userId.toString() !== replyOwner._id.toString()) {
    webSocketService.handleReplyLikeNotification(
      reply.postId,
      replyId,
      req.user,
      replyOwner
    );
  } else {
    // If user liked their own reply, just broadcast the UI update
    webSocketService.handleReplyUnlikeUpdate(reply.postId, replyId, req.user);
  }

  res.status(200).json({
    status: 'success',
    message: 'Reply liked successfully',
    data: {
      likeCount,
    },
  });
});

export const unlikeAReplyService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;
  const { replyId } = req.params;

  const reply = await findOne(Reply, { _id: replyId });
  if (!reply) return next(new AppError('Reply not found', 404));

  await deleteOne(Like, {
    user: userId,
    target: replyId,
    targetType: 'Reply',
  });

  // Get updated like count
  const likeCount = await Like.countDocuments({
    target: replyId,
    targetType: 'Reply',
  });

  // 🔥 REAL-TIME: Broadcast reply unlike update to community
  webSocketService.handleReplyUnlikeUpdate(reply.postId, replyId, req.user);

  res.status(200).json({
    status: 'success',
    message: 'Reply unliked successfully',
    data: {
      likeCount,
    },
  });
});

// export const likeAReplyService = catchAsync(async (req, res, next) => {
//   const { postId } = req.params;

//   const reply = await findOne(Reply, {
//     postId,
//   });

//   if (!reply) return next(new AppError('Reply not found', 404));

//   const likedReply = await findOne(Like, {
//     user: req.user._id,
//     target: reply._id,
//     targetType: 'Reply',
//   });

//   if (!likedReply) {
//     await createOne(Like, {
//       user: req.user._id,
//       target: reply._id,
//       targetType: 'Reply',
//     });
//   } else {
//     return next(new AppError('You have already liked this reply', 400));
//   }

//   res.status(200).json({
//     status: 'success',
//     message: 'Reply liked successfully',
//     data: {},
//   });
// });

// export const unlikeAReplyService = catchAsync(async (req, res, next) => {
//   const { postId } = req.params;

//   const reply = await findOne(Reply, {
//     postId,
//   });

//   if (!reply) return next(new AppError('Reply not found', 404));

//   const likedReply = await findOne(Like, {
//     user: req.user._id,
//     target: reply._id,
//     targetType: 'Reply',
//   });

//   if (!likedReply) {
//     return next(new AppError('You have not liked this reply yet', 400));
//   } else {
//     await deleteOne(Like, {
//       user: req.user._id,
//       target: reply._id,
//       targetType: 'Reply',
//     });
//   }

//   res.status(200).json({
//     status: 'success',
//     message: 'Reply unliked successfully',
//     data: {},
//   });
// });
