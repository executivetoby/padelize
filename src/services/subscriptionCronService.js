import cron from 'node-cron';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import catchAsync from '../utils/catchAsync.js';
import FirebaseService from './firebaseService.js';
import notificationService from './notificationService.js';
import nodeMailer from '../config/nodemailer.js';

// Initialize services
const firebaseService = new FirebaseService();

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
      const user = subscription.user;
      const expiryDate = new Date(
        subscription.currentPeriodEnd
      ).toLocaleDateString();

      console.log(`Sending expiry warning to user: ${user.email}`);

      // 1. Send in-app notification
      await notificationService.createNotification({
        recipient: user._id,
        type: 'subscription_warning',
        title: 'Subscription Expiring Soon',
        message: `Your ${subscription.plan} subscription expires on ${expiryDate}. Renew now to keep your premium features.`,
        data: {
          plan: subscription.plan,
          expiryDate: subscription.currentPeriodEnd,
          subscriptionId: subscription._id,
        },
      });

      // 2. Send push notification
      await firebaseService.sendNotification(
        user._id,
        'Subscription Expiring Soon',
        `Your ${subscription.plan} subscription expires on ${expiryDate}. Renew now to avoid losing premium features.`,
        {
          type: 'subscription_warning',
          plan: subscription.plan,
          expiryDate: subscription.currentPeriodEnd.toISOString(),
          subscriptionId: subscription._id.toString(),
          action: 'renew_subscription',
        }
      );

      // 3. Send email notification
      const emailSubject = 'Your Padelize Subscription Expires Soon';
      const emailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Subscription Expiring Soon</h2>
          <p>Hi ${user.fullName},</p>
          <p>Your <strong>${subscription.plan}</strong> subscription will expire on <strong>${expiryDate}</strong>.</p>
          <p>To continue enjoying premium features like:</p>
          <ul>
            <li>Advanced shot analysis (volley & smash)</li>
            <li>Movement heatmaps</li>
            <li>Faster processing</li>
            <li>Priority support</li>
          </ul>
          <p>Please renew your subscription before it expires.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/subscription/renew"
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Renew Subscription
            </a>
          </div>
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br>The Padelize Team</p>
        </div>
      `;

      await nodeMailer(user.email, emailSubject, emailMessage);

      console.log(
        `Successfully sent expiry warning notifications to ${user.email}`
      );
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

      // Send notifications about downgrade
      // 1. In-app notification
      await notificationService.createNotification({
        recipient: user._id,
        type: 'subscription_expired',
        title: 'Subscription Expired',
        message: `Your ${originalPlan} subscription has expired and you've been downgraded to the free plan. Upgrade anytime to restore premium features.`,
        data: {
          previousPlan: originalPlan,
          currentPlan: 'free',
          subscriptionId: freeSubscription._id,
        },
      });

      // 2. Push notification
      await firebaseService.sendNotification(
        user._id,
        'Subscription Expired',
        `Your ${originalPlan} subscription has expired. You're now on the free plan. Upgrade anytime to restore premium features.`,
        {
          type: 'subscription_expired',
          previousPlan: originalPlan,
          currentPlan: 'free',
          subscriptionId: freeSubscription._id.toString(),
          action: 'upgrade_subscription',
        }
      );

      // 3. Email notification
      const emailSubject = 'Your Padelize Subscription Has Expired';
      const emailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Subscription Expired</h2>
          <p>Hi ${user.fullName},</p>
          <p>Your <strong>${originalPlan}</strong> subscription has expired and you have been automatically moved to our <strong>free plan</strong>.</p>
          <p><strong>What this means:</strong></p>
          <ul>
            <li>You can still analyze 1 match per week</li>
            <li>Basic shot analysis (forehand & backhand only)</li>
            <li>Standard processing speed</li>
            <li>No access to advanced features like volley/smash analysis or heatmaps</li>
          </ul>
          <p>Ready to get back to premium features?</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/subscription/upgrade"
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Upgrade Now
            </a>
          </div>
          <p>Thank you for being part of the Padelize community!</p>
          <p>Best regards,<br>The Padelize Team</p>
        </div>
      `;

      await nodeMailer(user.email, emailSubject, emailMessage);

      console.log(`Successfully sent expiry notifications to ${user.email}`);
    } catch (error) {
      console.error(
        `Error processing expired subscription for ${subscription.user.email}:`,
        error
      );
    }
  }
});

/**
 * Handle users with already expired subscriptions who don't have free subscriptions
 * This covers cases where subscriptions expired but weren't properly processed
 */
const handleAlreadyExpiredSubscriptions = catchAsync(async () => {
  const now = new Date();

  console.log(
    'Checking for already expired subscriptions without free alternatives...'
  );

  // Find users with expired subscriptions (status='expired') but no active free subscription
  const expiredWithoutFree = await Subscription.find({
    status: 'expired',
    plan: { $ne: 'free' },
  }).populate('user', 'email fullName subscription');

  // Filter to only include users who don't have an active free subscription
  const usersNeedingFreeSubscription = [];

  for (const expiredSub of expiredWithoutFree) {
    const user = expiredSub.user;

    // Check if user has an active free subscription
    const activeFreeSubscription = await Subscription.findOne({
      user: user._id,
      plan: 'free',
      status: 'active',
    });

    if (!activeFreeSubscription) {
      usersNeedingFreeSubscription.push({
        user,
        expiredSubscription: expiredSub,
      });
    }
  }

  console.log(
    `Found ${usersNeedingFreeSubscription.length} users with expired subscriptions needing free plan creation`
  );

  for (const { user, expiredSubscription } of usersNeedingFreeSubscription) {
    try {
      const originalPlan = expiredSubscription.plan;

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
        changeType: 'system_recovery',
        previousPlan: originalPlan,
        newPlan: 'free',
        effectiveDate: now,
        notes:
          'System recovery: Created free subscription for user with expired premium subscription',
      });

      console.log(
        `Created free subscription for user ${user.email} (previously had expired ${originalPlan} plan)`
      );

      // Send recovery notifications
      // 1. In-app notification
      await notificationService.createNotification({
        recipient: user._id,
        type: 'subscription_recovered',
        title: 'Account Restored to Free Plan',
        message: `Your account has been restored to the free plan. You can continue using Padelize with basic features and upgrade anytime.`,
        data: {
          previousPlan: originalPlan,
          currentPlan: 'free',
          subscriptionId: freeSubscription._id,
          recoveryType: 'system_recovery',
        },
      });

      // 2. Push notification
      await firebaseService.sendNotification(
        user._id,
        'Account Restored',
        `Your Padelize account has been restored to the free plan. You can continue using the app with basic features.`,
        {
          type: 'subscription_recovered',
          previousPlan: originalPlan,
          currentPlan: 'free',
          subscriptionId: freeSubscription._id.toString(),
          action: 'continue_using_app',
        }
      );

      // 3. Email notification
      const emailSubject = 'Your Padelize Account Has Been Restored';
      const emailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Account Restored</h2>
          <p>Hi ${user.fullName},</p>
          <p>We noticed your <strong>${originalPlan}</strong> subscription had expired, and we've automatically restored your account to our <strong>free plan</strong>.</p>
          <p><strong>What you can do now:</strong></p>
          <ul>
            <li>Analyze 1 match per week</li>
            <li>Basic shot analysis (forehand & backhand)</li>
            <li>View match statistics</li>
            <li>Access community features</li>
          </ul>
          <p><strong>Want more features?</strong></p>
          <ul>
            <li>Advanced shot analysis (volley & smash)</li>
            <li>Movement heatmaps</li>
            <li>3 matches per week</li>
            <li>Faster processing</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/subscription/upgrade"
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Upgrade to PRO
            </a>
          </div>
          <p>Welcome back to Padelize!</p>
          <p>Best regards,<br>The Padelize Team</p>
        </div>
      `;

      await nodeMailer(user.email, emailSubject, emailMessage);

      console.log(`Successfully sent recovery notifications to ${user.email}`);
    } catch (error) {
      console.error(
        `Error creating free subscription for ${user.email}:`,
        error
      );
    }
  }
});

