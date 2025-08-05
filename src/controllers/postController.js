import {
  createPostService,
  createPostWithUrlService,
  getPostByUserService,
  getPostService,
  getPostsService,
  likePostService,
  unlikePostService,
} from '../services/postService.js';
import catchAsync from '../utils/catchAsync.js';

export const createPost = catchAsync(async (req, res, next) => {
  createPostService(req, res, next);
});

export const createPostWithUrl = catchAsync(async (req, res, next) => {
  createPostWithUrlService(req, res, next);
});

export const getAllPosts = catchAsync(async (req, res, next) => {
  getPostsService(req, res, next);
});

export const likePost = catchAsync(async (req, res, next) => {
  likePostService(req, res, next);
});

export const unlikePost = catchAsync(async (req, res, next) => {
  unlikePostService(req, res, next);
});

export const getPost = catchAsync(async (req, res, next) => {
  getPostService(req, res, next);
});

export const getPostByUser = catchAsync(async (req, res, next) => {
  getPostByUserService(req, res, next);
});
