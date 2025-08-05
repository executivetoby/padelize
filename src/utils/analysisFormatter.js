import Analysis from '../models/Analysis.js';
import AppError from './appError.js';
import { createOne } from '../factory/repo.js';

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

  // 3. Convert highlights object to Map format
  if (formatted.files?.highlights) {
    // Convert plain object to Map
    const highlightsMap = new Map();
    for (const [key, value] of Object.entries(formatted.files.highlights)) {
      highlightsMap.set(key, value);
    }
    formatted.files.highlights = highlightsMap;
  }

  // 4. Validate and clean up any null/undefined values
  if (formatted.files) {
    // Convert null strings to actual null
    Object.keys(formatted.files).forEach((key) => {
      if (formatted.files[key] === null || formatted.files[key] === 'null') {
        formatted.files[key] = null;
      }
    });
  }

  // 5. Ensure all required nested objects exist
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
      throw new AppError('match_id is required');
    }

    if (!formattedData.status) {
      throw new AppError('status is required');
    }

    // Create the analysis document
    const analysis = await Analysis.create(formattedData);

    return analysis;
  } catch (error) {
    console.error('Error creating analysis:', error);
    throw new AppError(error, 500);
  }
};

// Alternative: Using your createOne helper
const createAnalysisWithHelper = async (createOne, apiResponse, userId) => {
  try {
    const formattedData = formatAnalysisResponse(apiResponse, userId);
    return await createOne(Analysis, formattedData);
  } catch (error) {
    console.error('Error creating analysis with helper:', error);
    throw error;
  }
};

// Utility function to validate the API response before formatting
const validateApiResponse = (response) => {
  const errors = [];

  if (!response.match_id) {
    errors.push('match_id is missing');
  }

  if (!response.status) {
    errors.push('status is missing');
  }

  if (response.status === 'completed') {
    if (!response.player_analytics) {
      errors.push('player_analytics is required for completed status');
    }

    if (!response.files) {
      errors.push('files is required for completed status');
    }

    if (!response.metadata) {
      errors.push('metadata is required for completed status');
    }
  }

  return errors;
};

// Complete workflow function
const processAnalysisResponse = async (apiResponse, userId) => {
  try {
    // Step 1: Validate the API response
    const validationErrors = validateApiResponse(apiResponse);
    if (validationErrors.length > 0) {
      throw new AppError(
        `API response validation failed: ${validationErrors.join(', ')}`
      );
    }

    // Step 2: Format the response
    const formattedData = formatAnalysisResponse(apiResponse, userId);

    // Step 3: Create the document
    const analysis = await createOne(Analysis, formattedData);

    console.log('Analysis created successfully:', analysis.match_id);
    return analysis;
  } catch (error) {
    console.error('Error processing analysis response:', error);
    throw error;
  }
};

// Export the functions
export {
  formatAnalysisResponse,
  createAnalysisFromResponse,
  createAnalysisWithHelper,
  validateApiResponse,
  processAnalysisResponse,
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