/**
 * Send weekly subscription status updates and feature reminders
 */
const sendWeeklySubscriptionUpdates = catchAsync(async () => {
  console.log('Sending weekly subscription updates...');

  // Get all active non-free subscriptions
  const activeSubscriptions = await Subscription.find({
    status: 'active',
    plan: { $ne: 'free' },
  }).populate('user', 'email fullName');

  console.log(
    `Found ${activeSubscriptions.length} active premium subscriptions`
  );

  for (const subscription of activeSubscriptions) {
    try {
      const user = subscription.user;
      const daysUntilExpiry = Math.ceil(
        (new Date(subscription.currentPeriodEnd) - new Date()) /
          (1000 * 60 * 60 * 24)
      );

      // Send weekly update with usage stats and renewal reminder
      // 1. In-app notification
      await notificationService.createNotification({
        recipient: user._id,
        type: 'subscription_update',
        title: 'Weekly Subscription Update',
        message: `Your ${subscription.plan} subscription is active! ${daysUntilExpiry} days remaining. Make the most of your premium features.`,
        data: {
          plan: subscription.plan,
          daysUntilExpiry,
          subscriptionId: subscription._id,
        },
      });

      // 2. Push notification (only if subscription expires in next 7 days)
      if (daysUntilExpiry <= 7) {
        await firebaseService.sendNotification(
          user._id,
          'Subscription Reminder',
          `Your ${subscription.plan} subscription expires in ${daysUntilExpiry} days. Don't forget to renew!`,
          {
            type: 'subscription_reminder',
            plan: subscription.plan,
            daysUntilExpiry,
            subscriptionId: subscription._id.toString(),
            action: 'renew_subscription',
          }
        );
      }

      console.log(
        `Sent weekly update to ${user.email} (${subscription.plan}, ${daysUntilExpiry} days left)`
      );
    } catch (error) {
      console.error(
        `Error sending weekly update to ${subscription.user.email}:`,
        error
      );
    }
  }
});

