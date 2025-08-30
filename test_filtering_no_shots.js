// Test script to verify shot filtering for users without shot classification

import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

// Mock user with no shot classification features (simulating a restricted plan)
const mockUserNoShots = {
  subscription: {
    plan: 'restricted', // This would map to a plan without basicShotClassification
    status: 'active',
  },
};

// Sample analysis document (your provided structure)
const sampleAnalysis = {
  _id: '6879fce676a670efe9334ad5',
  match_id: '687951e8ce8f71659ca7e954',
  status: 'completed',
  player_analytics: {
    metadata: {
      duration_minutes: 0.4513343151693668,
      num_players: 2,
    },
    players: [
      {
        color: [97.81106196070078, 89.12002374110808, 87.26600142980254],
        average_speed_kmh: 8.828366422118453,
        total_distance_km: 0.06631113005974312,
        average_distance_from_center_km: 0.002472007332967906,
        calories_burned: 3.7324948453608253,
        shots: {
          total_shots: 4,
          forehand: 1,
          backhand: 3,
          volley: 0,
          smash: 0,
          success: 4,
          success_rate: 100,
        },
        shot_events: [
          {
            frame: 66,
            type: 'backhand',
            success: true,
          },
        ],
        highlight_urls: ['https://example.com/highlight1.mp4'],
      },
    ],
  },
  createdAt: '2025-07-18T07:51:02.955Z',
  updatedAt: '2025-07-18T07:51:02.955Z',
};

console.log('Testing shot filtering for restricted users...');

// Mock getUserPlanFeatures to return a plan without shot classification
const originalGetUserPlanFeatures = global.getUserPlanFeatures;
global.getUserPlanFeatures = () => ({
  basicShotClassification: false, // No shot access
  distanceCovered: true,
  caloriesBurned: true,
  averageSpeed: false,
});

try {
  const filteredResult = filterAnalysisResultsBySubscription(
    sampleAnalysis,
    mockUserNoShots
  );

  console.log('✅ Filtering completed successfully');
  console.log('🔍 Shot data exclusion check:');
  console.log(
    '- Player 0 has shots (should be false):',
    !!filteredResult.player_analytics?.players[0]?.shots
  );
  console.log(
    '- Player 0 has shot_events (should be false):',
    !!filteredResult.player_analytics?.players[0]?.shot_events
  );
  console.log(
    '- Player 0 has highlight_urls (should be false):',
    !!filteredResult.player_analytics?.players[0]?.highlight_urls
  );
  console.log(
    '- Player 0 has movement data (should be true):',
    !!filteredResult.player_analytics?.players[0]?.average_speed_kmh
  );

  console.log('\n📄 Filtered player data (without shots):');
  console.log(
    JSON.stringify(filteredResult.player_analytics.players[0], null, 2)
  );
} catch (error) {
  console.error('❌ Error during filtering:', error);
} finally {
  // Restore original function
  global.getUserPlanFeatures = originalGetUserPlanFeatures;
}
