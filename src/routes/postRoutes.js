import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  createPost,
  createPostWithUrl,
  getAllPosts,
  getPost,
  getPostByUser,
  likePost,
  unlikePost,
} from '../controllers/postController.js';
import { attachmentUpload } from '../services/s3UploadService.js';
import replyRoutes from './replyRoutes.js';

const router = Router();

router.use(protect);
router.use('/:postId/replies', replyRoutes);

router.post('/', attachmentUpload, createPost);
router.get('/', getAllPosts);
router.post('/url', createPostWithUrl);
router.get('/user', getPostByUser);
router.get('/:postId', getPost);
router.patch('/:postId/like', likePost);
router.patch('/:postId/unlike', unlikePost);

export default router;
