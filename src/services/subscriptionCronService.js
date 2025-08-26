import cron from 'node-cron';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import catchAsync from '../utils/catchAsync.js';

// You can import your notification service here
// import notificationService from './notificationService.js';

/**
 * Send expiry warning to users whose subscriptions are about to expire
 */
const sendExpiryWarnings = catchAsync(async () => {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  console.log('Checking for subscriptions expiring soon...');

  // Find subscriptions expiring in 3 days
  const expiringSoon = await Subscription.find({
    status: 'active',
    plan: { $ne: 'free' }, // Don't warn free users
    currentPeriodEnd: {
      $gte: now,
      $lte: threeDaysFromNow,
    },
  }).populate('user', 'email fullName');

  console.log(`Found ${expiringSoon.length} subscriptions expiring soon`);

  for (const subscription of expiringSoon) {
    try {
      // TODO: Send notification email/push
      console.log(`Sending expiry warning to user: ${subscription.user.email}`);

      // Example notification (implement based on your notification system):
      // await notificationService.sendEmail({
      //   to: subscription.user.email,
      //   subject: 'Your Padelize subscription expires soon',
      //   template: 'subscription-expiry-warning',
      //   data: {
      //     userName: subscription.user.fullName,
      //     plan: subscription.plan,
      //     expiryDate: subscription.currentPeriodEnd,
      //     renewalUrl: `${process.env.FRONTEND_URL}/subscription/renew`
      //   }
      // });
    } catch (error) {
      console.error(
        `Error sending expiry warning to ${subscription.user.email}:`,
        error
      );
    }
  }
});

/**
 * Handle expired subscriptions - downgrade to free plan
 */
const handleExpiredSubscriptions = catchAsync(async () => {
  const now = new Date();

  console.log('Checking for expired subscriptions...');

  // Find subscriptions that have expired
  const expired = await Subscription.find({
    status: { $in: ['active', 'past_due'] },
    plan: { $ne: 'free' }, // Don't process already free subscriptions
    currentPeriodEnd: { $lt: now },
    cancelAtPeriodEnd: { $ne: false }, // Only process if not set to cancel
  }).populate('user', 'email fullName');

  console.log(`Found ${expired.length} expired subscriptions to process`);

  for (const subscription of expired) {
    try {
      const user = subscription.user;
      const originalPlan = subscription.plan;

      // Update subscription to expired status
      subscription.status = 'expired';
      await subscription.save();

      // Create a new free subscription
      const freeSubscription = await Subscription.create({
        user: user._id,
        plan: 'free',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Update user to point to new free subscription
      user.subscription = freeSubscription._id;
      await user.save();

      // Record in subscription history
      await SubscriptionHistory.create({
        user: user._id,
        subscription: freeSubscription._id,
        changeType: 'downgraded',
        previousPlan: originalPlan,
        newPlan: 'free',
        effectiveDate: now,
        notes: 'Auto-downgraded to free plan after subscription expiry',
      });

      console.log(
        `Downgraded user ${user.email} from ${originalPlan} to free plan`
      );

      // TODO: Send notification about downgrade
      // await notificationService.sendEmail({
      //   to: user.email,
      //   subject: 'Your Padelize subscription has expired',
      //   template: 'subscription-expired',
      //   data: {
      //     userName: user.fullName,
      //     previousPlan: originalPlan,
      //     reactivateUrl: `${process.env.FRONTEND_URL}/subscription/upgrade`
      //   }
      // });
    } catch (error) {
      console.error(
        `Error processing expired subscription for ${subscription.user.email}:`,
        error
      );
    }
  }
});

/**
 * Check for subscriptions with failed payments that need attention
 */
const handleFailedPayments = catchAsync(async () => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  console.log('Checking for subscriptions with failed payments...');

  // Find subscriptions that have been past_due for more than 7 days
  const pastDue = await Subscription.find({
    status: 'past_due',
    updatedAt: { $lt: sevenDaysAgo },
  }).populate('user', 'email fullName');

  console.log(`Found ${pastDue.length} subscriptions past due for over 7 days`);

  for (const subscription of pastDue) {
    try {
      // Cancel the subscription after 7 days of failed payments
      subscription.status = 'canceled';
      await subscription.save();

      // Create free subscription
      const freeSubscription = await Subscription.create({
        user: subscription.user._id,
        plan: 'free',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      // Update user
      const user = await User.findById(subscription.user._id);
      user.subscription = freeSubscription._id;
      await user.save();

      // Record in history
      await SubscriptionHistory.create({
        user: subscription.user._id,
        subscription: freeSubscription._id,
        changeType: 'canceled',
        previousPlan: subscription.plan,
        newPlan: 'free',
        effectiveDate: now,
        notes:
          'Subscription canceled due to failed payments - downgraded to free',
      });

      console.log(
        `Canceled subscription for ${subscription.user.email} due to failed payments`
      );
    } catch (error) {
      console.error(
        `Error canceling subscription for ${subscription.user.email}:`,
        error
      );
    }
  }
});

/**
 * Initialize cron jobs for subscription management
 */
export const initializeSubscriptionCronJobs = () => {
  console.log('Initializing subscription cron jobs...');

  // Run daily at 2:00 AM - Check for expiring subscriptions (send warnings)
  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily subscription expiry check...');
    try {
      await sendExpiryWarnings();
    } catch (error) {
      console.error('Error in expiry warnings cron job:', error);
    }
  });

  // Run daily at 3:00 AM - Handle expired subscriptions
  cron.schedule('0 3 * * *', async () => {
    console.log('Running daily expired subscription cleanup...');
    try {
      await handleExpiredSubscriptions();
    } catch (error) {
      console.error('Error in expired subscriptions cron job:', error);
    }
  });

  // Run daily at 4:00 AM - Handle failed payments
  cron.schedule('0 4 * * *', async () => {
    console.log('Running daily failed payments cleanup...');
    try {
      await handleFailedPayments();
    } catch (error) {
      console.error('Error in failed payments cron job:', error);
    }
  });

  console.log('Subscription cron jobs initialized successfully');
};

// Manual functions for testing
export const manuallyCheckExpiring = sendExpiryWarnings;
export const manuallyProcessExpired = handleExpiredSubscriptions;
export const manuallyProcessFailedPayments = handleFailedPayments;

export default {
  initializeSubscriptionCronJobs,
  manuallyCheckExpiring,
  manuallyProcessExpired,
  manuallyProcessFailedPayments,
};
