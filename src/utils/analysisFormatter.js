import Analysis from "../models/Analysis.js";
import AppError from "./appError.js";
import { createOne } from "../factory/repo.js";

// Formatter to convert API response to MongoDB document
const formatAnalysisResponse = (apiResponse, userId) => {
  // Create a copy to avoid mutating the original
  const formatted = JSON.parse(JSON.stringify(apiResponse));

  // 1. Add required fields that aren't in the API response
  formatted.created_by = userId;

  // 2. Convert date strings to Date objects
  if (formatted.player_analytics?.metadata?.date_analysed) {
    formatted.player_analytics.metadata.date_analysed = new Date(
      formatted.player_analytics.metadata.date_analysed
    );
  }

  if (formatted.metadata?.created_at) {
    formatted.metadata.created_at = new Date(formatted.metadata.created_at);
  }

  if (formatted.metadata?.completed_at) {
    formatted.metadata.completed_at = new Date(formatted.metadata.completed_at);
  }

  // 3. Handle both old and new shot analytics formats
  if (formatted.player_analytics?.players) {
    formatted.player_analytics.players.forEach((player) => {
      // If the new format has shot_analytics, ensure compatibility
      if (player.shot_analytics && !player.shots) {
        // Convert shot_analytics to shots format for backward compatibility
        player.shots = {
          forehand: player.shot_analytics.forehand || 0,
          backhand: player.shot_analytics.backhand || 0,
          volley: player.shot_analytics.volley || 0,
          smash: player.shot_analytics.smash || 0,
          total_shots: player.shot_analytics.total_shots || 0,
          success: player.shot_analytics.total_shots || 0, // Default success count
          success_rate: 100, // Default success rate
        };
      }
      // If old format has shots but no shot_analytics, create shot_analytics
      else if (player.shots && !player.shot_analytics) {
        player.shot_analytics = {
          forehand: player.shots.forehand || 0,
          backhand: player.shots.backhand || 0,
          volley: player.shots.volley || 0,
          smash: player.shots.smash || 0,
          total_shots: player.shots.total_shots || 0,
        };
      }

      // Ensure new metrics are present with default values if missing
      if (player.peak_speed_kmh === undefined || player.peak_speed_kmh === null) {
        player.peak_speed_kmh = player.average_speed_kmh || 0;
      }
      if (player.net_dominance_percentage === undefined || player.net_dominance_percentage === null) {
        player.net_dominance_percentage = 0;
      }
      if (player.dead_zone_presence_percentage === undefined || player.dead_zone_presence_percentage === null) {
        player.dead_zone_presence_percentage = 0;
      }
      if (player.baseline_play_percentage === undefined || player.baseline_play_percentage === null) {
        player.baseline_play_percentage = 0;
      }

      // Handle shot_events - ensure they are properly formatted arrays
      if (player.shot_events) {
        if (Array.isArray(player.shot_events)) {
          // Already an array, ensure each event has proper structure
          player.shot_events = player.shot_events
            .map((event) => {
              if (typeof event === "object" && event !== null) {
                return event;
              } else {
                // If it's not an object, skip it or create a minimal structure
                console.warn("Invalid shot event format, skipping:", event);
                return null;
              }
            })
            .filter((event) => event !== null);
        } else {
          // If it's not an array, wrap it or clear it
          console.warn(
            "shot_events is not an array, clearing:",
            player.shot_events
          );
          player.shot_events = [];
        }
      } else {
        // Ensure shot_events exists as empty array
        player.shot_events = player;
      }
    });
  }

  // Handle top-level shot_events if they exist
  if (formatted.player_analytics?.shot_events) {
    if (Array.isArray(formatted.player_analytics.shot_events)) {
      // Already an array, ensure each event has proper structure
      formatted.player_analytics.shot_events =
        formatted.player_analytics.shot_events
          .map((event) => {
            if (typeof event === "object" && event !== null) {
              return event;
            } else {
              console.warn(
                "Invalid top-level shot event format, skipping:",
                event
              );
              return null;
            }
          })
          .filter((event) => event !== null);
    } else {
      console.warn(
        "Top-level shot_events is not an array, clearing:",
        formatted.player_analytics.shot_events
      );
      formatted.player_analytics.shot_events = [];
    }
  }

  // 4. Convert highlights object to Map format
  if (formatted.files?.highlights) {
    // Convert plain object to Map
    const highlightsMap = new Map();
    for (const [key, value] of Object.entries(formatted.files.highlights)) {
      highlightsMap.set(key, value);
    }
    formatted.files.highlights = highlightsMap;
  }

  // 5. Validate and clean up any null/undefined values
  if (formatted.files) {
    // Convert null strings to actual null
    Object.keys(formatted.files).forEach((key) => {
      if (formatted.files[key] === null || formatted.files[key] === "null") {
        formatted.files[key] = null;
      }
    });
  }

  // 6. Ensure all required nested objects exist
  if (!formatted.player_analytics) {
    formatted.player_analytics = null;
  }

  if (!formatted.files) {
    formatted.files = null;
  }

  if (!formatted.metadata) {
    formatted.metadata = null;
  }

  return formatted;
};

