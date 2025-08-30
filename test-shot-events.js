import { formatAnalysisResponse } from './src/utils/analysisFormatter.js';

// Test data with problematic shot_events format that might cause the error
const problematicAnalysis = {
  match_id: 'test-match-shot-events',
  status: 'completed',
  player_analytics: {
    metadata: {
      duration_minutes: 90,
      date_analysed: '2024-01-01T10:00:00Z',
      frame_shape: [1080, 1920],
      fps: 30,
      num_players: 2,
    },
    // Top-level shot_events (new format)
    shot_events: [
      {
        timestamp: 10.5,
        ball_pos: [5, 3],
        player_pos: [3, 4],
        velocity: 80,
        type: 'forehand',
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
        // This might be the problematic field causing the error
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
    highlights: {
      0: ['https://example.com/highlight1.mp4'],
    },
  },
  metadata: {
    created_at: '2024-01-01T09:00:00Z',
    completed_at: '2024-01-01T10:00:00Z',
    storage: 's3',
  },
};

// Test case with invalid shot_events that might cause the error
const invalidShotEventsAnalysis = {
  ...problematicAnalysis,
  player_analytics: {
    ...problematicAnalysis.player_analytics,
    players: [
      {
        ...problematicAnalysis.player_analytics.players[0],
        // This might be the issue - shot_events as a string instead of array
        shot_events: 'type', // This could be causing the cast error
      },
    ],
  },
};

console.log('=== Testing Shot Events Handling ===\n');

// Test 1: Valid shot events format
console.log('1. Testing valid shot events format...');
try {
  const formatted = formatAnalysisResponse(problematicAnalysis, 'user123');
  console.log('✓ Successfully formatted analysis with valid shot events');
  console.log(
    '✓ Player shot_events count:',
    formatted.player_analytics.players[0].shot_events.length
  );
  console.log(
    '✓ Top-level shot_events count:',
    formatted.player_analytics.shot_events?.length || 0
  );
} catch (error) {
  console.error('✗ Failed with valid shot events:', error.message);
}

// Test 2: Invalid shot events format (this might reproduce the error)
console.log('\n2. Testing invalid shot events format...');
try {
  const formatted = formatAnalysisResponse(
    invalidShotEventsAnalysis,
    'user123'
  );
  console.log('✓ Successfully handled invalid shot events format');
  console.log(
    '✓ Player shot_events is array:',
    Array.isArray(formatted.player_analytics.players[0].shot_events)
  );
  console.log(
    '✓ Player shot_events count:',
    formatted.player_analytics.players[0].shot_events.length
  );
} catch (error) {
  console.error('✗ Failed with invalid shot events:', error.message);
}

// Test 3: Missing shot events
console.log('\n3. Testing missing shot events...');
const noShotEventsAnalysis = {
  ...problematicAnalysis,
  player_analytics: {
    ...problematicAnalysis.player_analytics,
    shot_events: undefined,
    players: [
      {
        ...problematicAnalysis.player_analytics.players[0],
        shot_events: undefined,
      },
    ],
  },
};

try {
  const formatted = formatAnalysisResponse(noShotEventsAnalysis, 'user123');
  console.log('✓ Successfully handled missing shot events');
  console.log(
    '✓ Player shot_events is array:',
    Array.isArray(formatted.player_analytics.players[0].shot_events)
  );
  console.log(
    '✓ Player shot_events count:',
    formatted.player_analytics.players[0].shot_events.length
  );
} catch (error) {
  console.error('✗ Failed with missing shot events:', error.message);
}

// Test 4: Array with invalid elements
console.log('\n4. Testing array with invalid elements...');
const mixedShotEventsAnalysis = {
  ...problematicAnalysis,
  player_analytics: {
    ...problematicAnalysis.player_analytics,
    players: [
      {
        ...problematicAnalysis.player_analytics.players[0],
        shot_events: [
          {
            timestamp: 10.5,
            ball_pos: [5, 3],
            type: 'forehand',
            success: true,
          },
          'invalid_string', // This should be filtered out
          null, // This should be filtered out
          {
            timestamp: 25.2,
            type: 'volley',
            success: true,
          },
        ],
      },
    ],
  },
};

try {
  const formatted = formatAnalysisResponse(mixedShotEventsAnalysis, 'user123');
  console.log('✓ Successfully handled mixed shot events');
  console.log(
    '✓ Player shot_events filtered count:',
    formatted.player_analytics.players[0].shot_events.length
  );
} catch (error) {
  console.error('✗ Failed with mixed shot events:', error.message);
}

console.log('\n=== Shot Events Tests Completed ===');
