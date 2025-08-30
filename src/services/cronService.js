import nodeCron from 'node-cron';

const cron = nodeCron;
import { VideoAnalysisService } from './analysisService.js';
import Match from '../models/Match.js';
import FirebaseService from './firebaseService.js';
import AppError from '../utils/appError.js';
import AnalysisStatus from '../models/AnalysisStatus.js';
import { createOne, findOne, updateOne } from '../factory/repo.js';
import { processAnalysisResponse } from '../utils/analysisFormatter.js';
import ProcessingLock from '../models/ProcessingLock.js';

// class AnalysisStatusCronJob {
//   constructor() {
//     this.isRunning = false;
//     this.processingAnalyses = new Set(); // Track analyses being processed
//   }

//   // Start the cron job
//   start() {
//     console.log('Starting analysis status cron job...');

//     // Run every 5 minutes: '*/5 * * * *'
//     this.cronJob = cron.schedule(
//       '*/5 * * * *',
//       async () => {
//         if (this.isRunning) {
//           console.log('Previous cron job still running, skipping...');
//           return;
//         }

//         this.isRunning = true;
//         console.log('Running analysis status check:', new Date().toISOString());

//         try {
//           await this.checkPendingAnalyses();
//         } catch (error) {
//           console.error('Error in analysis status cron job:', error);
//         } finally {
//           this.isRunning = false;
//         }
//       },
//       {
//         scheduled: true,
//         timezone: 'UTC', // Adjust timezone as needed
//       }
//     );

//     console.log('Analysis status cron job started - running every 5 minutes');
//   }

//   // Stop the cron job
//   stop() {
//     if (this.cronJob) {
//       this.cronJob.stop();
//       console.log('Analysis status cron job stopped');
//     }
//   }

//   // Check all pending analyses
//   async checkPendingAnalyses() {
//     try {
//       // Find all matches with pending analyses
//       const pendingMatches = await Match.find({
//         analysisId: { $exists: true, $ne: null },
//         analysisStatus: { $in: ['pending', 'processing', 'in_progress'] },
//       }).populate({ path: 'creator', select: 'fullName' });

//       console.log(`Found ${pendingMatches.length} pending analyses to check`);

//       // Process each pending analysis
//       const promises = pendingMatches.map((match) =>
//         this.checkSingleAnalysis(match)
//       );

//       await Promise.allSettled(promises);
//     } catch (error) {
//       console.error('Error fetching pending analyses:', error);
//       throw error;
//     }
//   }

//   // Check status of a single analysis
//   async checkSingleAnalysis(match) {
//     const { analysisId, _id: matchId, creator } = match;

//     // Skip if already being processed
//     if (this.processingAnalyses.has(matchId)) {
//       console.log(`Analysis ${matchId} already being processed, skipping...`);
//       return;
//     }

//     this.processingAnalyses.add(matchId);

//     try {
//       console.log(`Checking status for analysis: ${matchId}`);

//       const status = await VideoAnalysisService.getAnalysisStatus(matchId);

//       let analysisStatus = await findOne(AnalysisStatus, { match_id: matchId });

//       if (!analysisStatus) {
//         await createOne(AnalysisStatus, status);
//       } else {
//         await updateOne(AnalysisStatus, { match_id: matchId }, status);
//       }

//       if (status.status === 'completed') {
//         await this.handleCompletedAnalysis(match, status);
//       } else if (status.status === 'failed') {
//         await this.handleFailedAnalysis(match, status);
//       } else {
//         // Still processing - update match status if needed
//         await this.updateMatchStatus(match, status.status);
//       }
//     } catch (error) {
//       console.error(`Error checking analysis ${matchId}:`, error);
//       await this.handleAnalysisError(match, error);
//     } finally {
//       this.processingAnalyses.delete(matchId);
//     }
//   }

//   // Handle completed analysis
//   async handleCompletedAnalysis(match, status) {
//     const { analysisId, _id: matchId, creator } = match;

//     try {
//       console.log(`Analysis ${matchId} completed, fetching results...`);