/**
 * Send feature usage reminders to free users
 */
const sendFreeUserReminders = catchAsync(async () => {
  console.log('Sending feature reminders to free users...');

  // Get all free users who haven't used their weekly analysis
  const freeSubscriptions = await Subscription.find({
    status: 'active',
    plan: 'free',
  }).populate('user', 'email fullName');

  console.log(`Found ${freeSubscriptions.length} free users`);

  for (const subscription of freeSubscriptions) {
    try {
      const user = subscription.user;

      // Send upgrade reminder highlighting premium features
      // 1. In-app notification
      await notificationService.createNotification({
        recipient: user._id,
        type: 'feature_reminder',
        title: 'Unlock Premium Features',
        message:
          'Upgrade to PRO and get advanced shot analysis, movement heatmaps, faster processing, and more!',
        data: {
          currentPlan: 'free',
          upgradeUrl: `${process.env.FRONTEND_URL}/subscription/upgrade`,
        },
      });

      console.log(`Sent feature reminder to free user: ${user.email}`);
    } catch (error) {
      console.error(
        `Error sending feature reminder to ${subscription.user.email}:`,
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
      const userData = await User.findById(subscription.user._id);
      userData.subscription = freeSubscription._id;
      await userData.save();

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

      // Send notifications about cancellation due to failed payments
      const userInfo = subscription.user;

      // 1. In-app notification
      await notificationService.createNotification({
        recipient: userInfo._id,
        type: 'subscription_canceled',
        title: 'Subscription Canceled',
        message: `Your ${subscription.plan} subscription has been canceled due to failed payments. You're now on the free plan. Update your payment method and upgrade anytime.`,
        data: {
          previousPlan: subscription.plan,
          currentPlan: 'free',
          reason: 'failed_payments',
          subscriptionId: freeSubscription._id,
        },
      });

      // 2. Push notification
      await firebaseService.sendNotification(
        userInfo._id,
        'Subscription Canceled - Payment Failed',
        `Your ${subscription.plan} subscription was canceled due to payment issues. Update your payment method to restore premium features.`,
        {
          type: 'subscription_canceled',
          previousPlan: subscription.plan,
          currentPlan: 'free',
          reason: 'failed_payments',
          subscriptionId: freeSubscription._id.toString(),
          action: 'update_payment_method',
        }
      );

      // 3. Email notification
      const emailSubject = 'Subscription Canceled - Payment Failed';
      const emailMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Subscription Canceled</h2>
          <p>Hi ${userInfo.fullName},</p>
          <p>We've been unable to process payment for your <strong>${subscription.plan}</strong> subscription for the past 7 days.</p>
          <p>As a result, your subscription has been canceled and you have been moved to our <strong>free plan</strong>.</p>
          <p><strong>What happened:</strong></p>
          <ul>
            <li>Multiple payment attempts failed</li>
            <li>Your subscription has been automatically canceled</li>
            <li>You now have access to free plan features only</li>
          </ul>
          <p><strong>What you can do:</strong></p>
          <ol>
            <li>Update your payment method</li>
            <li>Choose a new subscription plan</li>
            <li>Restore your premium features instantly</li>
          </ol>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/subscription/upgrade"
               style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Update Payment & Resubscribe
            </a>
          </div>
          <p>If you have any questions about billing, please contact our support team.</p>
          <p>Best regards,<br>The Padelize Team</p>
        </div>
      `;

      await nodeMailer(userInfo.email, emailSubject, emailMessage);

      console.log(
        `Successfully sent cancellation notifications to ${userInfo.email}`
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

  // Run daily at 3:30 AM - Handle already expired subscriptions (recovery)
  cron.schedule('30 3 * * *', async () => {
    console.log('Running daily expired subscription recovery...');
    try {
      await handleAlreadyExpiredSubscriptions();
    } catch (error) {
      console.error('Error in expired subscription recovery cron job:', error);
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

  // Run weekly on Mondays at 9:00 AM - Send weekly subscription updates
  cron.schedule('0 9 * * 1', async () => {
    console.log('Running weekly subscription updates...');
    try {
      await sendWeeklySubscriptionUpdates();
    } catch (error) {
      console.error('Error in weekly subscription updates cron job:', error);
    }
  });

  // Run weekly on Fridays at 10:00 AM - Send feature reminders to free users
  cron.schedule('0 10 * * 5', async () => {
    console.log('Running weekly free user feature reminders...');
    try {
      await sendFreeUserReminders();
    } catch (error) {
      console.error('Error in free user reminders cron job:', error);
    }
  });

  console.log('Subscription cron jobs initialized successfully');
  console.log('- Daily at 2:00 AM: Expiry warnings');
  console.log('- Daily at 3:00 AM: Handle expired subscriptions');
  console.log(
    '- Daily at 3:30 AM: Handle already expired subscriptions (recovery)'
  );
  console.log('- Daily at 4:00 AM: Handle failed payments');
  console.log('- Weekly Mondays at 9:00 AM: Subscription updates');
  console.log('- Weekly Fridays at 10:00 AM: Free user feature reminders');
};

// Manual functions for testing
export const manuallyCheckExpiring = sendExpiryWarnings;
export const manuallyProcessExpired = handleExpiredSubscriptions;
export const manuallyRecoverExpiredSubscriptions =
  handleAlreadyExpiredSubscriptions;
export const manuallyProcessFailedPayments = handleFailedPayments;
export const manuallySendWeeklyUpdates = sendWeeklySubscriptionUpdates;
export const manuallySendFreeUserReminders = sendFreeUserReminders;

export default {
  initializeSubscriptionCronJobs,
  manuallyCheckExpiring,
  manuallyProcessExpired,
  manuallyRecoverExpiredSubscriptions,
  manuallyProcessFailedPayments,
  manuallySendWeeklyUpdates,
  manuallySendFreeUserReminders,
};
