import { createOne, deleteOne, findOne, getAll } from '../factory/repo.js';
import Follow from '../models/Follow.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

export const followUserService = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { _id } = req.user;

  if (_id.toString() === userId) {
    return next(new AppError('You cannot follow yourself'));
  }

  const existingFollow = await findOne(Follow, {
    follower: _id,
    following: userId,
  });

  if (existingFollow) {
    return next(new AppError('You are already following this user'));
  }

  const follow = await createOne(Follow, {
    follower: _id,
    following: userId,
  });

  res.status(201).json({
    status: 'success',
    message: 'Followed successfully',
    data: {
      follow,
    },
  });
});

export const unfollowUserService = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { _id } = req.user;

  if (_id.toString() === userId) {
    return next(new Error('You cannot unfollow yourself'));
  }

  const follow = await deleteOne(Follow, {
    follower: _id,
    following: userId,
  });

  if (!follow) {
    return next(new Error('You are not following this user'));
  }

  res.status(200).json({
    status: 'success',
    message: 'Unfollowed successfully',
  });
});

export const getFollowersService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;

  const followers = await getAll(Follow, { following: userId }, 'follower');

  res.status(200).json({
    status: 'success',
    data: {
      followers,
    },
  });
});

export const getFollowingService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;

  const following = await getAll(Follow, { follower: userId }, 'following');

  res.status(200).json({
    status: 'success',
    data: {
      following,
    },
  });
});

export const getCountsOfFollowshipService = catchAsync(
  async (req, res, next) => {
    const { _id: userId } = req.user;

    const followersCount = await Follow.countDocuments({ following: userId });
    const followingCount = await Follow.countDocuments({ follower: userId });

    res.status(200).json({
      status: 'success',
      data: {
        followersCount,
        followingCount,
      },
    });
  }
);
