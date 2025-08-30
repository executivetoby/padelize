import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  createMatch,
  deleteMatch,
  getAllMatches,
  getMatch,
  getUserMatches,
  getUserProfile,
  updateMatch,
  uploadVideo,
  checkAnalysisQuota,
} from '../controllers/matchController.js';
import { videoUpload } from '../services/s3UploadService.js';
import {
  addSubscriptionInfo,
  setPriority,
} from '../middleware/subscriptionMiddleware.js';
import { checkAnalysisQuotaService } from '../services/matchService.js';

const router = Router();

router.use(protect);
router.use(addSubscriptionInfo); // Add subscription info to all responses

router.route('/').get(getAllMatches).post(createMatch);
router.get('/user-matches', getUserMatches);

// Check analysis quota
router.get('/analysis-quota', checkAnalysisQuota);

// Video upload with subscription priority
router.post('/upload_video', setPriority, videoUpload, uploadVideo);

router.get('/testing', checkAnalysisQuotaService);

router.get('/profile', getUserProfile);

router.route('/:matchId').get(getMatch).patch(updateMatch).delete(deleteMatch);

export default router;
