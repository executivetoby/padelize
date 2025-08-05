import mongoose from 'mongoose';
import {
  createOne,
  deleteMany,
  deleteOne,
  findOne,
  getAll,
  updateOne,
} from '../factory/repo.js';
import Like from '../models/Like.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import { uploadLargeFile } from './s3UploadService.js';
import fs from 'fs';
import Reply from '../models/Reply.js';
import webSocketService from './webSocketService.js';

export const createPostService = catchAsync(async (req, res, next) => {
  const { _id } = req.user;
  const { content } = req.body;

  if (!content) {
    return next(new AppError('Content is required', 400));
  }

  const postData = {
    user: _id,
    content,
  };

  if (req.file) {
    const { path: tempPath, originalname } = req.file;

    const result = await uploadLargeFile(tempPath, originalname);

    if (!result) return next(new AppError('Error uploading file', 500));

    fs.unlinkSync(tempPath);

    postData.attachment = result.Location;
  } else {
    postData.attachment = req.body.attachment;
  }

  const post = await createOne(Post, postData);

  // Populate the post with author info for real-time broadcast
  const populatedPost = await Post.findById(post._id).populate({
    path: 'user',
    select: 'fullName image',
  });

  // 🔥 REAL-TIME: Broadcast new post to all connected users
  webSocketService.handleNewPost(populatedPost, req.user);

  res.status(201).json({
    status: 'success',
    message: 'Post created successfully',
    data: {
      post,
    },
  });
});

export const createPostWithUrlService = catchAsync(async (req, res, next) => {
  const { _id } = req.user;
  const { content, attachment } = req.body;

  if (!content || !attachment) {
    return next(new AppError('Content and attachment are required', 400));
  }

  const postData = {
    user: _id,
    content,
    attachment,
  };

  const post = await createOne(Post, postData);

  // Populate the post with author info for real-time broadcast
  const populatedPost = await Post.findById(post._id).populate({
    path: 'user',
    select: 'fullName image',
  });

  // 🔥 REAL-TIME: Broadcast new post to all connected users
  webSocketService.handleNewPost(populatedPost, req.user);

  res.status(201).json({
    status: 'success',
    message: 'Post created successfully',
    data: {
      post,
    },
  });
});

export const getPostsService = catchAsync(async (req, res, next) => {
  const posts = await Post.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'author',
        pipeline: [{ $project: { fullName: 1, image: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'likes',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$postId'] },
                  { $eq: ['$targetType', 'Post'] },
                ],
              },
            },
          },
        ],
        as: 'postLikes',
      },
    },
    {
      $lookup: {
        from: 'likes',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$postId'] },
                  { $eq: ['$targetType', 'Post'] },
                  { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
                ],
              },
            },
          },
        ],
        as: 'currentUserLike',
      },
    },
    {
      $addFields: {
        author: { $arrayElemAt: ['$author', 0] },
        likeCount: { $size: '$postLikes' },
        isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
      },
    },
    { $unset: ['postLikes', 'currentUserLike'] },
    { $sort: { createdAt: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      posts,
    },
  });
});

export const getPostService = catchAsync(async (req, res, next) => {
  const postWithReplies = await Post.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.params.postId) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'author',
        pipeline: [{ $project: { fullName: 1, image: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'likes',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$postId'] },
                  { $eq: ['$targetType', 'Post'] },
                ],
              },
            },
          },
        ],
        as: 'postLikes',
      },
    },
    {
      $lookup: {
        from: 'likes',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$postId'] },
                  { $eq: ['$targetType', 'Post'] },
                  { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
                ],
              },
            },
          },
        ],
        as: 'currentUserLike',
      },
    },
    {
      $lookup: {
        from: 'replies',
        localField: '_id',
        foreignField: 'postId',
        as: 'replies',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'replyAuthor',
              pipeline: [{ $project: { fullName: 1, image: 1 } }],
            },
          },
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
                      ],
                    },
                  },
                },
              ],
              as: 'replyLikes',
            },
          },
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
                        {
                          $eq: [
                            '$user',
                            new mongoose.Types.ObjectId(req.user._id),
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
              as: 'currentUserReplyLike',
            },
          },
          {
            $addFields: {
              replyAuthor: { $arrayElemAt: ['$replyAuthor', 0] },
              likeCount: { $size: '$replyLikes' },
              isLiked: { $gt: [{ $size: '$currentUserReplyLike' }, 0] },
            },
          },
          { $unset: ['replyLikes', 'currentUserReplyLike'] },
        ],
      },
    },
    {
      $addFields: {
        author: { $arrayElemAt: ['$author', 0] },
        likeCount: { $size: '$postLikes' },
        isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
      },
    },
    { $unset: ['postLikes', 'currentUserLike'] },
  ]);

  const postObj = postWithReplies[0];

  if (!postObj) return next(new AppError('Post not found', 404));

  res.status(200).json({
    status: 'success',
    message: 'Post fetched successfully',
    data: {
      post: postObj,
    },
  });
});

