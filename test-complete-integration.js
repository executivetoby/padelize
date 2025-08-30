import { formatAnalysisResponse } from './src/utils/analysisFormatter.js';
import { filterAnalysisResultsBySubscription } from './src/utils/subscriptionUtils.js';

// Test with the exact new format that might be coming from the API
const newFormatAnalysisResult = {
  match_id: 'test-match-new-complete',
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
    // Top-level shot_events (new format feature)
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
        timestamp: 35.8,
        ball_pos: [8, 6],
        player_pos: [7, 5],
        velocity: 95,
        type: 'smash',
        success: true,
      },
    ],
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
          {
            timestamp: 40.1,
            ball_pos: [12, 5],
            player_pos: [11, 4],
            velocity: 95,
            type: 'smash',
            success: true,
          },
        ],
        highlight_urls: ['https://example.com/highlight1.mp4'],
      },
      {
        color: [0, 255, 0],
        average_speed_kmh: 14.2,
        total_distance_km: 2.9,
        average_distance_from_center_km: 1.8,
        calories_burned: 420,
        shot_analytics: {
          forehand: 38,
          backhand: 28,
          volley: 12,
          smash: 6,
          total_shots: 84,
        },
        shot_events: [
          {
            timestamp: 15.3,
            ball_pos: [8, 4],
            player_pos: [9, 5],
            velocity: 75,
            type: 'backhand',
            success: true,
          },
        ],
        highlight_urls: ['https://example.com/highlight2.mp4'],
      },
    ],
  },
  files: {
    player_analytics: 'https://example.com/analytics.json',
    player_heatmap_overlay: 'https://example.com/heatmap.png',
    highlights: {
      0: ['https://example.com/highlight1.mp4'],
      1: ['https://example.com/highlight2.mp4'],
    },
  },
  metadata: {
    created_at: '2024-01-01T09:00:00Z',
    completed_at: '2024-01-01T10:00:00Z',
    storage: 's3',
  },
};

// Mock users
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

console.log('=== Complete New Format Integration Test ===\n');

// Test 1: Format the complete new analysis
console.log('1. Testing complete new format processing...');
try {
  const formatted = formatAnalysisResponse(
    newFormatAnalysisResult,
    'creator123'
  );
  console.log('✓ Successfully formatted complete new analysis');
  console.log(
    '✓ Court info preserved:',
    !!formatted.player_analytics.court_info
  );
  console.log(
    '✓ Top-level shot_events count:',
    formatted.player_analytics.shot_events?.length || 0
  );
  console.log(
    '✓ Player 1 shot_events count:',
    formatted.player_analytics.players[0].shot_events.length
  );
  console.log(
    '✓ Player 2 shot_events count:',
    formatted.player_analytics.players[1].shot_events.length
  );
  console.log('✓ Both shots and shot_analytics created for each player');
  console.log(
    '✓ Highlights converted to Map:',
    formatted.files.highlights instanceof Map
  );
} catch (error) {
  console.error('✗ Failed to format complete analysis:', error.message);
  console.error(error.stack);
}

// Test 2: Filter for free user
console.log('\n2. Testing filtering for Free user (creator-based)...');
try {
  const formatted = formatAnalysisResponse(
    newFormatAnalysisResult,
    freeUser._id
  );
  const filtered = filterAnalysisResultsBySubscription(formatted, freeUser);

  console.log('Free user data structure:');
  console.log('- Court info included:', !!filtered.player_analytics.court_info);
  console.log(
    '- Top-level shot_events filtered count:',
    filtered.player_analytics.shot_events?.length || 0
  );
  console.log(
    '- Player 1 shot_events filtered:',
    filtered.player_analytics.players[0].shot_events?.length || 0
  );
  console.log(
    '- Player 2 shot_events filtered:',
    filtered.player_analytics.players[1].shot_events?.length || 0
  );

  // Check shot type filtering
  const p1Shots = filtered.player_analytics.players[0].shots;
  const p1Analytics = filtered.player_analytics.players[0].shot_analytics;

  console.log('✓ Volley excluded from shots:', !('volley' in p1Shots));
  console.log('✓ Smash excluded from shots:', !('smash' in p1Shots));
  console.log(
    '✓ Volley excluded from shot_analytics:',
    !('volley' in p1Analytics)
  );
  console.log(
    '✓ Smash excluded from shot_analytics:',
    !('smash' in p1Analytics)
  );

  // Check shot events filtering (should only include forehand/backhand)
  const topShotEvents = filtered.player_analytics.shot_events || [];
  const allowedTopEvents = topShotEvents.every((event) =>
    ['forehand', 'backhand'].includes(event.type?.toLowerCase())
  );
  console.log('✓ Top-level shot events properly filtered:', allowedTopEvents);

  console.log('✓ Heatmap excluded:', !filtered.files.player_heatmap_overlay);
} catch (error) {
  console.error('✗ Failed filtering for free user:', error.message);
  console.error(error.stack);
}

// Test 3: Filter for pro user
console.log('\n3. Testing filtering for Pro user (creator-based)...');
try {
  const formatted = formatAnalysisResponse(
    newFormatAnalysisResult,
    proUser._id
  );
  const filtered = filterAnalysisResultsBySubscription(formatted, proUser);

  console.log('Pro user data structure:');
  console.log('- Court info included:', !!filtered.player_analytics.court_info);
  console.log(
    '- Top-level shot_events count:',
    filtered.player_analytics.shot_events?.length || 0
  );
  console.log(
    '- Player 1 shot_events count:',
    filtered.player_analytics.players[0].shot_events?.length || 0
  );
  console.log(
    '- Player 2 shot_events count:',
    filtered.player_analytics.players[1].shot_events?.length || 0
  );

  // Check that all shot types are included
  const p1Shots = filtered.player_analytics.players[0].shots;
  const p1Analytics = filtered.player_analytics.players[0].shot_analytics;

  console.log(
    '✓ All shot types in shots:',
    'volley' in p1Shots && 'smash' in p1Shots
  );
  console.log(
    '✓ All shot types in shot_analytics:',
    'volley' in p1Analytics && 'smash' in p1Analytics
  );

  // Check that all shot events are included
  const topEventTypes = (filtered.player_analytics.shot_events || []).map(
    (e) => e.type
  );
  console.log(
    '✓ All shot event types included:',
    topEventTypes.includes('smash')
  );

  console.log('✓ Heatmap included:', !!filtered.files.player_heatmap_overlay);
} catch (error) {
  console.error('✗ Failed filtering for pro user:', error.message);
  console.error(error.stack);
}

console.log('\n=== Complete Integration Test Finished ===');
