import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  createMatch,
  deleteMatch,
  getAllMatches,
  getMatch,
  getUserProfile,
  updateMatch,
  uploadVideo,
} from '../controllers/matchController.js';
import { videoUpload } from '../services/s3UploadService.js';

const router = Router();

router.use(protect);

router.route('/').get(getAllMatches).post(createMatch);
router.post('/upload_video', videoUpload, uploadVideo);
router.get('/profile', getUserProfile);

router.route('/:matchId').get(getMatch).patch(updateMatch).delete(deleteMatch);

export default router;
