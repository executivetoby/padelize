// const fs = require('fs');
// const path = require('path');
// const fetch = require('node-fetch'); // npm install node-fetch@2

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import { uploadLargeFile } from './s3UploadService.js';
import Match from '../models/Match.js';
import { findOne } from '../factory/repo.js';

// Configuration - update with your Python API URL
const PYTHON_API_BASE_URL = 'http://127.0.0.1:8000';
// const PYTHON_API_BASE_URL = 'http://3.107.27.98';

class VideoAnalysisService {
  // Helper function to create multipart form data manually
  // static createMultipartFormData(videoPath, options = {}) {
  //   const boundary = `----FormBoundary${Math.random()
  //     .toString(36)
  //     .substring(2)}`;
  //   let body = '';

  //   // Add video file
  //   const videoBuffer = fs.readFileSync(videoPath);
  //   const filename = path.basename(videoPath);

  //   body += `--${boundary}\r\n`;
  //   body += `Content-Disposition: form-data; name="video"; filename="${filename}"\r\n`;
  //   body += `Content-Type: video/mp4\r\n\r\n`;

  //   // Convert body to buffer and append video data
  //   const bodyParts = [Buffer.from(body, 'utf8'), videoBuffer];

  //   // Add form parameters
  //   let formFields = `\r\n`;

  //   if (options.confidence !== undefined) {
  //     formFields += `--${boundary}\r\n`;
  //     formFields += `Content-Disposition: form-data; name="confidence"\r\n\r\n`;
  //     formFields += `${options.confidence}\r\n`;
  //   }

  //   if (options.skip_frames !== undefined) {
  //     formFields += `--${boundary}\r\n`;
  //     formFields += `Content-Disposition: form-data; name="skip_frames"\r\n\r\n`;
  //     formFields += `${options.skip_frames}\r\n`;
  //   }

  //   if (options.court_detection !== undefined) {
  //     formFields += `--${boundary}\r\n`;
  //     formFields += `Content-Disposition: form-data; name="court_detection"\r\n\r\n`;
  //     formFields += `${options.court_detection}\r\n`;
  //   }

  //   formFields += `--${boundary}--\r\n`;

  //   bodyParts.push(Buffer.from(formFields, 'utf8'));

  //   return {
  //     body: Buffer.concat(bodyParts),
  //     contentType: `multipart/form-data; boundary=${boundary}`,
  //   };
  // }

