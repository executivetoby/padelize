import { Router } from 'express';
import {
  multipleLeaderboardsService,
  networkLeaderboardService,
  platformLeaderboardService,
  trendingPlayersService,
  userLeaderboardPositionService,
} from '../services/leaderboardService.js';
import { protect } from '../controllers/authController.js';

const router = Router();

router.use(protect);

router.get('/', platformLeaderboardService);
router.get('/follow/:userId', networkLeaderboardService);
router.get('/multiple/:userId', multipleLeaderboardsService);
router.get('/position/:userId', userLeaderboardPositionService);
router.get('/trending', trendingPlayersService);

export default router;
