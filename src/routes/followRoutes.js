import { Router } from 'express';
import {
  followUser,
  getCountsOfFollowship,
  getFollowers,
  getFollowing,
  unfollowUser,
} from '../controllers/followController.js';
import { protect } from '../controllers/authController.js';

const router = Router();

router.use(protect);

router.post('/:userId/follow', followUser);
router.delete('/:userId/unfollow', unfollowUser);
router.get('/followers', getFollowers);
router.get('/following', getFollowing);
router.get('/count', getCountsOfFollowship);

export default router;
