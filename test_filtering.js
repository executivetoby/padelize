// Test script to verify filterAnalysisResultsBySubscription works with real data

import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

// Mock user with free plan features
const mockUser = {
  subscription: {
    plan: 'free',
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
      date_analysed: '2025-07-17T08:10:41.206Z',
      frame_shape: [678, 1136],
      fps: 25.036873156342182,
      num_players: 4,
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
            start_frame: 16,
            end_frame: 166,
            ball_pos: [732, 227.5],
            player_pos: [759.5, 199],
            velocity: 125.46413830254444,
            type: 'backhand',
            success: true,
          },
        ],
        highlight_urls: [
          'https://padelizeresources.s3.ap-southeast-2.amazonaws.com/analysis_results/unique-foldername-d29c70a762d5fg123456/highlights/player_0/highlight_1.mp4',
        ],
      },
      {
        color: [93.89442496163666, 85.00534160841222, 82.22534181105986],
        average_speed_kmh: 4.0283657769215875,
        total_distance_km: 0.030257634786477996,
        average_distance_from_center_km: 0.0018613792681109556,
        calories_burned: 4.476896907216495,
        shots: {
          total_shots: 3,
          forehand: 0,
          backhand: 1,
          volley: 2,
          smash: 0,
          success: 3,
          success_rate: 100,
        },
      },
    ],
  },
  files: {
    player_analytics:
      'https://padelizeresources.s3.ap-southeast-2.amazonaws.com/analysis_results/unique-foldername-d29c70a762d5fg123456/player_analytics.json',
    player_heatmap_overlay:
      'https://padelizeresources.s3.ap-southeast-2.amazonaws.com/analysis_results/unique-foldername-d29c70a762d5fg123456/player_heatmap_overlay.png',
    highlights: {
      0: [
        'https://padelizeresources.s3.ap-southeast-2.amazonaws.com/analysis_results/unique-foldername-d29c70a762d5fg123456/highlights/player_0/highlight_1.mp4',
      ],
      1: [
        'https://padelizeresources.s3.ap-southeast-2.amazonaws.com/analysis_results/unique-foldername-d29c70a762d5fg123456/highlights/player_1/highlight_1.mp4',
      ],
    },
  },
  metadata: {
    created_at: '2025-07-17T08:04:37.000Z',
    completed_at: '2025-07-17T08:11:03.070Z',
    storage: 's3',
  },
  created_by: '681864e5096bf03df20e07d5',
  createdAt: '2025-07-18T07:51:02.955Z',
  updatedAt: '2025-07-18T07:51:02.955Z',
  __v: 0,
};

console.log('Testing filterAnalysisResultsBySubscription...');

try {
  const filteredResult = filterAnalysisResultsBySubscription(
    sampleAnalysis,
    mockUser
  );

  console.log('✅ Filtering completed successfully');
  console.log('🔍 Structure check:');
  console.log('- Has _id:', !!filteredResult._id);
  console.log('- Has match_id:', !!filteredResult.match_id);
  console.log('- Has status:', !!filteredResult.status);
  console.log('- Has player_analytics:', !!filteredResult.player_analytics);
  console.log('- Has files:', !!filteredResult.files);
  console.log('- Has metadata:', !!filteredResult.metadata);
  console.log('- Has created_by:', !!filteredResult.created_by);
  console.log('- Missing __v (good):', !filteredResult.__v);

  if (filteredResult.player_analytics?.players) {
    console.log(
      '- Number of players:',
      filteredResult.player_analytics.players.length
    );
    console.log(
      '- Player 0 has shots:',
      !!filteredResult.player_analytics.players[0]?.shots
    );
    console.log(
      '- Player 0 has shot_events:',
      !!filteredResult.player_analytics.players[0]?.shot_events
    );
    console.log(
      '- Player 0 has highlight_urls:',
      !!filteredResult.player_analytics.players[0]?.highlight_urls
    );
  }

  console.log('\n📄 Sample filtered result:');
  console.log(JSON.stringify(filteredResult, null, 2));
} catch (error) {
  console.error('❌ Error during filtering:', error);
}
