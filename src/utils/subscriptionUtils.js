import { getUserPlanFeatures } from '../middleware/subscriptionMiddleware.js';
import Analysis from '../models/Analysis.js';
import AppError from '../utils/appError.js';

/**
 * Check if user can perform a new match analysis based on their subscription
 * @param {Object} user - User object with populated subscription
 * @returns {Object} - { canAnalyze: boolean, remainingAnalyses: number, features: Object }
 */
export const checkUserAnalysisQuota = async (user) => {
  const features = getUserPlanFeatures(user);
  
  // If unlimited analyses (max plan), always allow
  if (features.matchAnalysesPerWeek === -1) {
    return {
      canAnalyze: true,
      remainingAnalyses: -1,
      features,
      priority: features.processingSpeed
    };
  }

  // Get start of current week (Monday)
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);

  // Count analyses this week
  const analysesThisWeek = await Analysis.countDocuments({
    user: user._id,
    createdAt: { $gte: startOfWeek }
  });

  const remaining = Math.max(0, features.matchAnalysesPerWeek - analysesThisWeek);

  return {
    canAnalyze: remaining > 0,
    remainingAnalyses: remaining,
    totalAllowed: features.matchAnalysesPerWeek,
    features,
    priority: features.processingSpeed
  };
};

/**
 * Filter analysis results based on subscription features
 * @param {Object} analysis - Analysis data
 * @param {Object} user - User object
 * @returns {Object} - Filtered analysis data
 */
export const filterAnalysisResultsBySubscription = (analysis, user) => {
  const features = getUserPlanFeatures(user);
  
  if (!analysis) return null;

  const result = {
    _id: analysis._id,
    match_id: analysis.match_id,
    status: analysis.status,
    created_at: analysis.created_at,
    updated_at: analysis.updated_at,
  };

  // Basic features (available to all)
  if (analysis.basic_statistics) {
    result.basic_statistics = analysis.basic_statistics;
  }

  if (analysis.player_analytics && analysis.player_analytics.players) {
    result.player_analytics = {
      players: analysis.player_analytics.players.map(player => ({
        ...player,
        // Basic shot classification only for free users
        shots: features.basicShotClassification ? player.shots : 
               (player.shots ? player.shots.filter(shot => 
                 ['forehand', 'backhand'].includes(shot.shot_type?.toLowerCase())
               ) : [])
      }))
    };

    // Add premium features based on subscription
    if (features.fullShotBreakdown && analysis.player_analytics.advanced_shots) {
      result.player_analytics.advanced_shots = analysis.player_analytics.advanced_shots;
    }

    if (features.movementHeatmaps && analysis.player_analytics.movement_heatmap) {
      result.player_analytics.movement_heatmap = analysis.player_analytics.movement_heatmap;
    }

    if (features.averageSpeed && analysis.player_analytics.speed_metrics) {
      result.player_analytics.speed_metrics = analysis.player_analytics.speed_metrics;
    }
  }

  // Add highlights if available (basic feature)
  if (analysis.highlights) {
    result.highlights = analysis.highlights;
  }

  return result;
};

/**
 * Get processing priority message for user
 * @param {string} priority - Processing priority level
 * @returns {string} - User-friendly message
 */
export const getProcessingMessage = (priority) => {
  switch (priority) {
    case 'fastest':
      return 'Your match is being processed with priority (MAX plan) - expect results in 15-30 minutes';
    case 'fast':
      return 'Your match is being processed with fast priority (PRO plan) - expect results within 1 hour';
    case 'standard':
    default:
      return 'Your match is being processed - expect results in 2-4 hours';
  }
};

/**
 * Validate if user can access specific analysis features
 * @param {Object} user - User object
 * @param {string} featureName - Feature to check
 * @returns {boolean} - Whether user has access
 */
export const hasFeatureAccess = (user, featureName) => {
  const features = getUserPlanFeatures(user);
  return features[featureName] === true;
};

export default {
  checkUserAnalysisQuota,
  filterAnalysisResultsBySubscription,
  getProcessingMessage,
  hasFeatureAccess
};
