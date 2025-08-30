// Debug the filtering issue
import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

// Mock getUserPlanFeatures function for testing
global.getUserPlanFeatures = (user) => {
  console.log('getUserPlanFeatures called with:', user.subscription?.plan);
  if (user.subscription?.plan === 'free') {
    return {
      basicShotClassification: true,
      fullShotBreakdown: false, // No volley/smash
      movementHeatmaps: false, // No heatmaps
      averageSpeed: false,
      distanceCovered: true,
      caloriesBurned: true,
    };
  } else if (user.subscription?.plan === 'pro') {
    return {
      basicShotClassification: true,
      fullShotBreakdown: true, // Includes volley/smash
      movementHeatmaps: true, // Includes heatmaps
      averageSpeed: true,
      distanceCovered: true,
      caloriesBurned: true,
    };
  }
};

const sampleAnalysis = {
  _id: 'test123',
  match_id: 'match123',
  status: 'completed',
  player_analytics: {
    metadata: { num_players: 2 },
    players: [
      {
        color: [100, 100, 100],
        average_speed_kmh: 8.0,
        total_distance_km: 0.5,
        average_distance_from_center_km: 0.02,
        calories_burned: 50,
        shots: {
          total_shots: 10,
          forehand: 4,
          backhand: 3,
          volley: 2,
          smash: 1,
          success: 8,
          success_rate: 80,
        },
        shot_events: [
          { type: 'forehand', success: true },
          { type: 'backhand', success: true },
          { type: 'volley', success: true },
          { type: 'smash', success: false },
        ],
      },
    ],
  },
  files: {
    player_analytics: 'https://example.com/analytics.json',
    player_heatmap_overlay: 'https://example.com/heatmap.png',
    highlights: { 0: ['https://example.com/highlight1.mp4'] },
    performance_analysis: 'https://example.com/performance.json',
    heatmap_analysis: 'https://example.com/heatmap_analysis.json',
  },
  createdAt: '2025-07-18T07:51:02.955Z',
  updatedAt: '2025-07-18T07:51:02.955Z',
};

console.log(
  'Original shots data:',
  sampleAnalysis.player_analytics.players[0].shots
);

console.log('\n🧪 Testing Pro User Filtering...');
const proUser = { subscription: { plan: 'pro' } };
const proResult = filterAnalysisResultsBySubscription(sampleAnalysis, proUser);

console.log(
  'Pro User Filtered Shots:',
  proResult.player_analytics.players[0].shots
);
console.log('Pro User Files:', Object.keys(proResult.files));
console.log('Has heatmap overlay:', !!proResult.files.player_heatmap_overlay);
