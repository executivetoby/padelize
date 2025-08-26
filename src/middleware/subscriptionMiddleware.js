import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import Subscription from '../models/Subscription.js';
import { freePlan, proPlan } from '../models/Subscription.js';

/**
 * Get user's subscription features based on their plan
 * @param {Object} user - User object with populated subscription
 * @returns {Object} - Plan features
 */
export const getUserPlanFeatures = (user) => {
  if (!user.subscription || user.subscription.status !== 'active') {
    return freePlan;
  }

  const plan = user.subscription.plan;

  switch (true) {
    case plan === 'free':
      return freePlan;
    case plan.startsWith('pro'):
      return proPlan;
    case plan.startsWith('max'):
      return maxPlan;
    default:
      return freePlan;
  }
};

/**
 * Check if user has access to a specific feature
 * @param {string} featureName - Name of the feature to check
 * @returns {Function} - Middleware function
 */
export const requireFeature = (featureName) => {
  return catchAsync(async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(new AppError('User not authenticated', 401));
    }

    // Get user's plan features
    const features = getUserPlanFeatures(user);

    // Check if user has access to the feature
    if (!features[featureName]) {
      return next(
        new AppError(
          `This feature requires a subscription upgrade. Your current plan does not include ${featureName
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()}.`,
          403
        )
      );
    }

    // Add features to request object for use in controllers
    req.userFeatures = features;
    next();
  });
};

/**
 * Check weekly match analysis limit
 */
export const checkMatchAnalysisLimit = catchAsync(async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return next(new AppError('User not authenticated', 401));
  }

  const features = getUserPlanFeatures(user);

  // If unlimited analyses (max plan), skip check
  if (features.matchAnalysesPerWeek === -1) {
    req.userFeatures = features;
    return next();
  }

  // Get start of current week (Monday)
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);

  // Count analyses this week
  const Analysis = (await import('../models/Analysis.js')).default;
  const analysesThisWeek = await Analysis.countDocuments({
    user: user._id,
    createdAt: { $gte: startOfWeek },
  });

  if (analysesThisWeek >= features.matchAnalysesPerWeek) {
    return next(
      new AppError(
        `You have reached your weekly limit of ${features.matchAnalysesPerWeek} match analysis. Upgrade to Pro for more analyses.`,
        403
      )
    );
  }

  // Add remaining analyses to request
  req.remainingAnalyses = features.matchAnalysesPerWeek - analysesThisWeek;
  req.userFeatures = features;
  next();
});

/**
 * Check if user can access advanced shot breakdown
 */
export const requireFullShotBreakdown = requireFeature('fullShotBreakdown');

/**
 * Check if user can access movement heatmaps
 */
export const requireMovementHeatmaps = requireFeature('movementHeatmaps');

/**
 * Check if user can access average speed data
 */
export const requireAverageSpeed = requireFeature('averageSpeed');

/**
 * Check if user can access early features
 */
export const requireEarlyFeatureAccess = requireFeature('earlyFeatureAccess');

/**
 * Add subscription info to response
 */
export const addSubscriptionInfo = catchAsync(async (req, res, next) => {
  if (req.user) {
    const features = getUserPlanFeatures(req.user);
    req.userFeatures = features;

    // Add subscription info to all API responses
    const originalJson = res.json;
    res.json = function (data) {
      if (data && typeof data === 'object' && data.status === 'success') {
        data.subscription = {
          plan: req.user.subscription?.plan || 'free',
          features: features,
          status: req.user.subscription?.status || 'active',
        };
      }
      return originalJson.call(this, data);
    };
  }
  next();
});

/**
 * Premium processing middleware - determines processing priority
 */
export const setPriority = catchAsync(async (req, res, next) => {
  if (req.user) {
    const features = getUserPlanFeatures(req.user);
    req.processingPriority = features.processingSpeed;
  } else {
    req.processingPriority = 'standard';
  }
  next();
});

export default {
  requireFeature,
  checkMatchAnalysisLimit,
  requireFullShotBreakdown,
  requireMovementHeatmaps,
  requireAverageSpeed,
  requireEarlyFeatureAccess,
  addSubscriptionInfo,
  setPriority,
  getUserPlanFeatures,
};
