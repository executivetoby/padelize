import cron from 'node-cron';
import User from '../models/User.js';
import { resetWeeklyStats } from '../services/resumeActivityService.js';

console.log('Weekly stats reset script started.');

// Runs every Sunday at midnight
cron.schedule('0 0 * * 0', async () => {
  try {
    // Reset the weekly stats for all users and resumes
    const users = await User.find({});
    for (const user of users) {
      await resetWeeklyStats(user._id);
    }
    console.log('Weekly stats reset successfully.');
  } catch (error) {
    console.error('Error resetting weekly stats:', error);
  }
});
