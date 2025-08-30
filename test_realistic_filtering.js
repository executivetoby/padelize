// Proper test with realistic user structure
import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

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

console.log('🧪 Testing Free User (no subscription)...');
const freeUser = {}; // No subscription = free plan
const freeResult = filterAnalysisResultsBySubscription(
  sampleAnalysis,
  freeUser
);

console.log('Free User Results:');
console.log(
  '- Shots object keys:',
  Object.keys(freeResult.player_analytics.players[0].shots)
);
console.log(
  '- Has volley field:',
  'volley' in freeResult.player_analytics.players[0].shots
);
console.log(
  '- Has smash field:',
  'smash' in freeResult.player_analytics.players[0].shots
);
console.log(
  '- Total shots:',
  freeResult.player_analytics.players[0].shots.total_shots
);
console.log(
  '- Shot events count:',
  freeResult.player_analytics.players[0].shot_events.length
);
console.log(
  '- Has heatmap overlay:',
  !!freeResult.files.player_heatmap_overlay
);

console.log('\n🧪 Testing Pro User...');
const proUser = {
  subscription: {
    plan: 'pro_monthly',
    status: 'active',
  },
};
const proResult = filterAnalysisResultsBySubscription(sampleAnalysis, proUser);

console.log('Pro User Results:');
console.log(
  '- Shots object keys:',
  Object.keys(proResult.player_analytics.players[0].shots)
);
console.log(
  '- Has volley field:',
  'volley' in proResult.player_analytics.players[0].shots
);
console.log(
  '- Has smash field:',
  'smash' in proResult.player_analytics.players[0].shots
);
console.log(
  '- Volley count:',
  proResult.player_analytics.players[0].shots.volley
);
console.log(
  '- Smash count:',
  proResult.player_analytics.players[0].shots.smash
);
console.log(
  '- Total shots:',
  proResult.player_analytics.players[0].shots.total_shots
);
console.log(
  '- Shot events count:',
  proResult.player_analytics.players[0].shot_events.length
);
console.log('- Has heatmap overlay:', !!proResult.files.player_heatmap_overlay);

console.log('\n📊 Free User Shot Events Types:');
console.log(
  freeResult.player_analytics.players[0].shot_events.map((e) => e.type)
);

console.log('\n📊 Pro User Shot Events Types:');
console.log(
  proResult.player_analytics.players[0].shot_events.map((e) => e.type)
);
