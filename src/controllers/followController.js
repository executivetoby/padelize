import {
  followUserService,
  getCountsOfFollowshipService,
  getFollowersService,
  getFollowingService,
  unfollowUserService,
} from '../services/followService.js';
import catchAsync from '../utils/catchAsync.js';

export const followUser = catchAsync(async (req, res, next) => {
  followUserService(req, res, next);
});

export const unfollowUser = catchAsync(async (req, res, next) => {
  unfollowUserService(req, res, next);
});

export const getFollowers = catchAsync(async (req, res, next) => {
  getFollowersService(req, res, next);
});

export const getFollowing = catchAsync(async (req, res, next) => {
  getFollowingService(req, res, next);
});

export const getCountsOfFollowship = catchAsync(async (req, res, next) => {
  getCountsOfFollowshipService(req, res, next);
});
