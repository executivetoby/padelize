import mongoose from 'mongoose';
import Follow from './Follow.js'; // Your Follow model
import { Analysis } from './Analysis.js'; // Your Analysis model
import { PlayerAnalyticsAggregator } from './analysisService.js';

class TennisLeaderboard extends PlayerAnalyticsAggregator {
  /**
   * Get platform-wide leaderboard for all users
   * @param {Object} options - Query options
   * @param {String} options.metric - Metric to rank by ('distance', 'speed', 'success_rate', 'calories')
   * @param {Number} options.limit - Number of top users to return (default: 50)
   * @param {Date} options.startDate - Start date for the period
   * @param {Date} options.endDate - End date for the period
   * @param {Number} options.minMatches - Minimum matches played to qualify (default: 1)
   */
  static async getPlatformLeaderboard(options = {}) {
    const {
      metric = 'distance',
      limit = 50,
      startDate,
      endDate,
      minMatches = 1,
    } = options;

    // Build match criteria
    const matchCriteria = { status: 'completed' };

    if (startDate || endDate) {
      matchCriteria.createdAt = {};
      if (startDate) matchCriteria.createdAt.$gte = new Date(startDate);
      if (endDate) matchCriteria.createdAt.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchCriteria },

      // Get first player from each analysis
      {
        $addFields: {
          first_player: { $arrayElemAt: ['$player_analytics.players', 0] },
        },
      },

      // Group by user (created_by)
      {
        $group: {
          _id: '$created_by',
          total_matches: { $sum: 1 },

          // Distance metrics
          total_distance_km: { $sum: '$first_player.total_distance_km' },
          avg_distance_per_match: { $avg: '$first_player.total_distance_km' },

          // Speed metrics
          avg_speed_kmh: { $avg: '$first_player.average_speed_kmh' },
          max_speed_kmh: { $max: '$first_player.average_speed_kmh' },

          // Shot success metrics
          total_shots: { $sum: '$first_player.shots.total_shots' },
          total_successful_shots: { $sum: '$first_player.shots.success' },
          avg_success_rate: { $avg: '$first_player.shots.success_rate' },

          // Calories metrics
          total_calories: { $sum: '$first_player.calories_burned' },
          avg_calories_per_match: { $avg: '$first_player.calories_burned' },

          // Additional stats
          total_forehand: { $sum: '$first_player.shots.forehand' },
          total_backhand: { $sum: '$first_player.shots.backhand' },
          total_volleys: { $sum: '$first_player.shots.volley' },
          total_smashes: { $sum: '$first_player.shots.smash' },

          // Time range
          first_match: { $min: '$createdAt' },
          last_match: { $max: '$createdAt' },
        },
      },

      // Filter by minimum matches
      { $match: { total_matches: { $gte: minMatches } } },

      // Calculate overall success rate
      {
        $addFields: {
          overall_success_rate: {
            $cond: {
              if: { $gt: ['$total_shots', 0] },
              then: {
                $multiply: [
                  { $divide: ['$total_successful_shots', '$total_shots'] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },

      // Populate user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },

      { $unwind: '$user' },

      // Project final structure
      {
        $project: {
          user_id: '$_id',
          username: '$user.username',
          email: '$user.email',
          profile_image: '$user.profile_image',
          total_matches: 1,

          // Main metrics for ranking
          total_distance_km: { $round: ['$total_distance_km', 4] },
          avg_distance_per_match: { $round: ['$avg_distance_per_match', 4] },
          avg_speed_kmh: { $round: ['$avg_speed_kmh', 2] },
          max_speed_kmh: { $round: ['$max_speed_kmh', 2] },
          overall_success_rate: { $round: ['$overall_success_rate', 2] },
          avg_success_rate: { $round: ['$avg_success_rate', 2] },
          total_calories: { $round: ['$total_calories', 2] },
          avg_calories_per_match: { $round: ['$avg_calories_per_match', 2] },

          // Additional stats
          total_shots: 1,
          total_successful_shots: 1,
          shot_breakdown: {
            forehand: '$total_forehand',
            backhand: '$total_backhand',
            volley: '$total_volleys',
            smash: '$total_smashes',
          },

          period: {
            from: '$first_match',
            to: '$last_match',
          },
        },
      },
    ];

    // Add sorting based on metric
    const sortField = this.getSortField(metric);
    pipeline.push({ $sort: { [sortField]: -1 } });
    pipeline.push({ $limit: limit });

    // Add ranking
    pipeline.push({
      $group: {
        _id: null,
        leaderboard: { $push: '$$ROOT' },
      },
    });

    pipeline.push({
      $unwind: { path: '$leaderboard', includeArrayIndex: 'rank' },
    });

    pipeline.push({
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ['$leaderboard', { rank: { $add: ['$rank', 1] } }],
        },
      },
    });

    const results = await Analysis.aggregate(pipeline);

    return {
      metric,
      period: { startDate, endDate },
      total_users: results.length,
      leaderboard: results,
    };
  }

  /**
   * Get leaderboard for followers/following network
   * @param {String} userId - User ID to get network leaderboard for
   * @param {Object} options - Same options as platform leaderboard
   */
  static async getNetworkLeaderboard(userId, options = {}) {
    // Get user's network (followers + following + self)
    const network = await this.getUserNetwork(userId);

    if (network.length === 0) {
      return {
        metric: options.metric || 'distance',
        network_size: 0,
        leaderboard: [],
      };
    }

    // Add network filter to match criteria
    const networkOptions = {
      ...options,
      userIds: network,
    };

    return await this.getLeaderboardForUsers(networkOptions);
  }

  /**
   * Get leaderboard for specific set of users
   */
  static async getLeaderboardForUsers(options = {}) {
    const { userIds, ...baseOptions } = options;

    if (!userIds || userIds.length === 0) {
      return { leaderboard: [] };
    }

    // Use the same pipeline as platform leaderboard but filter by userIds
    const matchCriteria = {
      status: 'completed',
      created_by: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
    };

    if (baseOptions.startDate || baseOptions.endDate) {
      matchCriteria.createdAt = {};
      if (baseOptions.startDate)
        matchCriteria.createdAt.$gte = new Date(baseOptions.startDate);
      if (baseOptions.endDate)
        matchCriteria.createdAt.$lte = new Date(baseOptions.endDate);
    }

    // Use similar pipeline as getPlatformLeaderboard but with user filter
    const pipeline = [
      { $match: matchCriteria },
      // ... rest of the pipeline from getPlatformLeaderboard
    ];

    // Reuse the platform leaderboard logic
    const platformOptions = { ...baseOptions, matchCriteria };
    return await this.executeLeaderboardPipeline(platformOptions);
  }

  /**
   * Get user's network (followers + following + self)
   */
  static async getUserNetwork(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [followers, following] = await Promise.all([
      Follow.find({ following: userObjectId }).select('follower'),
      Follow.find({ follower: userObjectId }).select('following'),
    ]);

    const network = new Set([userId]); // Include self

    followers.forEach((f) => network.add(f.follower.toString()));
    following.forEach((f) => network.add(f.following.toString()));

    return Array.from(network);
  }

  /**
   * Get user's position in various leaderboards
   */
  static async getUserLeaderboardPosition(userId, options = {}) {
    const metrics = [
      'total_distance_km',
      'avg_speed_kmh',
      'overall_success_rate',
      'total_calories',
    ];
    const positions = {};

    for (const metric of metrics) {
      const leaderboard = await this.getPlatformLeaderboard({
        ...options,
        metric: metric
          .replace('total_', '')
          .replace('overall_', '')
          .replace('avg_', ''),
        limit: 1000, // Get enough to find user position
      });

      const userPosition = leaderboard.leaderboard.findIndex(
        (entry) => entry.user_id.toString() === userId
      );

      positions[metric] = {
        rank: userPosition >= 0 ? userPosition + 1 : null,
        total_users: leaderboard.total_users,
        percentile:
          userPosition >= 0
            ? Math.round(
                ((leaderboard.total_users - userPosition) /
                  leaderboard.total_users) *
                  100
              )
            : null,
      };
    }

    return positions;
  }

  /**
   * Get multiple leaderboard types at once
   */
  static async getMultipleLeaderboards(userId, options = {}) {
    const [platform, network, userPositions] = await Promise.all([
      this.getPlatformLeaderboard(options),
      userId ? this.getNetworkLeaderboard(userId, options) : null,
      userId ? this.getUserLeaderboardPosition(userId, options) : null,
    ]);

    return {
      platform_leaderboard: platform,
      network_leaderboard: network,
      user_positions: userPositions,
      generated_at: new Date(),
    };
  }

  /**
   * Get leaderboard for specific time periods (weekly, monthly, all-time)
   */
  static async getPeriodicLeaderboards(userId, metric = 'distance') {
    const now = new Date();

    // Define periods
    const periods = {
      weekly: {
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: now,
      },
      monthly: {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: now,
      },
      all_time: {},
    };

    const results = {};

    for (const [period, dates] of Object.entries(periods)) {
      results[period] = await this.getMultipleLeaderboards(userId, {
        metric,
        ...dates,
        limit: 10,
      });
    }

    return results;
  }

  /**
   * Helper method to get sort field based on metric
   */
  static getSortField(metric) {
    const sortFields = {
      distance: 'total_distance_km',
      speed: 'avg_speed_kmh',
      success_rate: 'overall_success_rate',
      calories: 'total_calories',
    };

    return sortFields[metric] || 'total_distance_km';
  }

  /**
   * Get trending players (most improved over period)
   */
  static async getTrendingPlayers(options = {}) {
    const { metric = 'distance', days = 30, limit = 20 } = options;

    const endDate = new Date();
    const midDate = new Date(
      endDate.getTime() - (days / 2) * 24 * 60 * 60 * 1000
    );
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Get performance for first half and second half of period
    const [firstHalf, secondHalf] = await Promise.all([
      this.getPlatformLeaderboard({
        metric,
        startDate,
        endDate: midDate,
        limit: 1000,
      }),
      this.getPlatformLeaderboard({
        metric,
        startDate: midDate,
        endDate,
        limit: 1000,
      }),
    ]);

    // Calculate improvements
    const improvements = [];
    const sortField = this.getSortField(metric);

    secondHalf.leaderboard.forEach((current) => {
      const previous = firstHalf.leaderboard.find(
        (p) => p.user_id.toString() === current.user_id.toString()
      );

      if (previous && previous[sortField] > 0) {
        const improvement =
          ((current[sortField] - previous[sortField]) / previous[sortField]) *
          100;

        improvements.push({
          ...current,
          previous_value: previous[sortField],
          current_value: current[sortField],
          improvement_percent: Math.round(improvement * 100) / 100,
          matches_played: current.total_matches,
        });
      }
    });

    // Sort by improvement and return top performers
    improvements.sort((a, b) => b.improvement_percent - a.improvement_percent);

    return {
      metric,
      period_days: days,
      trending_players: improvements.slice(0, limit),
    };
  }
}


export const platformDistanceLeaderboardService = catchAsync(
  async (req, res, next) => {
    const { limit, startDate, endDate, minMatches, metric } = req.query;

    const leaderboard = await TennisLeaderboard.getPlatformLeaderboard({
      metric: metric || 'distance',
      limit: parseInt(limit) || 50,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      minMatches: parseInt(minMatches) || 1,
    });

    res.status(200).json({
      status: 'success',
      data: {
        leaderboard,
      },
    });
  }
);

export const networkLeaderboardService = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { limit, startDate, endDate, minMatches, metric } = req.query;

  const leaderboard = await TennisLeaderboard.getNetworkLeaderboard(userId, {
    metric: metric || 'distance',
    limit: parseInt(limit) || 50,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    minMatches: parseInt(minMatches) || 1,
  });

  res.status(200).json({
    status: 'success',
    data: {
      leaderboard,
    },
  });
});

export const multipleLeaderboardsService = catchAsync(
  async (req, res, next) => {
    const { userId } = req.params;
    const { startDate, endDate, minMatches, metric } = req.query;

    const leaderboards = await TennisLeaderboard.getMultipleLeaderboards(
      userId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        minMatches: parseInt(minMatches) || 1,
        metric: metric || 'distance',
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        leaderboards,
      },
    });
  }
);

export const userLeaderboardPositionService = catchAsync(
  async (req, res, next) => {
    const { userId } = req.params;
    const { startDate, endDate, minMatches } = req.query;

    const position = await TennisLeaderboard.getUserLeaderboardPosition(
      userId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        minMatches: parseInt(minMatches) || 1,
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        position,
      },
    });
  }
);

export const periodicLeaderboardsService = catchAsync(
  async (req, res, next) => {
    const { userId } = req.params;
    const { startDate, endDate, minMatches, metric } = req.query;

    const leaderboards = await TennisLeaderboard.getPeriodicLeaderboards(
      userId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        minMatches: parseInt(minMatches) || 1,
        metric: metric || 'distance',
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        leaderboards,
      },
    });
  }
);

export const trendingPlayersService = catchAsync(async (req, res, next) => {
  const { limit, startDate, endDate, minMatches, metric } = req.query;

  const players = await TennisLeaderboard.getTrendingPlayers({
    metric: metric || 'success_rate',
    days: 30,
    limit: parseInt(limit) || 15,
  });

  res.status(200).json({
    status: 'success',
    data: {
      players,
    },
  });
});

  export default TennisLeaderboard;