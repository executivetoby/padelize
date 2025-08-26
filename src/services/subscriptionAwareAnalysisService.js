import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import { getUserPlanFeatures } from '../middleware/subscriptionMiddleware.js';

/**
 * Example controller showing how to handle subscription-based features
 */
export const getAnalysisWithSubscriptionFeatures = catchAsync(
  async (req, res, next) => {
    const { analysisId } = req.params;
    const user = req.user;
    const userFeatures = req.userFeatures || getUserPlanFeatures(user);

    // Get basic analysis data (available to all users)
    const analysis = await Analysis.findById(analysisId).populate('user');

    if (!analysis) {
      return next(new AppError('Analysis not found', 404));
    }

    if (analysis.user._id.toString() !== user._id.toString()) {
      return next(new AppError('Not authorized to view this analysis', 403));
    }

    // Build response based on subscription features
    const response = {
      id: analysis._id,
      status: analysis.status,
      createdAt: analysis.createdAt,

      // Basic features (available to all)
      basicStats: {
        shotSuccessPercentage: analysis.shotSuccessPercentage,
        distanceCovered: analysis.distanceCovered,
        caloriesBurned: analysis.caloriesBurned,
      },

      // Basic shot classification (forehand/backhand only for free users)
      shots: userFeatures.basicShotClassification ? analysis.basicShots : null,
    };

    // Add premium features based on subscription
    if (userFeatures.fullShotBreakdown) {
      response.advancedShots = {
        smashes: analysis.smashes,
        volleys: analysis.volleys,
        serves: analysis.serves,
        dropshots: analysis.dropshots,
      };
    }

    if (userFeatures.movementHeatmaps) {
      response.movementHeatmap = analysis.movementHeatmap;
    }

    if (userFeatures.averageSpeed) {
      response.speedMetrics = {
        averageSpeed: analysis.averageSpeed,
        maxSpeed: analysis.maxSpeed,
        speedDistribution: analysis.speedDistribution,
      };
    }

    // Add processing priority info
    response.processingInfo = {
      priority: req.processingPriority || 'standard',
      estimatedTime: getEstimatedProcessingTime(req.processingPriority),
    };

    res.status(200).json({
      status: 'success',
      data: {
        analysis: response,
      },
    });
  }
);

/**
 * Helper function to get estimated processing time based on priority
 */
const getEstimatedProcessingTime = (priority) => {
  switch (priority) {
    case 'fastest':
      return '15-30 minutes';
    case 'fast':
      return '30-60 minutes';
    case 'standard':
    default:
      return '2-4 hours';
  }
};

/**
 * Example: Process analysis with different priorities based on subscription
 */
export const processAnalysisWithPriority = catchAsync(
  async (req, res, next) => {
    const user = req.user;
    const userFeatures = req.userFeatures;
    const priority = req.processingPriority || 'standard';

    // Create analysis record
    const analysis = await Analysis.create({
      user: user._id,
      status: 'processing',
      priority: priority,
      requestedFeatures: {
        fullShotBreakdown: userFeatures.fullShotBreakdown,
        movementHeatmaps: userFeatures.movementHeatmaps,
        averageSpeed: userFeatures.averageSpeed,
      },
    });

    // Add to processing queue based on priority
    await addToProcessingQueue(analysis, priority);

    res.status(202).json({
      status: 'success',
      message: `Analysis started with ${priority} priority`,
      data: {
        analysisId: analysis._id,
        estimatedTime: getEstimatedProcessingTime(priority),
        remainingAnalyses: req.remainingAnalyses || null,
      },
    });
  }
);

/**
 * Helper function to add analysis to appropriate queue
 */
const addToProcessingQueue = async (analysis, priority) => {
  // Implementation depends on your queue system (Redis, Bull, etc.)
  console.log(`Adding analysis ${analysis._id} to ${priority} priority queue`);

  // Example: Different queue names based on priority
  const queueName =
    priority === 'fastest'
      ? 'analysis-priority'
      : priority === 'fast'
      ? 'analysis-fast'
      : 'analysis-standard';

  // Add to your queue system here
  // await queue.add(queueName, { analysisId: analysis._id });
};

export default {
  getAnalysisWithSubscriptionFeatures,
  processAnalysisWithPriority,
};