  static createMultipartFormData(videoPath, options = {}, userId, matchId) {
    const boundary = `----FormBoundary${Math.random()
      .toString(36)
      .substring(2)}`;
    let body = '';

    // Add video file
    const videoBuffer = fs.readFileSync(videoPath);
    const filename = path.basename(videoPath);

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="video"; filename="${filename}"\r\n`;
    body += `Content-Type: video/mp4\r\n\r\n`;

    const bodyParts = [Buffer.from(body, 'utf8'), videoBuffer];

    // Add form parameters
    let formFields = `\r\n`;

    const appendField = (name, value) => {
      formFields += `--${boundary}\r\n`;
      formFields += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
      formFields += `${value}\r\n`;
    };

    if (options.confidence !== undefined) {
      appendField('confidence', options.confidence);
    }

    if (options.skip_frames !== undefined) {
      appendField('skip_frames', options.skip_frames);
    }

    if (options.court_detection !== undefined) {
      appendField('court_detection', options.court_detection);
    }

    // ✅ Add these two fields
    if (userId) {
      appendField('user_id', userId);
    }

    if (matchId) {
      appendField('match_id', matchId);
    }

    formFields += `--${boundary}--\r\n`;

    bodyParts.push(Buffer.from(formFields, 'utf8'));

    return {
      body: Buffer.concat(bodyParts),
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  // Start video analysis using native approach
  static async analyzeVideo(body) {
    try {
      // const { body, contentType } = this.createMultipartFormData(
      //   videoPath,
      //   options,
      //   matchId,
      //   userId
      // );

      const response = await fetch(`${PYTHON_API_BASE_URL}/analyze-video`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Python API error: ${response.status} - ${errorText}`);
      }

      // console.log({ response: response.json() });

      return await response.json();
    } catch (error) {
      console.error('Error starting video analysis:', error);
      throw error;
    }
  }

  // Alternative approach using URLSearchParams for query params and separate file upload
  static async analyzeVideoAlternative(videoPath, options = {}) {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (options.confidence !== undefined)
        params.append('confidence', options.confidence);
      if (options.skip_frames !== undefined)
        params.append('skip_frames', options.skip_frames);
      if (options.court_detection !== undefined)
        params.append('court_detection', options.court_detection);

      const queryString = params.toString();
      const url = `${PYTHON_API_BASE_URL}/analyze-video${
        queryString ? `?${queryString}` : ''
      }`;

      // Read video file as buffer
      const videoBuffer = fs.readFileSync(videoPath);
      const filename = path.basename(videoPath);

      // Create simple multipart body with just the video
      const boundary = `----FormBoundary${Math.random()
        .toString(36)
        .substring(2)}`;
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="video"; filename="${filename}"\r\n` +
            `Content-Type: video/mp4\r\n\r\n`,
          'utf8'
        ),
        videoBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
      ]);

      const response = await fetch(url, {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Python API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting video analysis:', error);
      throw error;
    }
  }

  // Check analysis status
  static async getAnalysisStatus(analysisId) {
    try {
      const response = await fetch(
        `${PYTHON_API_BASE_URL}/analysis/${analysisId}/status`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Status check error: ${response.status} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking analysis status:', error);
      throw error;
    }
  }

  // Get analysis results
  static async getAnalysisResults(analysisId) {
    try {
      const response = await fetch(
        `${PYTHON_API_BASE_URL}/analysis/${analysisId}/results`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Results fetch error: ${response.status} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting analysis results:', error);
      throw error;
    }
  }

  // Delete analysis and cleanup files
  static async deleteAnalysis(analysisId) {
    try {
      const response = await fetch(
        `${PYTHON_API_BASE_URL}/analysis/${analysisId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Delete error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting analysis:', error);
      throw error;
    }
  }

  // Wait for analysis completion with polling
  static async waitForCompletion(
    analysisId,
    maxWaitTime = 300000,
    pollInterval = 2000
  ) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getAnalysisStatus(analysisId);

      if (status.status === 'completed') {
        return await this.getAnalysisResults(analysisId);
      } else if (status.status === 'failed') {
        throw new Error(`Analysis failed: ${status.message}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Analysis timeout - exceeded maximum wait time');
  }

  // Complete analysis workflow (start + wait for completion)
  static async analyzeVideoComplete(videoPath, options = {}) {
    try {
      // Start analysis
      const analysisStart = await this.analyzeVideo(videoPath, options);
      console.log('Analysis started:', analysisStart.analysis_id);

      // Wait for completion
      const results = await this.waitForCompletion(analysisStart.analysis_id);
      console.log('Analysis completed successfully');

      return {
        analysisId: analysisStart.analysis_id,
        ...results,
      };
    } catch (error) {
      console.error('Complete analysis workflow failed:', error);
      throw error;
    }
  }

  // Check if Python API is healthy
  static async checkHealth() {
    try {
      const response = await fetch(`${PYTHON_API_BASE_URL}/`);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Python API health check failed:', error);
      throw error;
    }
  }
}

// Express route handler that uploads file AND analyzes video
export const analyzeVideoService = catchAsync(async (req, res, next) => {
  const { matchId } = req.body;
  const { _id: userId } = req.user;

  console.log({ matchId, userId });

  const match = await findOne(Match, { _id: matchId, creator: userId });
  if (!match || !match.video)
    return next(
      new AppError('No match found or no video attached to analyze', 404)
    );

  const options = {
    confidence: parseFloat(req.body.confidence) || 0.5,
    skip_frames: parseInt(req.body.skip_frames) || 5,
    court_detection: req.body.court_detection === 'true',
  };

  let analysisResult = null;
  // let uploadResult = null;

  const video_url = match.video;

  try {
    // Step 1: Start video analysis using temp file
    console.log('Starting video analysis...');
    analysisResult = await VideoAnalysisService.analyzeVideo({
      options,
      match_id: matchId,
      user_id: userId,
      game_type: 'doubles',
      target_player_position: 'near_right',
      enable_ball_tracking: true,
      enable_action_recognition: true,
      video_url,
    });
    console.log('Analysis started:', analysisResult.analysis_id);
    if (!analysisResult || !analysisResult.analysis_id) {
      throw new Error('Analysis failed to start');
    }

    match.analysisId = analysisResult.analysis_id;
    match.analysisStatus = analysisResult.status;

    await match.save();

    // Step 3: Clean up temp file
    // fs.unlinkSync(tempPath);

    // Step 4: Return both analysis info and file URL
    res.status(200).json({
      status: 'success',
      message: 'Video analysis started successfully',
      data: {
        analysis: {
          analysisId: analysisResult.analysis_id,
          status: analysisResult.status,
          message: analysisResult.message,
        },
        match,
      },
    });
  } catch (error) {
    console.error('Video analysis error:', error);

    return next(new AppError(`Process failed: ${error.message}`, 500));
  }
});

export const getAnalysisStatusService = catchAsync(async (req, res, next) => {
  const { analysisId } = req.params;

  try {
    const status = await VideoAnalysisService.getAnalysisStatus(analysisId);

    res.status(200).json({
      status: 'success',
      data: status,
    });
  } catch (error) {
    return next(new AppError(`Status check failed: ${error.message}`, 500));
  }
});

export const getAnalysisResultsService = catchAsync(async (req, res, next) => {
  const { analysisId } = req.params;

  try {
    const results = await VideoAnalysisService.getAnalysisResults(analysisId);

    const match = await Match.findOne({
      analysisId: analysisId,
    }).populate({
      path: 'creator',
      populate: {
        path: 'subscription',
        model: 'Subscription',
      },
    });

    // Import filtering function
    const { filterAnalysisResultsBySubscription } = await import(
      '../utils/subscriptionUtils.js'
    );

    // Apply subscription-based filtering based on match creator's subscription
    const filteredResults = filterAnalysisResultsBySubscription(
      results,
      match.creator
    );

    res.status(200).json({
      status: 'success',
      data: { results: filteredResults, match },
    });
  } catch (error) {
    return next(new AppError(`Results fetch failed: ${error.message}`, 500));
  }
});

export const analyzeVideoCompleteService = catchAsync(
  async (req, res, next) => {
    if (!req.file) {
      return next(new AppError('No video file provided', 400));
    }

    const { path: tempPath, originalname } = req.file;
    const options = {
      confidence: parseFloat(req.body.confidence) || 0.5,
      skip_frames: parseInt(req.body.skip_frames) || 3,
      court_detection: req.body.court_detection === 'true',
    };

    let analysisResults = null;
    let uploadResult = null;

    try {
      // Step 1: Complete video analysis (start + wait for completion)
      console.log('Starting complete video analysis...');
      analysisResults = await VideoAnalysisService.analyzeVideoComplete(
        tempPath,
        options
      );
      console.log('Analysis completed successfully');

      // Step 2: Upload file to your storage
      console.log('Uploading video file...');
      uploadResult = await uploadLargeFile(tempPath, originalname);

      if (!uploadResult) {
        throw new Error('Failed to upload video file');
      }

      console.log('File uploaded successfully');

      // Step 3: Clean up temp file
      fs.unlinkSync(tempPath);

      // Step 4: Return complete results with file URL
      res.status(200).json({
        status: 'success',
        message: 'Video analysis completed and file uploaded',
        data: {
          analysis: {
            analysisId: analysisResults.analysisId,
            status: 'completed',
            results: analysisResults.results,
          },
          upload: {
            fileUrl: uploadResult.Location,
            fileName: originalname,
          },
        },
      });
    } catch (error) {
      console.error('Complete video analysis/upload error:', error);

      // Clean up temp file on error
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }

      return next(
        new AppError(`Complete process failed: ${error.message}`, 500)
      );
    }
  }
);

export const deleteAnalysisService = catchAsync(async (req, res, next) => {
  const { analysisId } = req.params;

  try {
    const result = await VideoAnalysisService.deleteAnalysis(analysisId);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    return next(new AppError(`Delete failed: ${error.message}`, 500));
  }
});

export const checkPythonApiHealthService = catchAsync(
  async (req, res, next) => {
    try {
      const healthData = await VideoAnalysisService.checkHealth();

      res.status(200).json({
        status: 'success',
        message: 'Python API is healthy',
        data: {
          pythonApi: healthData,
          timestamp: new Date().toISOString(),
          apiUrl: PYTHON_API_BASE_URL,
        },
      });
    } catch (error) {
      // Python API is down or unhealthy
      res.status(503).json({
        status: 'error',
        message: 'Python API is unavailable',
        data: {
          error: error.message,
          timestamp: new Date().toISOString(),
          apiUrl: PYTHON_API_BASE_URL,
        },
      });
    }
  }
);

// Enhanced health check that tests multiple endpoints
export const fullHealthCheckService = catchAsync(async (req, res, next) => {
  const healthResults = {
    nodeApi: 'healthy',
    pythonApi: null,
    timestamp: new Date().toISOString(),
    details: {},
  };

  try {
    // Check Python API health
    const startTime = Date.now();
    const pythonHealth = await VideoAnalysisService.checkHealth();
    const responseTime = Date.now() - startTime;

    healthResults.pythonApi = 'healthy';
    healthResults.details.pythonApi = {
      status: pythonHealth,
      responseTime: `${responseTime}ms`,
      url: PYTHON_API_BASE_URL,
    };

    res.status(200).json({
      status: 'success',
      message: 'All services are healthy',
      data: healthResults,
    });
  } catch (error) {
    healthResults.pythonApi = 'unhealthy';
    healthResults.details.pythonApi = {
      error: error.message,
      url: PYTHON_API_BASE_URL,
    };

    res.status(503).json({
      status: 'partial',
      message: 'Some services are unavailable',
      data: healthResults,
    });
  }
});

// Export the service class for direct use
export { VideoAnalysisService };