export const updatePostService = catchAsync(async (req, res, next) => {
  const postData = {};

  if (req.file) {
    const { path: tempPath, originalname } = req.file;

    const result = await uploadLargeFile(tempPath, originalname);

    if (!result) return next(new AppError('Error uploading file', 500));

    await fs.promises.unlinkSync(tempPath);

    postData.attachment = result.Location;
  }

  if (req.body.content) postData.content = req.body.content;

  const post = await updateOne(Post, { _id: req.params.postId }, postData);

  // 🔥 REAL-TIME: Broadcast post update to all users
  webSocketService.handlePostUpdate(req.params.postId, postData, req.user);

  res.status(200).json({
    status: 'success',
    message: 'Post updated successfully',
    data: {
      post,
    },
  });
});

export const deletePostService = catchAsync(async (req, res, next) => {
  const post = await deleteOne(Post, { _id: req.params.postId });

  if (!post) return next(new AppError('Post not found', 404));

  await deleteMany(Like, {
    target: req.params.postId,
  });

  await deleteMany(Reply, {
    postId: req.params.postId,
  });

  // 🔥 REAL-TIME: Broadcast post deletion to all users
  webSocketService.handlePostDeletion(req.params.postId, req.user);

  res.status(200).json({
    status: 'success',
    message: 'Post deleted successfully',
    data: {
      post,
    },
  });
});

export const likePostService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;

  const post = await findOne(Post, {
    _id: new mongoose.Types.ObjectId(req.params.postId),
  });

  if (!post) return next(new AppError('Post not found', 404));

  // Check if already liked
  const existingLike = await findOne(Like, {
    user: userId,
    target: req.params.postId,
    targetType: 'Post',
  });

  if (existingLike) {
    return next(new AppError('Post already liked', 400));
  }

  await createOne(Like, {
    user: userId,
    target: req.params.postId,
    targetType: 'Post',
  });

  // Get updated like count
  const likeCount = await Like.countDocuments({
    target: req.params.postId,
    targetType: 'Post',
  });

  // Get post owner info
  const postOwner = await findOne(User, { _id: post.user });

  // 🔥 REAL-TIME: Send like notification to post owner and broadcast UI update
  if (postOwner && userId.toString() !== postOwner._id.toString()) {
    webSocketService.handleLikeNotification(
      req.params.postId,
      req.user,
      postOwner
    );
  } else {
    // If user liked their own post, just broadcast the UI update
    webSocketService.handleUnlikeUpdate(req.params.postId, req.user);
  }

  res.status(200).json({
    status: 'success',
    message: 'Post liked successfully',
    data: {
      likeCount,
    },
  });
});

export const unlikePostService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;

  const post = await findOne(Post, { _id: req.params.postId });

  if (!post) return next(new AppError('Post not found', 404));

  await deleteOne(Like, {
    user: userId,
    target: req.params.postId,
    targetType: 'Post',
  });

  // Get updated like count
  const likeCount = await Like.countDocuments({
    target: req.params.postId,
    targetType: 'Post',
  });

  // 🔥 REAL-TIME: Broadcast unlike update to all users for UI update
  webSocketService.handleUnlikeUpdate(req.params.postId, req.user);

  res.status(200).json({
    status: 'success',
    message: 'Post disliked successfully',
    data: {
      likeCount,
    },
  });
});

export const getPostByUserService = catchAsync(async (req, res, next) => {
  const userId = req.query.userId || req.user._id;

  const posts = await Post.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'author',
        pipeline: [{ $project: { fullName: 1, image: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'likes',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$postId'] },
                  { $eq: ['$targetType', 'Post'] },
                ],
              },
            },
          },
        ],
        as: 'postLikes',
      },
    },
    {
      $lookup: {
        from: 'likes',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$target', '$$postId'] },
                  { $eq: ['$targetType', 'Post'] },
                  { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
                ],
              },
            },
          },
        ],
        as: 'currentUserLike',
      },
    },
    {
      $addFields: {
        author: { $arrayElemAt: ['$author', 0] },
        likeCount: { $size: '$postLikes' },
        isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
      },
    },
    { $unset: ['postLikes', 'currentUserLike'] },
    { $sort: { createdAt: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    message: 'Post fetched successfully',
    length: posts.length,
    data: {
      posts,
    },
  });
});

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

