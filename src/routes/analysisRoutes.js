import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import { videoUpload } from '../services/s3UploadService.js';
import {
  analyzeVideoCompleteService,
  analyzeVideoService,
  checkPythonApiHealthService,
  fullHealthCheckService,
  getAnalysisResultsService,
  getAnalysisStatusService,
} from '../services/analysisService1.js';
import {
  lastTwoMatchesComparisonService,
  playerAverageService,
  restartAnalysisService,
  testAnalysisSave,
} from '../services/analysisService.js';
import {
  checkMatchAnalysisLimit,
  requireFullShotBreakdown,
  requireMovementHeatmaps,
  requireAverageSpeed,
  addSubscriptionInfo,
  setPriority,
} from '../middleware/subscriptionMiddleware.js';

const router = Router();

router.get('/health', checkPythonApiHealthService);
router.get('/health/full', fullHealthCheckService);

router.use(protect);
router.use(addSubscriptionInfo); // Add subscription info to all responses

// Match analysis with weekly limit check
router.post(
  '/analyze-video',
  checkMatchAnalysisLimit,
  setPriority,
  videoUpload,
  analyzeVideoService
);

router.post(
  '/analyze-video-complete',
  checkMatchAnalysisLimit,
  setPriority,
  videoUpload,
  analyzeVideoCompleteService
);

// Basic features available to all users
router.get('/average', playerAverageService);
router.get('/percentage_change', lastTwoMatchesComparisonService);
router.get('/:analysisId/status', getAnalysisStatusService);

// Premium features requiring full shot breakdown
router.get(
  '/:analysisId/advanced',
  requireFullShotBreakdown,
  getAnalysisResultsService
);

// Basic analysis results (available to all)
router.get('/:analysisId', getAnalysisResultsService);

router.post('/test', testAnalysisSave);
router.post('/restart/:matchId', restartAnalysisService);

export default router;
