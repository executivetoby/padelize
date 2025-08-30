// Test updated filtering for free vs pro users
import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

// Mock getUserPlanFeatures function for testing
global.getUserPlanFeatures = (user) => {
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

// Sample analysis with volley/smash data and heatmap files
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
          volley: 2, // Should be filtered out for free users
          smash: 1, // Should be filtered out for free users
          success: 8,
          success_rate: 80,
        },
        shot_events: [
          { type: 'forehand', success: true },
          { type: 'backhand', success: true },
          { type: 'volley', success: true }, // Should be filtered out for free users
          { type: 'smash', success: false }, // Should be filtered out for free users
        ],
      },
    ],
  },
  files: {
    player_analytics: 'https://example.com/analytics.json',
    player_heatmap_overlay: 'https://example.com/heatmap.png', // Should be excluded for free users
    highlights: { 0: ['https://example.com/highlight1.mp4'] },
    performance_analysis: 'https://example.com/performance.json', // Should be excluded for free users
    heatmap_analysis: 'https://example.com/heatmap_analysis.json', // Should be excluded for free users
  },
  createdAt: '2025-07-18T07:51:02.955Z',
  updatedAt: '2025-07-18T07:51:02.955Z',
};

console.log('🧪 Testing Free User Filtering...');
const freeUser = { subscription: { plan: 'free' } };
const freeResult = filterAnalysisResultsBySubscription(
  sampleAnalysis,
  freeUser
);

console.log('Free User Results:');
console.log(
  '- Volley count:',
  freeResult.player_analytics.players[0].shots.volley
);
console.log(
  '- Smash count:',
  freeResult.player_analytics.players[0].shots.smash
);
console.log(
  '- Total shots (should be forehand + backhand only):',
  freeResult.player_analytics.players[0].shots.total_shots
);
console.log(
  '- Shot events count:',
  freeResult.player_analytics.players[0].shot_events.length
);
console.log(
  '- Has heatmap overlay (should be false):',
  !!freeResult.files.player_heatmap_overlay
);
console.log(
  '- Has performance analysis (should be false):',
  !!freeResult.files.performance_analysis
);
console.log(
  '- Has highlights (should be true):',
  !!freeResult.files.highlights
);

console.log('\n🧪 Testing Pro User Filtering...');
const proUser = { subscription: { plan: 'pro' } };
const proResult = filterAnalysisResultsBySubscription(sampleAnalysis, proUser);

console.log('Pro User Results:');
console.log(
  '- Volley count:',
  proResult.player_analytics.players[0].shots.volley
);
console.log(
  '- Smash count:',
  proResult.player_analytics.players[0].shots.smash
);
console.log(
  '- Total shots (should include all):',
  proResult.player_analytics.players[0].shots.total_shots
);
console.log(
  '- Shot events count:',
  proResult.player_analytics.players[0].shot_events.length
);
console.log(
  '- Has heatmap overlay (should be true):',
  !!proResult.files.player_heatmap_overlay
);
console.log(
  '- Has performance analysis (should be true):',
  !!proResult.files.performance_analysis
);
console.log('- Has highlights (should be true):', !!proResult.files.highlights);

console.log('\n📊 Free User Shot Events (should only have forehand/backhand):');
console.log(
  freeResult.player_analytics.players[0].shot_events.map((e) => e.type)
);

console.log('\n📊 Pro User Shot Events (should have all types):');
console.log(
  proResult.player_analytics.players[0].shot_events.map((e) => e.type)
);