// Usage function
const createAnalysisFromResponse = async (apiResponse, userId) => {
  try {
    // Format the response
    const formattedData = formatAnalysisResponse(apiResponse, userId);

    // Validate required fields
    if (!formattedData.match_id) {
      throw new AppError("match_id is required");
    }

    if (!formattedData.status) {
      throw new AppError("status is required");
    }

    // Create the analysis document
    const analysis = await Analysis.create(formattedData);

    return analysis;
  } catch (error) {
    console.error("Error creating analysis:", error);
    throw new AppError(error, 500);
  }
};

// Alternative: Using your createOne helper
const createAnalysisWithHelper = async (createOne, apiResponse, userId) => {
  try {
    const formattedData = formatAnalysisResponse(apiResponse, userId);
    return await createOne(Analysis, formattedData);
  } catch (error) {
    console.error("Error creating analysis with helper:", error);
    throw error;
  }
};

// Utility function to validate the API response before formatting
const validateApiResponse = (response) => {
  const errors = [];

  if (!response.match_id) {
    errors.push("match_id is missing");
  }

  if (!response.status) {
    errors.push("status is missing");
  }

  // if (response.status === 'completed') {
  // if (!response.player_analytics) {
  //   errors.push('player_analytics is required for completed status');
  // }

  // if (!response.files) {
  //   errors.push('files is required for completed status');
  // }

  // if (!response.metadata) {
  //   errors.push('metadata is required for completed status');
  // }
  // }

  console.log("Validation errors:", errors);

  return errors;
};

// Complete workflow function
const processAnalysisResponse = async (apiResponse, userId) => {
  console.log(
    "Processing analysis response...",
    apiResponse,
    apiResponse.player_analytics
  );
  try {
    // Step 1: Validate the API response
    const validationErrors = validateApiResponse(apiResponse);
    if (validationErrors.length > 0) {
      throw new AppError(
        `API response validation failed: ${validationErrors.join(", ")}`
      );
    }

    // Step 2: Format the response
    const formattedData = formatAnalysisResponse(apiResponse, userId);

    // Step 3: Create the document
    const analysis = await createOne(Analysis, formattedData);

    console.log("Analysis created successfully:", analysis.match_id);
    return analysis;
  } catch (error) {
    console.error("Error processing analysis response:", error);
    throw error;
  }
};

// Transform new analysis results format to expected format
const transformNewAnalysisResults = (newFormatResponse) => {
  const { status, job_id, analysis_status, results } = newFormatResponse;

  // If it's not the new format, return as is
  if (!results || typeof results !== "object" || !job_id) {
    return newFormatResponse;
  }

  // Convert numbered player results to player analytics format
  const players = [];

  Object.keys(results).forEach((playerKey) => {
    const playerData = results[playerKey];

    // Convert the new format metrics to the expected format
    const player = {
      color: [255, 0, 0], // Default color, would need to be provided from match data
      average_speed_kmh:
        parseFloat(
          playerData["Average Speed"]?.replace(" Miles per Hour", "")
        ) * 1.60934 || 0, // Convert MPH to KMH
      total_distance_km:
        parseFloat(playerData["Distance Covered"]?.replace(" Meters", "")) /
          1000 || 0, // Convert meters to km
      average_distance_from_center_km: 0, // Not provided in new format
      calories_burned: 0, // Not provided in new format
      shots: {
        total_shots: 0,
        forehand: 0,
        backhand: 0,
        volley: 0,
        smash: 0,
        success: 0,
        // success_rate:
        //   parseFloat(playerData["Net Dominance"]?.replace(" %", "")) || 0,
      },
      shot_events: [],
      highlight_urls: [],
      // Additional metrics from new format
      peak_speed_kmh:
        parseFloat(playerData["Peak Speed"]?.replace(" Miles per Hour", "")) *
          1.60934 || 0,
      net_dominance_percentage:
        parseFloat(playerData["Net Dominance"]?.replace(" %", "")) || 0,
      dead_zone_presence_percentage:
        parseFloat(playerData["Dead Zone Presence"]?.replace(" %", "")) || 0,
      baseline_play_percentage:
        parseFloat(playerData["Baseline Play"]?.replace(" %", "")) || 0,
    };

    console.log("Transformed player data:", player);

    players.push(player);
  });

  console.log({});

  // Return in expected format
  return {
    status: analysis_status || status,
    analysis_status: analysis_status,
    job_id: job_id,
    player_analytics: {
      metadata: {
        duration_minutes: 0, // Not provided in new format
        date_analysed: new Date(),
        frame_shape: [1080, 1920], // Default values
        fps: 30,
        num_players: players.length,
      },
      players: players,
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
    },
    files: {
      highlights: new Map(),
    },
    metadata: {
      created_at: new Date(),
      completed_at: new Date(),
      storage: "s3",
    },
    // Keep original new format data for reference
    _original_new_format: newFormatResponse,
  };
};

// Export the functions
export {
  formatAnalysisResponse,
  createAnalysisFromResponse,
  createAnalysisWithHelper,
  validateApiResponse,
  processAnalysisResponse,
  transformNewAnalysisResults,
};

// Usage examples:

// Example 1: Direct usage
/*
const response = await VideoAnalysisService.getAnalysisResult(analysisId);
const analysis = await createAnalysisFromResponse(response, userId);
*/

// Example 2: With your createOne helper
/*
const response = await VideoAnalysisService.getAnalysisResult(analysisId);
const analysis = await createAnalysisWithHelper(createOne, response, userId);
*/

// Example 3: Complete workflow
/*
const response = await VideoAnalysisService.getAnalysisResult(analysisId);
const analysis = await processAnalysisResponse(response, userId, createOne);
*/
