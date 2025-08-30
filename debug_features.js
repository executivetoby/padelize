// Debug the getUserPlanFeatures function
import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

// Test the actual getUserPlanFeatures function behavior
global.getUserPlanFeatures = (user) => {
  console.log(
    '🔍 getUserPlanFeatures called with user:',
    JSON.stringify(user, null, 2)
  );

  const features = {
    basicShotClassification: true,
    fullShotBreakdown: user.subscription?.plan?.startsWith('pro')
      ? true
      : false,
    movementHeatmaps: user.subscription?.plan?.startsWith('pro') ? true : false,
    averageSpeed: user.subscription?.plan?.startsWith('pro') ? true : false,
    distanceCovered: true,
    caloriesBurned: true,
  };

  console.log('🎯 Returning features:', features);
  return features;
};

const sampleAnalysis = {
  _id: 'test123',
  player_analytics: {
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
      },
    ],
  },
  files: {
    player_heatmap_overlay: 'https://example.com/heatmap.png',
    highlights: { 0: ['https://example.com/highlight1.mp4'] },
  },
  createdAt: '2025-07-18T07:51:02.955Z',
};

console.log('\n🧪 Testing with pro_monthly user...');
const proUser = { subscription: { plan: 'pro_monthly' } };
const result = filterAnalysisResultsBySubscription(sampleAnalysis, proUser);

console.log('\n📊 Result for pro user:');
console.log('Shots object:', result.player_analytics.players[0].shots);
console.log('Files object keys:', Object.keys(result.files || {}));
console.log('Has heatmap file:', !!result.files?.player_heatmap_overlay);
