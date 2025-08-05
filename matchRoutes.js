import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  createMatch,
  deleteMatch,
  getAllMatches,
  getMatch,
  updateMatch,
  uploadVideo,
} from '../controllers/matchController.js';
import { videoUpload } from '../services/matchService.js';

const router = Router();

router.use(protect);

router.route('/').get(getAllMatches).post(createMatch);
router.post('/upload_video', videoUpload, uploadVideo);

router.route('/:matchId').get(getMatch).patch(updateMatch).delete(deleteMatch);

export default router;
