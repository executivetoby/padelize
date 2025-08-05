import {
  createReplyService,
  getAllRepliesForAPost,
  likeAReplyService,
  unlikeAReplyService,
} from '../services/replyService.js';
import catchAsync from '../utils/catchAsync.js';

export const createReply = catchAsync(async (req, res, next) => {
  createReplyService(req, res, next);
});

export const getAllReplies = catchAsync(async (req, res, next) => {
  getAllRepliesForAPost(req, res, next);
});

export const likeReply = catchAsync(async (req, res, next) => {
  likeAReplyService(req, res, next);
});

export const unlikeReply = catchAsync(async (req, res, next) => {
  unlikeAReplyService(req, res, next);
});
