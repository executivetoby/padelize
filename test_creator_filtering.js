// Test creator-based filtering
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
      },
    ],
  },
  files: {
    player_analytics: 'https://example.com/analytics.json',
    player_heatmap_overlay: 'https://example.com/heatmap.png',
    highlights: { 0: ['https://example.com/highlight1.mp4'] },
  },
  createdAt: '2025-07-18T07:51:02.955Z',
};

console.log('🧪 Testing Creator-Based Filtering Logic...');

console.log('\n📝 Scenario 1: Free creator, Pro viewer');
console.log('   - Creator: Free plan (created the match)');
console.log('   - Viewer: Pro plan (viewing the match)');
console.log('   - Expected: Limited features (based on creator)');

const freeCreator = { subscription: { plan: 'free', status: 'active' } };
const result1 = filterAnalysisResultsBySubscription(
  sampleAnalysis,
  freeCreator
);

console.log(
  '   - Has volley field:',
  'volley' in result1.player_analytics.players[0].shots
);
console.log(
  '   - Has smash field:',
  'smash' in result1.player_analytics.players[0].shots
);
console.log(
  '   - Has heatmap overlay:',
  !!result1.files.player_heatmap_overlay
);
console.log(
  '   - Total shots (free):',
  result1.player_analytics.players[0].shots.total_shots
);

console.log('\n📝 Scenario 2: Pro creator, Free viewer');
console.log('   - Creator: Pro plan (created the match)');
console.log('   - Viewer: Free plan (viewing the match)');
console.log('   - Expected: Full features (based on creator)');

const proCreator = { subscription: { plan: 'pro_monthly', status: 'active' } };
const result2 = filterAnalysisResultsBySubscription(sampleAnalysis, proCreator);

console.log(
  '   - Has volley field:',
  'volley' in result2.player_analytics.players[0].shots
);
console.log(
  '   - Has smash field:',
  'smash' in result2.player_analytics.players[0].shots
);
console.log(
  '   - Volley count:',
  result2.player_analytics.players[0].shots.volley
);
console.log(
  '   - Smash count:',
  result2.player_analytics.players[0].shots.smash
);
console.log(
  '   - Has heatmap overlay:',
  !!result2.files.player_heatmap_overlay
);
console.log(
  '   - Total shots (pro):',
  result2.player_analytics.players[0].shots.total_shots
);

console.log('\n✅ Key Insight:');
console.log(
  '   The filtering is now based on who CREATED the match (and paid for the analysis),'
);
console.log(
  '   not who is VIEWING the match. This ensures fair access to paid features.'
);

console.log('\n💡 Business Logic:');
console.log(
  '   - If you (free user) create a match → Limited features for everyone'
);
console.log('   - If pro user creates a match → Full features for everyone');
console.log('   - Viewers subscription level does not matter');