//       // Get the analysis results
//       const results = await VideoAnalysisService.getAnalysisResults(matchId);

//       // Update match with results and status
//       await Match.findByIdAndUpdate(matchId, {
//         analysisStatus: 'completed',
//       });

//       await processAnalysisResponse(results, creator);

//       // Send success notification
//       if (creator && creator._id) {
//         await FirebaseService.sendNotification(
//           creator._id,
//           'Analysis Complete',
//           'Your video analysis has completed successfully!',
//           {
//             matchId: matchId,
//             analysisId: analysisId,
//             type: 'analysis_completed',
//             status: 'completed',
//           }
//         );
//       }

//       console.log(`Successfully processed completed analysis: ${analysisId}`);
//     } catch (error) {
//       console.error(`Error handling completed analysis ${analysisId}:`, error);
//       await this.handleAnalysisError(match, error);
//     }
//   }

//   // Handle failed analysis
//   async handleFailedAnalysis(match, status) {
//     const { analysisId, _id: matchId, creator } = match;

//     try {
//       console.log(`Analysis ${analysisId} failed:`, status.message);

//       // Update match status
//       await Match.findByIdAndUpdate(matchId, {
//         analysisStatus: 'failed',
//       });

//       // Send failure notification
//       if (creator && creator._id) {
//         await FirebaseService.sendNotification(
//           creator._id,
//           'Analysis Failed',
//           'Your video analysis has failed. Please try again.',
//           {
//             matchId: matchId,
//             analysisId: analysisId,
//             type: 'analysis_failed',
//             status: 'failed',
//             error: status.message,
//           }
//         );
//       }

//       console.log(`Successfully processed failed analysis: ${analysisId}`);
//     } catch (error) {
//       console.error(`Error handling failed analysis ${analysisId}:`, error);
//     }
//   }

//   // Update match status for still processing analyses
//   async updateMatchStatus(match, newStatus) {
//     const { analysisId, _id: matchId } = match;

//     try {
//       await Match.findByIdAndUpdate(matchId, {
//         analysisStatus: newStatus,
//         updatedAt: new Date(),
//       });

//       console.log(`Updated match ${matchId} status to: ${newStatus}`);
//     } catch (error) {
//       console.error(`Error updating match ${matchId} status:`, error);
//     }
//   }

//   // Handle analysis check errors
//   async handleAnalysisError(match, error) {
//     const { analysisId, _id: matchId } = match;

//     try {
//       // If it's a 404 error, the analysis might have been deleted
//       if (error.message.includes('404')) {
//         await Match.findByIdAndUpdate(matchId, {
//           analysisStatus: 'not_found',
//           updatedAt: new Date(),
//         });
//       } else {
//         // For other errors, just log but don't update status
//         console.error(
//           `Temporary error checking analysis ${analysisId}:`,
//           error.message
//         );
//       }
//     } catch (updateError) {
//       console.error(`Error updating match after analysis error:`, updateError);
//     }
//   }

//   // Get current status of the cron job
//   getStatus() {
//     return {
//       isRunning: this.isRunning,
//       isScheduled: this.cronJob ? this.cronJob.scheduled : false,
//       processingCount: this.processingAnalyses.size,
//       processingAnalyses: Array.from(this.processingAnalyses),
//     };
//   }
// }

// Create and export singleton instance

class AnalysisStatusCronJob {
  constructor() {
    this.isRunning = false;
    this.PROCESSING_TIMEOUT = 48 * 60 * 60 * 1000; // 48 hours
  }

  // Start the cron job - STILL NEEDED!
  start() {
    console.log('Starting analysis status cron job...');

    // Run every 5 minutes: '*/5 * * * *'
    this.cronJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        if (this.isRunning) {
          console.log('Previous cron job still running, skipping...');
          return;
        }

        this.isRunning = true;
        console.log('Running analysis status check:', new Date().toISOString());

        try {
          await this.checkPendingAnalyses();
        } catch (error) {
          console.error('Error in analysis status cron job:', error);
        } finally {
          this.isRunning = false;
        }
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    );

