import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  createReply,
  getAllReplies,
  likeReply,
  unlikeReply,
} from '../controllers/replyController.js';

const router = Router({ mergeParams: true });

console.log('We got here!!');

router.use(protect);

router.post('/', createReply);
router.get('/', getAllReplies);
router.patch('/:replyId/like', likeReply);
router.patch('/:replyId/unlike', unlikeReply);

export default router;
