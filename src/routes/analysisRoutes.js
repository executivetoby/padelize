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
  restartAnalysisService,
  testAnalysisSave,
} from '../services/analysisService.js';

const router = Router();

router.get('/health', checkPythonApiHealthService);
router.get('/health/full', fullHealthCheckService);

router.use(protect);

router.post('/analyze-video', videoUpload, analyzeVideoService);
router.post(
  '/analyze-video-complete',
  videoUpload,
  analyzeVideoCompleteService
);
router.get('/:analysisId/status', getAnalysisStatusService);
router.get('/:analysisId', getAnalysisResultsService);
router.post('/test', testAnalysisSave);
router.post('/restart/:matchId', restartAnalysisService);

export default router;
