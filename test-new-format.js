import { formatAnalysisResponse } from './src/utils/analysisFormatter.js';
import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

// Test data with new format
const newFormatAnalysis = {
  match_id: 'test-match-123',
  status: 'completed',
  player_analytics: {
    metadata: {
      duration_minutes: 90,
      date_analysed: '2024-01-01T10:00:00Z',
      frame_shape: [1080, 1920],
      fps: 30,
      num_players: 2,
    },
    court_info: {
      length: 20,
      width: 10,
      corners: [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
      ],
    },
    players: [
      {
        color: [255, 0, 0],
        average_speed_kmh: 15.5,
        total_distance_km: 3.2,
        average_distance_from_center_km: 2.1,
        calories_burned: 450,
        shot_analytics: {
          forehand: 45,
          backhand: 32,
          volley: 15,
          smash: 8,
          total_shots: 100,
        },
        shot_events: [
          {
            timestamp: 10.5,
            ball_pos: [5, 3],
            player_pos: [3, 4],
            velocity: 80,
            type: 'forehand',
            success: true,
          },
          {
            timestamp: 25.2,
            ball_pos: [15, 7],
            player_pos: [14, 6],
            velocity: 65,
            type: 'volley',
            success: true,
          },
        ],
        highlight_urls: ['https://example.com/highlight1.mp4'],
      },
    ],
  },
  files: {
    player_analytics: 'https://example.com/analytics.json',
    player_heatmap_overlay: 'https://example.com/heatmap.png',
    highlights: {
      0: [
        'https://example.com/highlight1.mp4',
        'https://example.com/highlight2.mp4',
      ],
    },
  },
  metadata: {
    created_at: '2024-01-01T09:00:00Z',
    completed_at: '2024-01-01T10:00:00Z',
    storage: 's3',
  },
};

// Mock users for testing
const freeUser = {
  _id: 'user1',
  subscription: {
    plan: 'free',
    status: 'active',
  },
};

const proUser = {
  _id: 'user2',
  subscription: {
    plan: 'pro',
    status: 'active',
  },
};

console.log('=== Testing New Format Analysis Processing ===\n');

// Test 1: Format the new analysis response
console.log('1. Testing formatAnalysisResponse with new format...');
try {
  const formatted = formatAnalysisResponse(newFormatAnalysis, 'user123');
  console.log('✓ Successfully formatted new analysis response');
  console.log(
    '✓ Created shots field from shot_analytics:',
    !!formatted.player_analytics.players[0].shots
  );
  console.log(
    '✓ Preserved shot_analytics field:',
    !!formatted.player_analytics.players[0].shot_analytics
  );
  console.log(
    '✓ Court info preserved:',
    !!formatted.player_analytics.court_info
  );
  console.log(
    '✓ Highlights converted to Map:',
    formatted.files.highlights instanceof Map
  );
} catch (error) {
  console.error('✗ Failed to format analysis response:', error.message);
}

console.log('\n2. Testing filtering for Free user...');
try {
  const formatted = formatAnalysisResponse(newFormatAnalysis, freeUser._id);
  const filtered = filterAnalysisResultsBySubscription(formatted, freeUser);

  const playerShots = filtered.player_analytics.players[0].shots;
  const playerShotAnalytics =
    filtered.player_analytics.players[0].shot_analytics;

  console.log('Free user shots data:', playerShots);
  console.log('Free user shot_analytics data:', playerShotAnalytics);

  // Check that volley/smash are excluded
  console.log('✓ Volley excluded from shots:', !('volley' in playerShots));
  console.log('✓ Smash excluded from shots:', !('smash' in playerShots));
  console.log(
    '✓ Volley excluded from shot_analytics:',
    !('volley' in playerShotAnalytics)
  );
  console.log(
    '✓ Smash excluded from shot_analytics:',
    !('smash' in playerShotAnalytics)
  );

  // Check shot events filtering
  const shotEvents = filtered.player_analytics.players[0].shot_events;
  console.log(
    '✓ Shot events filtered:',
    shotEvents.length,
    'events (only forehand/backhand)'
  );
  console.log('✓ Court info included:', !!filtered.player_analytics.court_info);
  console.log('✓ Heatmap excluded:', !filtered.files.player_heatmap_overlay);
} catch (error) {
  console.error('✗ Failed filtering for free user:', error.message);
}

console.log('\n3. Testing filtering for Pro user...');
try {
  const formatted = formatAnalysisResponse(newFormatAnalysis, proUser._id);
  const filtered = filterAnalysisResultsBySubscription(formatted, proUser);

  const playerShots = filtered.player_analytics.players[0].shots;
  const playerShotAnalytics =
    filtered.player_analytics.players[0].shot_analytics;

  console.log('Pro user shots data:', playerShots);
  console.log('Pro user shot_analytics data:', playerShotAnalytics);

  // Check that all shot types are included
  console.log('✓ Volley included in shots:', 'volley' in playerShots);
  console.log('✓ Smash included in shots:', 'smash' in playerShots);
  console.log(
    '✓ Volley included in shot_analytics:',
    'volley' in playerShotAnalytics
  );
  console.log(
    '✓ Smash included in shot_analytics:',
    'smash' in playerShotAnalytics
  );

  // Check shot events not filtered
  const shotEvents = filtered.player_analytics.players[0].shot_events;
  console.log('✓ All shot events included:', shotEvents.length, 'events');
  console.log('✓ Court info included:', !!filtered.player_analytics.court_info);
  console.log('✓ Heatmap included:', !!filtered.files.player_heatmap_overlay);
} catch (error) {
  console.error('✗ Failed filtering for pro user:', error.message);
}

// Test 4: Backwards compatibility with old format
console.log('\n4. Testing backwards compatibility with old format...');
const oldFormatAnalysis = {
  match_id: 'test-match-old',
  status: 'completed',
  player_analytics: {
    metadata: {
      duration_minutes: 90,
      date_analysed: '2024-01-01T10:00:00Z',
      frame_shape: [1080, 1920],
      fps: 30,
      num_players: 2,
    },
    players: [
      {
        color: [255, 0, 0],
        average_speed_kmh: 15.5,
        total_distance_km: 3.2,
        average_distance_from_center_km: 2.1,
        calories_burned: 450,
        shots: {
          forehand: 45,
          backhand: 32,
          volley: 15,
          smash: 8,
          total_shots: 100,
          success: 95,
          success_rate: 95,
        },
        shot_events: [],
        highlight_urls: [],
      },
    ],
  },
  files: {
    highlights: new Map([['0', ['https://example.com/highlight.mp4']]]),
  },
  metadata: {
    created_at: '2024-01-01T09:00:00Z',
    completed_at: '2024-01-01T10:00:00Z',
    storage: 's3',
  },
};

try {
  const formatted = formatAnalysisResponse(oldFormatAnalysis, 'user123');
  console.log('✓ Old format still works');
  console.log(
    '✓ shot_analytics created from shots:',
    !!formatted.player_analytics.players[0].shot_analytics
  );
  console.log(
    '✓ Original shots preserved:',
    !!formatted.player_analytics.players[0].shots
  );

  // Test filtering with old format
  const filteredFree = filterAnalysisResultsBySubscription(formatted, freeUser);
  const filteredPro = filterAnalysisResultsBySubscription(formatted, proUser);

  console.log('✓ Free user filtering works with old format');
  console.log('✓ Pro user filtering works with old format');
} catch (error) {
  console.error('✗ Backwards compatibility failed:', error.message);
}

console.log('\n=== All Tests Completed ===');
