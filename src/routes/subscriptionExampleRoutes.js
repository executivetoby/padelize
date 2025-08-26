import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  checkMatchAnalysisLimit,
  requireFeature,
  requireFullShotBreakdown,
  requireMovementHeatmaps,
  requireAverageSpeed,
  requireEarlyFeatureAccess,
  addSubscriptionInfo,
  setPriority,
  getUserPlanFeatures
} from '../middleware/subscriptionMiddleware.js';
import catchAsync from '../utils/catchAsync.js';

const router = Router();

// Apply authentication to all routes
router.use(protect);

// Add subscription info to all responses
router.use(addSubscriptionInfo);

/**
 * Example routes showing different subscription checks
 */

// Route that checks weekly match analysis limit
router.post('/premium-analysis', 
  checkMatchAnalysisLimit,
  setPriority,
  catchAsync(async (req, res) => {
    res.json({
      status: 'success',
      message: 'Premium analysis started',
      data: {
        remainingAnalyses: req.remainingAnalyses,
        priority: req.processingPriority,
        features: req.userFeatures
      }
    });
  })
);

// Route that requires full shot breakdown (PRO+ feature)
router.get('/advanced-shots/:analysisId',
  requireFullShotBreakdown,
  catchAsync(async (req, res) => {
    // Your controller logic here
    res.json({
      status: 'success',
      message: 'Advanced shot breakdown data',
      data: {
        smashes: [],
        volleys: [],
        serves: [],
        dropshots: []
      }
    });
  })
);

// Route that requires movement heatmaps (PRO+ feature)
router.get('/heatmap/:analysisId',
  requireMovementHeatmaps,
  catchAsync(async (req, res) => {
    // Your controller logic here
    res.json({
      status: 'success',
      message: 'Movement heatmap data',
      data: {
        heatmapData: [],
        courtCoverage: 85.5
      }
    });
  })
);

// Route that requires average speed data (PRO+ feature)
router.get('/speed-metrics/:analysisId',
  requireAverageSpeed,
  catchAsync(async (req, res) => {
    // Your controller logic here
    res.json({
      status: 'success',
      message: 'Speed metrics data',
      data: {
        averageSpeed: 12.5,
        maxSpeed: 18.2,
        speedDistribution: []
      }
    });
  })
);

// Route that requires early feature access (PRO+ feature)
router.get('/beta-features',
  requireEarlyFeatureAccess,
  catchAsync(async (req, res) => {
    res.json({
      status: 'success',
      message: 'Beta features access',
      data: {
        features: ['AI Coaching Suggestions', 'Predictive Analytics']
      }
    });
  })
);

// Route with custom feature check
router.get('/custom-feature',
  requireFeature('customReports'), // MAX plan only
  catchAsync(async (req, res) => {
    res.json({
      status: 'success',
      message: 'Custom reports feature',
      data: {
        reports: []
      }
    });
  })
);

// Route that shows different data based on subscription
router.get('/dashboard',
  catchAsync(async (req, res) => {
    const features = getUserPlanFeatures(req.user);
    
    const dashboardData = {
      basicStats: {
        matchesPlayed: 25,
        winRate: 68.5
      }
    };

    // Add premium features based on subscription
    if (features.fullShotBreakdown) {
      dashboardData.advancedStats = {
        smashAccuracy: 85.2,
        volleySuccess: 72.1
      };
    }

    if (features.movementHeatmaps) {
      dashboardData.movementInsights = {
        courtCoverage: 88.5,
        dominantSide: 'forehand'
      };
    }

    if (features.averageSpeed) {
      dashboardData.speedMetrics = {
        averageSpeed: 12.8,
        improvement: '+5.2%'
      };
    }

    res.json({
      status: 'success',
      data: dashboardData
    });
  })
);

// Route to check remaining analyses for the week
router.get('/analysis-quota',
  catchAsync(async (req, res) => {
    const features = getUserPlanFeatures(req.user);
    const user = req.user;
    
    if (features.matchAnalysesPerWeek === -1) {
      return res.json({
        status: 'success',
        data: {
          unlimited: true,
          plan: user.subscription?.plan || 'free'
        }
      });
    }

    // Calculate remaining analyses this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const Analysis = (await import('../models/Analysis.js')).default;
    const analysesThisWeek = await Analysis.countDocuments({
      user: user._id,
      createdAt: { $gte: startOfWeek }
    });

    const remaining = Math.max(0, features.matchAnalysesPerWeek - analysesThisWeek);

    res.json({
      status: 'success',
      data: {
        total: features.matchAnalysesPerWeek,
        used: analysesThisWeek,
        remaining: remaining,
        weekStartsOn: startOfWeek,
        plan: user.subscription?.plan || 'free'
      }
    });
  })
);

export default router;