export const likeReplyService = catchAsync(async (req, res, next) => {
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

export const unlikeReplyService = catchAsync(async (req, res, next) => {
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

// import mongoose from 'mongoose';
// import {
//   createOne,
//   deleteMany,
//   deleteOne,
//   findOne,
//   getAll,
//   updateOne,
// } from '../factory/repo.js';
// import Like from '../models/Like.js';
// import Post from '../models/Post.js';
// import AppError from '../utils/appError.js';
// import catchAsync from '../utils/catchAsync.js';
// import { uploadLargeFile } from './s3UploadService.js';
// import fs from 'fs';
// import Reply from '../models/Reply.js';

// export const createPostService = catchAsync(async (req, res, next) => {
//   const { _id } = req.user;
//   const { content } = req.body;

//   if (!content) {
//     return next(new AppError('Content is required', 400));
//   }

//   const postData = {
//     user: _id,
//     content,
//   };

//   if (req.file) {
//     const { path: tempPath, originalname } = req.file;

//     const result = await uploadLargeFile(tempPath, originalname);

//     if (!result) return next(new AppError('Error uploading file', 500));

//     fs.unlinkSync(tempPath);

//     postData.attachment = result.Location;
//   }

//   const post = await createOne(Post, postData);

//   res.status(201).json({
//     status: 'success',
//     message: 'Post created successfully',
//     data: {
//       post,
//     },
//   });
// });

// export const getPostsService = catchAsync(async (req, res, next) => {
//   const posts = await Post.aggregate([
//     {
//       $lookup: {
//         from: 'users',
//         localField: 'user',
//         foreignField: '_id',
//         as: 'author',
//         pipeline: [{ $project: { fullName: 1, image: 1 } }],
//       },
//     },
//     {
//       $lookup: {
//         from: 'likes',
//         let: { postId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$target', '$$postId'] },
//                   { $eq: ['$targetType', 'Post'] },
//                 ],
//               },
//             },
//           },
//         ],
//         as: 'postLikes',
//       },
//     },
//     {
//       $lookup: {
//         from: 'likes',
//         let: { postId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$target', '$$postId'] },
//                   { $eq: ['$targetType', 'Post'] },
//                   { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
//                 ],
//               },
//             },
//           },
//         ],
//         as: 'currentUserLike',
//       },
//     },
//     {
//       $addFields: {
//         author: { $arrayElemAt: ['$author', 0] },
//         likeCount: { $size: '$postLikes' },
//         isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
//       },
//     },
//     { $unset: ['postLikes', 'currentUserLike'] },
//     { $sort: { createdAt: -1 } },
//   ]);

//   res.status(200).json({
//     status: 'success',
//     data: {
//       posts,
//     },
//   });
// });

// export const getPostService = catchAsync(async (req, res, next) => {
//   // const post = await findOne(
//   //   Post,
//   //   { _id: req.params.postId },
//   //   { path: 'user', select: 'fullName image' },
//   //   'stats'
//   // );

//   // if (!post) return next(new AppError('Post not found', 404));

//   // console.log({ post });

//   // const postObj = post.toObject();

//   // postObj.replies = await Reply.aggregate([
//   //   // 1. Match replies for a post
//   //   { $match: { postId: new mongoose.Types.ObjectId(req.params.postId) } },
//   //   // 2. Join with Users for author details
//   //   {
//   //     $lookup: {
//   //       from: 'users',
//   //       localField: 'user',
//   //       foreignField: '_id',
//   //       as: 'author',
//   //       pipeline: [{ $project: { username: 1, avatar: 1 } }],
//   //     },
//   //   },
//   //   // 3. Join with Likes (targetType: Reply)
//   //   {
//   //     $lookup: {
//   //       from: 'likes',
//   //       let: { replyId: '$_id' },
//   //       pipeline: [
//   //         {
//   //           $match: {
//   //             $expr: {
//   //               $and: [
//   //                 { $eq: ['$target', '$$replyId'] },
//   //                 { $eq: ['$targetType', 'Reply'] }, // Only reply likes
//   //               ],
//   //             },
//   //           },
//   //         },
//   //       ],
//   //       as: 'replyLikes',
//   //     },
//   //   },
//   //   // 4. Check if current user liked the reply
//   //   {
//   //     $lookup: {
//   //       from: 'likes',
//   //       let: { replyId: '$_id' },
//   //       pipeline: [
//   //         {
//   //           $match: {
//   //             $expr: {
//   //               $and: [
//   //                 { $eq: ['$target', '$$replyId'] },
//   //                 { $eq: ['$targetType', 'Reply'] },
//   //                 { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
//   //               ],
//   //             },
//   //           },
//   //         },
//   //       ],
//   //       as: 'currentUserLike',
//   //     },
//   //   },
//   //   // 5. Add computed fields
//   //   {
//   //     $addFields: {
//   //       author: { $arrayElemAt: ['$author', 0] },
//   //       likeCount: { $size: '$replyLikes' },
//   //       isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
//   //     },
//   //   },
//   //   // 6. Cleanup
//   //   { $unset: ['replyLikes', 'currentUserLike'] },
//   //   { $sort: { createdAt: -1 } },
//   // ]);

//   // console.log({
//   //   replies: post.replies,
//   //   stats: postObj.stats,
//   //   stats2: post.stats,
//   // });

//   const postWithReplies = await Post.aggregate([
//     // 1. Match the post
//     { $match: { _id: new mongoose.Types.ObjectId(req.params.postId) } },

//     // 2. Get author details (existing logic)
//     {
//       $lookup: {
//         from: 'users',
//         localField: 'user',
//         foreignField: '_id',
//         as: 'author',
//         pipeline: [{ $project: { fullName: 1, image: 1 } }],
//       },
//     },

//     // 3. Get post likes (existing logic)
//     {
//       $lookup: {
//         from: 'likes',
//         let: { postId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$target', '$$postId'] },
//                   { $eq: ['$targetType', 'Post'] },
//                 ],
//               },
//             },
//           },
//         ],
//         as: 'postLikes',
//       },
//     },
//     {
//       $lookup: {
//         from: 'likes',
//         let: { postId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$target', '$$postId'] },
//                   { $eq: ['$targetType', 'Post'] },
//                   { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
//                 ],
//               },
//             },
//           },
//         ],
//         as: 'currentUserLike',
//       },
//     },

//     // 4. Get replies WITH LIKE DATA
//     {
//       $lookup: {
//         from: 'replies', // Reply collection name
//         localField: '_id', // Post ID
//         foreignField: 'postId', // Field in replies referencing the post
//         as: 'replies',
//         pipeline: [
//           // Include reply author details
//           {
//             $lookup: {
//               from: 'users',
//               localField: 'user',
//               foreignField: '_id',
//               as: 'replyAuthor',
//               pipeline: [{ $project: { fullName: 1, image: 1 } }],
//             },
//           },
//           // Get likes for this reply
//           {
//             $lookup: {
//               from: 'likes',
//               let: { replyId: '$_id' },
//               pipeline: [
//                 {
//                   $match: {
//                     $expr: {
//                       $and: [
//                         { $eq: ['$target', '$$replyId'] },
//                         { $eq: ['$targetType', 'Reply'] },
//                       ],
//                     },
//                   },
//                 },
//               ],
//               as: 'replyLikes',
//             },
//           },
//           // Check if current user liked this reply
//           {
//             $lookup: {
//               from: 'likes',
//               let: { replyId: '$_id' },
//               pipeline: [
//                 {
//                   $match: {
//                     $expr: {
//                       $and: [
//                         { $eq: ['$target', '$$replyId'] },
//                         { $eq: ['$targetType', 'Reply'] },
//                         {
//                           $eq: [
//                             '$user',
//                             new mongoose.Types.ObjectId(req.user._id),
//                           ],
//                         },
//                       ],
//                     },
//                   },
//                 },
//               ],
//               as: 'currentUserReplyLike',
//             },
//           },
//           // Add likeCount/isLiked fields
//           {
//             $addFields: {
//               replyAuthor: { $arrayElemAt: ['$replyAuthor', 0] },
//               likeCount: { $size: '$replyLikes' },
//               isLiked: { $gt: [{ $size: '$currentUserReplyLike' }, 0] },
//             },
//           },
//           // Remove temporary fields
//           { $unset: ['replyLikes', 'currentUserReplyLike'] },
//         ],
//       },
//     },

//     // 5. Final transformations for the post
//     {
//       $addFields: {
//         author: { $arrayElemAt: ['$author', 0] },
//         likeCount: { $size: '$postLikes' },
//         isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
//       },
//     },
//     { $unset: ['postLikes', 'currentUserLike'] },
//   ]);

//   const postObj = postWithReplies[0];

//   if (!postObj) return next(new AppError('Post not found', 404));

//   res.status(200).json({
//     status: 'success',
//     message: 'Post fetched successfully',
//     data: {
//       post: postObj,
//     },
//   });
// });

// export const updatePostService = catchAsync(async (req, res, next) => {
//   const postData = {};

//   if (req.file) {
//     const { path: tempPath, originalname } = req.file;

//     const result = await uploadLargeFile(tempPath, originalname);

//     if (!result) return next(new AppError('Error uploading file', 500));

//     await fs.promises.unlinkSync(tempPath);

//     postData.attachment = result.Location;
//   }

//   if (req.body.content) postData.content = req.body.content;

//   const post = await updateOne(Post, { _id: req.params.postId }, req.body);

//   res.status(200).json({
//     status: 'success',
//     message: 'Post updated successfully',
//     data: {
//       post,
//     },
//   });
// });

// export const deletePostService = catchAsync(async (req, res, next) => {
//   const post = await deleteOne(Post, { _id: req.params.postId });

//   if (!post) return next(new AppError('Post not found', 404));

//   await deleteMany(Like, {
//     target: req.params.postId,
//   });

//   await deleteMany(Reply, {
//     postId: req.params.postId,
//   });

//   await res.status(200).json({
//     status: 'success',
//     message: 'Post deleted successfully',
//     data: {
//       post,
//     },
//   });
// });

// export const likePostService = catchAsync(async (req, res, next) => {
//   const { _id: userId } = req.user;

//   const post = await findOne(Post, {
//     _id: new mongoose.Types.ObjectId(req.params.postId),
//   });

//   if (!post) return next(new AppError('Post not found', 404));

//   await createOne(Like, {
//     user: userId,
//     target: req.params.postId,
//     targetType: 'Post',
//   });

//   res.status(200).json({
//     status: 'success',
//     message: 'Post liked successfully',
//     data: {},
//   });
// });

// export const unlikePostService = catchAsync(async (req, res, next) => {
//   const { _id: userId } = req.user;

//   const post = await findOne(Post, { _id: req.params.postId });

//   if (!post) return next(new AppError('Post not found', 404));

//   await deleteOne(Like, {
//     user: userId,
//     target: req.params.postId,
//     targetType: 'Post',
//   });

//   res.status(200).json({
//     status: 'success',
//     message: 'Post disliked successfully',
//     data: {},
//   });
// });

// export const getPostByUserService = catchAsync(async (req, res, next) => {
//   const userId = req.query.userId || req.user._id;

//   const posts = await Post.aggregate([
//     { $match: { user: new mongoose.Types.ObjectId(userId) } },
//     {
//       $lookup: {
//         from: 'users',
//         localField: 'user',
//         foreignField: '_id',
//         as: 'author',
//         pipeline: [{ $project: { fullName: 1, image: 1 } }],
//       },
//     },
//     {
//       $lookup: {
//         from: 'likes',
//         let: { postId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$target', '$$postId'] },
//                   { $eq: ['$targetType', 'Post'] },
//                 ],
//               },
//             },
//           },
//         ],
//         as: 'postLikes',
//       },
//     },
//     {
//       $lookup: {
//         from: 'likes',
//         let: { postId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ['$target', '$$postId'] },
//                   { $eq: ['$targetType', 'Post'] },
//                   { $eq: ['$user', new mongoose.Types.ObjectId(req.user._id)] },
//                 ],
//               },
//             },
//           },
//         ],
//         as: 'currentUserLike',
//       },
//     },
//     {
//       $addFields: {
//         author: { $arrayElemAt: ['$author', 0] },
//         likeCount: { $size: '$postLikes' },
//         isLiked: { $gt: [{ $size: '$currentUserLike' }, 0] },
//       },
//     },
//     { $unset: ['postLikes', 'currentUserLike'] },
//     { $sort: { createdAt: -1 } },
//   ]);

//   res.status(200).json({
//     status: 'success',
//     message: 'Post fetched successfully',
//     length: posts.length,
//     data: {
//       posts,
//     },
//   });
// });

// // export const getPostsService = catchAsync(async (req, res, next) => {
// //   const posts = await getAll(Post, req.query);

// //   res.status(200).json({
// //     status: 'success',
// //     message: 'Posts fetched successfully',
// //     data: {
// //       posts,
// //     },
// //   });
// // });