    console.log('Analysis status cron job started - running every 5 minutes');
  }

  // Stop the cron job - STILL NEEDED!
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Analysis status cron job stopped');
    }
  }

  // Add processing lock with timestamp
  async addProcessingLock(matchId) {
    console.log({ matchId });
    try {
      let lock = await ProcessingLock.findOne({ matchId });

      if (!lock)
        lock = await createOne(ProcessingLock, {
          matchId,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + this.PROCESSING_TIMEOUT),
        });
      console.log('1:', { lock });
      return true;
    } catch (error) {
      console.error('Error adding processing lock:', error);
      return false;
    }
  }

  // Check if analysis is being processed
  async isProcessing(matchId) {
    try {
      const lock = await ProcessingLock.findOne({ matchId });

      console.log('Is processing:', { lock });

      if (!lock) return false;

      // Check if lock has expired
      if (lock.expiresAt < new Date()) {
        await ProcessingLock.deleteOne({ matchId });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking processing lock:', error);
      return false;
    }
  }

  // Remove processing lock
  async removeProcessingLock(matchId) {
    try {
      await ProcessingLock.deleteOne({ matchId });
    } catch (error) {
      console.error('Error removing processing lock:', error);
    }
  }

  // Clean up expired locks
  async cleanupExpiredLocks() {
    try {
      const result = await ProcessingLock.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      console.log({ result });
      if (result.deletedCount > 0) {
        console.log(
          `Cleaned up ${result.deletedCount} expired processing locks`
        );
      }
    } catch (error) {
      console.error('Error cleaning up expired locks:', error);
    }
  }

  // Modified checkSingleAnalysis method
  async checkSingleAnalysis(match) {
    const { analysisId, _id: matchId, creator } = match;

    // Check if already being processed
    if (await this.isProcessing(matchId)) {
      console.log(`Analysis ${matchId} already being processed, skipping...`);
      return;
    }

    // Add processing lock
    const lockAcquired = await this.addProcessingLock(matchId);
    console.log({ lockAcquired });
    if (!lockAcquired) {
      console.log(`Failed to acquire processing lock for ${matchId}`);
      return;
    }

    try {
      console.log(`Checking status for analysis: ${matchId}`);

      const status = await VideoAnalysisService.getAnalysisStatus(matchId);

      console.log({ status });

      let analysisStatus = await findOne(AnalysisStatus, { match_id: matchId });

      if (!analysisStatus) {
        await createOne(AnalysisStatus, status);
      } else {
        await updateOne(AnalysisStatus, { match_id: matchId }, status);
      }

      if (status.status === 'completed') {
        await this.handleCompletedAnalysis(match, status);
      } else if (status.status === 'failed') {
        await this.handleFailedAnalysis(match, status);
      } else {
        await this.updateMatchStatus(match, status.status);
      }
    } catch (error) {
      console.error(`Error checking analysis ${matchId}:`, error);
      await this.handleAnalysisError(match, error);
    } finally {
      await this.removeProcessingLock(matchId);
    }
  }

  // Modified checkPendingAnalyses to include cleanup
  async checkPendingAnalyses() {
    try {
      // First, clean up any expired locks
      await this.cleanupExpiredLocks();

      // Find all matches with pending analyses
      const pendingMatches = await Match.find({
        analysisStatus: {
          $in: ['pending', 'processing', 'in_progress', 'not_found'],
        },
      }).populate({ path: 'creator', select: 'fullName' });

      console.log({ pendingMatches });

      console.log(`Found ${pendingMatches.length} pending analyses to check`);

      // Process each pending analysis
      const promises = pendingMatches.map((match) =>
        this.checkSingleAnalysis(match)
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error fetching pending analyses:', error);
      throw error;
    }
  }

  // Handle completed analysis
  async handleCompletedAnalysis(match, status) {
    const { analysisId, _id: matchId, creator } = match;

    try {
      console.log(`Analysis ${matchId} completed, fetching results...`);

      // Get the analysis results
      const results = await VideoAnalysisService.getAnalysisResults(matchId);

      console.log({ results });

      // Update match with results and status
      await Match.findByIdAndUpdate(matchId, {
        analysisStatus: 'completed',
      });

      await processAnalysisResponse(results, creator);

      // Send success notification
      if (creator && creator._id) {
        await FirebaseService.sendNotification(
          creator._id,
          'Analysis Complete',
          'Your video analysis has completed successfully!',
          {
            matchId: matchId,
            analysisId: analysisId,
            type: 'analysis_completed',
            status: 'completed',
          }
        );
      }

      console.log(`Successfully processed completed analysis: ${analysisId}`);
    } catch (error) {
      console.error(`Error handling completed analysis ${analysisId}:`, error);
      await this.handleAnalysisError(match, error);
    }
  }

  // Handle failed analysis
  async handleFailedAnalysis(match, status) {
    const { analysisId, _id: matchId, creator } = match;

    try {
      console.log(`Analysis ${analysisId} failed:`, status.message);

      // Update match status
      await Match.findByIdAndUpdate(matchId, {
        analysisStatus: 'failed',
      });

      // Send failure notification
      if (creator && creator._id) {
        await FirebaseService.sendNotification(
          creator._id,
          'Analysis Failed',
          'Your video analysis has failed. Please try again.',
          {
            matchId: matchId,
            analysisId: analysisId,
            type: 'analysis_failed',
            status: 'failed',
            error: status.message,
          }
        );
      }

      console.log(`Successfully processed failed analysis: ${analysisId}`);
    } catch (error) {
      console.error(`Error handling failed analysis ${analysisId}:`, error);
    }
  }

  // Update match status for still processing analyses
  async updateMatchStatus(match, newStatus) {
    const { analysisId, _id: matchId } = match;

    try {
      await Match.findByIdAndUpdate(matchId, {
        analysisStatus: newStatus,
        updatedAt: new Date(),
      });

      console.log(`Updated match ${matchId} status to: ${newStatus}`);
    } catch (error) {
      console.error(`Error updating match ${matchId} status:`, error);
    }
  }

  // Handle analysis check errors
  async handleAnalysisError(match, error) {
    const { analysisId, _id: matchId } = match;

    try {
      // If it's a 404 error, the analysis might have been deleted
      if (error.message.includes('404')) {
        await Match.findByIdAndUpdate(matchId, {
          analysisStatus: 'not_found',
          updatedAt: new Date(),
        });
      } else {
        // For other errors, just log but don't update status
        console.error(
          `Temporary error checking analysis ${analysisId}:`,
          error.message
        );
      }
    } catch (updateError) {
      console.error(`Error updating match after analysis error:`, updateError);
    }
  }

  // Get current status including processing locks
  async getStatus() {
    try {
      const activeLocks = await ProcessingLock.find({
        expiresAt: { $gt: new Date() },
      });

      return {
        isRunning: this.isRunning,
        isScheduled: this.cronJob ? this.cronJob.scheduled : false,
        processingCount: activeLocks.length,
        processingAnalyses: activeLocks.map((lock) => ({
          matchId: lock.matchId,
          startedAt: lock.startedAt,
          expiresAt: lock.expiresAt,
        })),
      };
    } catch (error) {
      console.error('Error getting cron job status:', error);
      return {
        isRunning: this.isRunning,
        isScheduled: this.cronJob ? this.cronJob.scheduled : false,
        processingCount: 0,
        processingAnalyses: [],
      };
    }
  }
}
const analysisStatusCron = new AnalysisStatusCronJob();

export default analysisStatusCron;

// export const pendingMatches = catchAsync(async (req, res) => {
//    const pendingMatches = await Match.find({
//      analysisStatus: {
//        $in: ['pending', 'processing', 'in_progress', 'not_found  '],
//      },
//    }).populate({ path: 'creator', select: 'fullName' });
// });
