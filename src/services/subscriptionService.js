import Stripe from 'stripe';
import config from '../config/config.js';
import { Types } from 'mongoose';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';

import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import Payment from '../models/Payment.js';
import { findOne, getAll } from '../factory/repo.js';
import Package from '../models/Package.js';
import WebhookLogService from './webhookLogService.js';

const stripe = new Stripe(config.stripe.secretKey);

export const createFreeSubscriptionService = catchAsync(
  async (req, res, next) => {
    const { id: userId } = req.user;

    // Check if user already has a subscription
    let subscription = await Subscription.findOne({ user: userId });

    if (subscription) {
      return res.status(200).json({
        status: 'success',
        message: 'User already has a subscription',
        data: {
          subscription,
        },
      });
    }

    // Create a new free subscription
    subscription = await Subscription.create({
      user: userId,
      plan: 'free',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    });

    await User.findByIdAndUpdate(userId, { subscription: subscription._id });

    await SubscriptionHistory.create({
      user: userId,
      subscription: subscription._id,
      changeType: 'created',
      previousPlan: null,
      newPlan: 'free',
      effectiveDate: new Date(),
      notes: 'Free subscription created',
    });

    await Payment.create({
      user: userId,
      subscription: subscription._id,
      amount: 0,
      status: 'paid',
      paymentMethod: 'free',
      paymentDate: new Date(),
    });

    res.status(201).json({
      status: 'success',
      message: 'Free subscription created successfully',
      data: {
        subscription,
      },
    });
  }
);

export const createCustomer = async (user) => {
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName,
    phone: user.phone,
    metadata: {
      userId: user._id.toString(),
    },
  });

  return customer;
};

export const createSubscription = async (customerId, priceId) => {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
};

export const cancelSubscriptionFunction = async (subscriptionId) => {
  return await stripe.subscriptions.cancel(subscriptionId);
};

export const updateSubscription = async (subscriptionId, params) => {
  return await stripe.subscriptions.update(subscriptionId, params);
};

export const retrieveSubscription = async (subscriptionId) => {
  return await stripe.subscriptions.retrieve(subscriptionId);
};

export const createCheckoutSessionService = catchAsync(
  async (req, res, next) => {
    const { plan } = req.body;
    const { id: userId } = req.user;

    console.log(`Creating checkout session for plan: ${plan}, user: ${userId}`);

    if (!['pro_monthly', 'pro_yearly'].includes(plan))
      return next(new AppError('Invalid plan selected', 400));

    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if user already has a subscription
    let subscription = await Subscription.findOne({ user: userId });

    // If user doesn't have a Stripe customer ID, create one
    let stripeCustomerId;
    if (subscription && subscription.stripeCustomerId) {
      stripeCustomerId = subscription.stripeCustomerId;
      console.log(`Using existing Stripe customer: ${stripeCustomerId}`);
    } else {
      const customer = await createCustomer(user);
      stripeCustomerId = customer.id;
      console.log(`Created new Stripe customer: ${stripeCustomerId}`);
      // await user.save();
    }

    // Determine price ID based on selected plan
    const priceId = config.stripe.prices[plan];
    console.log(`Price ID for plan ${plan}: ${priceId}`);

    if (!priceId) {
      return next(new AppError(`Price ID not found for plan: ${plan}`, 400));
    }

    // Construct URLs
    const protocol = req.protocol;
    const host = req.get('host');
    const successUrl = `${protocol}://${host}/api/v1/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${protocol}://${host}/api/v1/subscriptions/cancel`;

    console.log(`Success URL: ${successUrl}`);
    console.log(`Cancel URL: ${cancelUrl}`);

    try {
      // Create a checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId.toString(),
          plan,
        },
        subscription_data: {
          metadata: {
            userId: userId.toString(),
            plan,
          },
        },
      });

      console.log(`Checkout session created successfully: ${session.id}`);

      res.status(200).json({
        status: 'success',
        message: 'Checkout session created successfully',
        data: {
          session,
        },
      });
    } catch (stripeError) {
      console.error('Stripe checkout session creation error:', stripeError);
      return next(
        new AppError(
          `Failed to create checkout session: ${stripeError.message}`,
          500
        )
      );
    }
  }
);

/**
 * Returns the expiry date for a given plan.
 * If the plan is yearly, the expiry date is 1 year from now.
 * If the plan is monthly, the expiry date is 1 month from now.
 * @param {string} plan - The plan name.
 * @returns {Date} The expiry date.
 */
const getExpiryTerm = (plan) => {
  return plan.includes('yearly')
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
};

export const handleSubscriptionSuccessService = catchAsync(
  async (req, res, next) => {
    const { sessionId } = req.body;
    if (!sessionId) return next(new AppError('Session ID not provided', 400));

    // Just verify the session exists and return success
    // The actual subscription processing happens via webhook
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Return user-friendly response
    res.status(200).json({
      status: 'success',
      message: 'Subscription process initiated successfully',
      data: {
        sessionId: session.id,
      },
    });
  }
);

export const stripeWebhook = catchAsync(async (req, res, next) => {
  const signature = req.headers['stripe-signature'];
  let event;
  let webhookLog;
  let signatureVerified = false;

  // First, log the incoming webhook request
  try {
    webhookLog = await WebhookLogService.logIncomingWebhook(req, null, false);
  } catch (logError) {
    console.error('Failed to log incoming webhook:', logError.message);
    // Continue processing even if logging fails
  }

  // Try to verify the webhook signature
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      config.stripe.webhookSecret
    );
    signatureVerified = true;

    // Update log with parsed event data
    if (webhookLog) {
      await WebhookLogService.updateWebhookStatus(
        webhookLog._id,
        'processing',
        {
          metadata: { signatureVerified: true },
        }
      );

      // Update with parsed event details
      webhookLog.stripeEventId = event.id;
      webhookLog.eventType = event.type;
      webhookLog.data = event.data;
      webhookLog.signatureVerified = true;
      await webhookLog.save();
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);

    // Update log with error
    if (webhookLog) {
      await WebhookLogService.markWebhookFailed(
        webhookLog._id,
        `Signature verification failed: ${err.message}`,
        err.stack,
        400
      );
    }

    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received webhook event: ${event.type}, ID: ${event.id}`);

  try {
    const startTime = Date.now();

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        console.log('Created/Updated:', event.data.object);
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        console.log('Payment Succeeded:', event.data.object);
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        console.log('Payment failed:', event.data.object);
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
        // Update log for unhandled events
        if (webhookLog) {
          await WebhookLogService.updateWebhookStatus(
            webhookLog._id,
            'ignored',
            {
              responseStatus: 200,
              responseBody: { received: true, note: 'Unhandled event type' },
              metadata: { reason: 'Unhandled event type' },
            }
          );
        }
        break;
    }

    const processingTime = Date.now() - startTime;

    // Mark as completed
    if (webhookLog) {
      await WebhookLogService.markWebhookCompleted(
        webhookLog._id,
        200,
        { received: true },
        processingTime
      );
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing Stripe webhook event:', err);

    // Mark as failed
    if (webhookLog) {
      await WebhookLogService.markWebhookFailed(
        webhookLog._id,
        `Webhook processing failed: ${err.message}`,
        err.stack,
        500
      );
    }

    res.status(500).send('Webhook handler failed');
  }
});

const handleCheckoutSessionCompleted = async (session) => {
  // Only process subscription checkouts
  if (session.mode !== 'subscription') return;

  try {
    // Fetch complete session data if necessary
    const expandedSession = await stripe.checkout.sessions.retrieve(
      session.id,
      {
        expand: ['subscription', 'customer'],
      }
    );

    console.log({ expandedSession });

    // Get user ID from session metadata
    const userId = expandedSession.metadata?.userId;
    const plan = expandedSession.metadata?.plan;

    if (!userId || !plan) {
      console.error(
        'Missing metadata in checkout session:',
        expandedSession.id
      );
      return;
    }

    const expiry = getExpiryTerm(plan);

    // Create or update subscription record
    let subscription = await Subscription.findOne({
      user: new Types.ObjectId(userId),
    });

    const originalPlan = subscription && subscription.plan;

    if (!subscription) {
      subscription = new Subscription({
        user: userId,
        plan,
        stripeCustomerId: expandedSession.customer.id,
        stripeSubscriptionId: expandedSession.subscription.id,
        status: 'active',
        currentPeriodStart: new Date(
          expandedSession.subscription.created * 1000
        ),
        currentPeriodEnd: expiry,
      });
    } else {
      // Update existing subscription
      subscription.plan = plan;
      subscription.stripeSubscriptionId = expandedSession.subscription.id;
      subscription.status = 'active';
      subscription.currentPeriodStart = new Date(
        expandedSession.subscription.created * 1000
      );
      subscription.currentPeriodEnd = expiry;
    }

    await subscription.save();

    const getTier = (planName) => {
      if (planName === 'free') return 0;
      if (planName.includes('pro')) return 1;
      if (planName.includes('max')) return 2;
      return -1; // Unknown plan
    };

    const prevTier = getTier(originalPlan);
    const currentTier = getTier(plan);

    // Classify the change
    const changeType =
      prevTier < currentTier
        ? 'upgraded'
        : prevTier > currentTier
        ? 'downgraded'
        : originalPlan !== plan
        ? 'billing changed'
        : 'maintained';

    console.log({ prevTier, currentTier, changeType });

    // Record subscription history only if this is truly a new subscription
    // or if no recent history exists (to prevent duplicates from multiple webhook events)
    const existingHistory = await SubscriptionHistory.findOne({
      subscription: subscription._id,
      createdAt: { $gte: new Date(Date.now() - 60000) }, // Within last minute
    });

    if (!existingHistory) {
      await SubscriptionHistory.create({
        user: userId,
        subscription: subscription._id,
        changeType: subscription.isNew ? 'created' : 'upgraded',
        previousPlan: subscription.isNew ? 'free' : originalPlan,
        newPlan: plan,
        effectiveDate: new Date(),
        notes: subscription.isNew
          ? `Subscription created for ${plan} plan`
          : `Subscription ${changeType} from ${originalPlan} to ${plan} plan`,
      });
    } else {
      console.log(
        `Skipping duplicate history creation for subscription ${subscription._id}`
      );
    }

    // Update user with subscription reference
    await User.findByIdAndUpdate(userId, { subscription: subscription._id });

    console.log(
      `Subscription ${
        subscription.isNew ? 'created' : changeType
      } from checkout session:`,
      session.id
    );
  } catch (error) {
    console.error('Error processing checkout.session.completed:', error);
  }
};

const handleSubscriptionUpdated = async (subscription) => {
  try {
    const stripeSubscriptionId = subscription.id;
    const customerId = subscription.customer;

    console.log(`Processing subscription update for: ${stripeSubscriptionId}`);

    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const currentPeriodEnd = new Date(
      subscription.items.data[0].current_period_end * 1000
    );
    const currentPeriodStart = new Date(
      subscription.items.data[0].current_period_start * 1000
    );

    console.log({ cancelAtPeriodEnd, currentPeriodEnd, currentPeriodStart });

    // Define price to plan mapping once
    const priceToPlans = {
      [config.stripe.prices.pro_monthly]: 'pro_monthly',
      [config.stripe.prices.max_monthly]: 'max_monthly',
      [config.stripe.prices.pro_yearly]: 'pro_yearly',
      [config.stripe.prices.max_yearly]: 'max_yearly',
    };

    // Get current plan from subscription
    const price = subscription.items.data[0].price;
    const priceId = price.id;
    const currentPlan = priceToPlans[priceId];

    if (!currentPlan) {
      console.error(`Unknown price ID: ${priceId}`);
      throw new Error(`Unknown price ID: ${priceId}`);
    }

    // Find subscription by Stripe subscription ID
    let dbSubscription = await Subscription.findOne({ stripeSubscriptionId });

    if (!dbSubscription) {
      // If subscription doesn't exist in our DB but Stripe says it exists,
      // we need to create it (this might happen if success route was bypassed)

      console.log('If!!!!!!!!!!!!!!!!!!');
      // First, get the customer to find the associated user
      const customer = await stripe.customers.retrieve(customerId);
      let userId = customer.metadata?.userId; // We stored this when creating the customer

      // If userId is not in metadata, try to find user by stripeCustomerId
      if (!userId) {
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (user) {
          userId = user._id;
          console.log(`Found user ${userId} by stripeCustomerId lookup`);
        } else {
          console.error(
            'Cannot create subscription: No userId in customer metadata or matching customer ID',
            customerId
          );
          throw new Error(`Cannot find user for customer: ${customerId}`);
        }
      }

      // Get the expiry term based on plan
      const expiry = getExpiryTerm(currentPlan);

      // Create new subscription in database
      dbSubscription = new Subscription({
        user: userId,
        plan: currentPlan,
        stripeCustomerId: customerId,
        stripeSubscriptionId,
        status: subscription.status,
        currentPeriodStart: new Date(
          subscription.items.data[0].current_period_start * 1000
        ),
        currentPeriodEnd:
          expiry ||
          new Date(subscription.items.data[0].current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        created: new Date(),
      });

      await dbSubscription.save();

      // Create subscription history record only if no recent history exists
      const existingHistory = await SubscriptionHistory.findOne({
        user: userId,
        createdAt: { $gte: new Date(Date.now() - 60000) }, // Within last minute
      });

      if (!existingHistory) {
        await SubscriptionHistory.create({
          user: userId,
          subscription: dbSubscription._id,
          changeType: 'created',
          previousPlan: 'free',
          newPlan: currentPlan,
          effectiveDate: new Date(),
          notes: `Subscription created from webhook event`,
        });
      } else {
        console.log(`Skipping duplicate history creation for user ${userId}`);
      }

      // Update user with subscription reference
      await User.findByIdAndUpdate(userId, {
        subscription: dbSubscription._id,
      });

      console.log(
        `Created new subscription ${dbSubscription._id} for user ${userId} via webhook`
      );
      return dbSubscription; // Prevent duplicate history creation
    } else {
      // Update existing subscription
      const oldPlan = dbSubscription.plan;
      const oldStatus = dbSubscription.status;
      const planChanged = currentPlan !== oldPlan;
      const statusChanged = subscription.status !== oldStatus;

      // Update subscription fields
      dbSubscription.status = subscription.status;
      dbSubscription.plan = currentPlan;
      dbSubscription.currentPeriodStart = new Date(
        subscription.items.data[0].current_period_start * 1000
      );
      dbSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
      dbSubscription.updatedAt = new Date();

      // Update expiry date (always recalculate to ensure consistency)
      const expiry = getExpiryTerm(currentPlan);
      dbSubscription.currentPeriodEnd =
        expiry ||
        new Date(subscription.items.data[0].current_period_end * 1000);

      await dbSubscription.save();

      // Record history if plan or status changed
      if (planChanged || statusChanged) {
        let changeType, notes;

        if (planChanged && statusChanged) {
          changeType = 'plan_and_status_changed';
          notes = `Plan changed from ${oldPlan} to ${currentPlan} and status changed from ${oldStatus} to ${subscription.status}`;
        } else if (planChanged) {
          changeType = 'plan_changed';
          notes = `Plan changed from ${oldPlan} to ${currentPlan}`;
        } else {
          changeType = 'status_changed';
          notes = `Status changed from ${oldStatus} to ${subscription.status}`;
        }

        await SubscriptionHistory.create({
          user: dbSubscription.user,
          subscription: dbSubscription._id,
          changeType,
          previousPlan: oldPlan,
          newPlan: currentPlan,
          effectiveDate: new Date(),
          notes,
        });

        console.log(
          `Updated subscription ${dbSubscription._id}: ${changeType}`
        );
      } else {
        console.log(
          `Updated subscription ${dbSubscription._id}: period dates refreshed`
        );
      }
    }

    // Return the subscription for potential use in other handlers
    return dbSubscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    // Re-throw the error so calling code can handle it appropriately
    // In a webhook context, you might want to return a 500 status
    throw error;
  }
};

const handleSubscriptionDeleted = async (subscription) => {
  try {
    const stripeSubscriptionId = subscription.id;

    // Find the subscription in our database
    let dbSubscription = await Subscription.findOne({
      stripeSubscriptionId,
    });

    // If subscription doesn't exist (rare edge case), log and return
    if (!dbSubscription) {
      console.error(
        `Subscription not found for deletion: ${stripeSubscriptionId}`
      );

      // You might want to search by customer ID as a fallback
      const stripeCustomerId = subscription.customer;
      const user = await User.findOne({ stripeCustomerId });

      if (!user) {
        console.error(`No user found for customer: ${stripeCustomerId}`);
        return;
      }

      console.log(`Found user without subscription record: ${user.email}`);
      return;
    }

    // Update subscription status
    dbSubscription.status = 'canceled';
    dbSubscription.canceledAt = new Date();
    await dbSubscription.save();

    // Create subscription history record
    await SubscriptionHistory.create({
      user: dbSubscription.user,
      subscription: dbSubscription._id,
      changeType: 'canceled',
      previousPlan: dbSubscription.plan,
      newPlan: 'free',
      effectiveDate: new Date(),
      notes: `Subscription canceled`,
    });

    // Optional: Update user record if needed
    // For example, you might want to reset certain fields when subscription is canceled
    // await User.findByIdAndUpdate(dbSubscription.user, { subscriptionStatus: 'free' });

    console.log(`Subscription canceled: ${dbSubscription._id}`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
};

const handlePaymentSucceeded = async (invoice) => {
  try {
    console.log(
      'Card:',
      invoice.payment_settings?.payment_method_options?.card
    );
    // Get the subscription details
    const stripeSubscriptionId =
      invoice.parent.subscription_details.subscription;
    if (!stripeSubscriptionId) {
      console.log('No subscription associated with this invoice');
      return;
    }

    // Expand subscription to get customer info
    const stripeSubscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      {
        expand: ['customer'],
      }
    );

    console.log({ stripeSubscription });

    // Find the subscription in our database
    let subscription = await Subscription.findOne({ stripeSubscriptionId });

    // If subscription doesn't exist yet (race condition), we need to find the customer first
    if (!subscription) {
      // Find user by stripeCustomerId
      const user = await User.findOne({
        stripeCustomerId: stripeSubscription.customer.id,
      });

      if (!user) {
        console.error(
          `No user found for customer: ${stripeSubscription.customer.id}`
        );
        return;
      }

      // Check if there's metadata about the plan in the subscription or customer
      // This will depend on how you've set up your Stripe integration
      const plan = stripeSubscription.metadata?.plan || 'standard'; // Default or fetch from your logic
      const expiry = getExpiryTerm(plan);

      // Create a new subscription
      subscription = new Subscription({
        user: user._id,
        plan,
        stripeCustomerId: stripeSubscription.customer.id,
        stripeSubscriptionId,
        status: 'active',
        currentPeriodStart: new Date(stripeSubscription.created * 1000),
        currentPeriodEnd: expiry,
      });

      await subscription.save();

      // Record in history
      await SubscriptionHistory.create({
        user: user._id,
        subscription: subscription._id,
        changeType: 'created',
        previousPlan: 'free',
        newPlan: plan,
        effectiveDate: new Date(),
        notes: `Subscription created for ${plan} plan from invoice payment`,
      });

      // Update user with subscription reference
      await User.findByIdAndUpdate(user._id, {
        subscription: subscription._id,
      });

      console.log(
        `Created new subscription from invoice payment: ${subscription._id}`
      );
    } else {
      // Update existing subscription
      subscription.status = 'active';
      subscription.currentPeriodStart = new Date(
        stripeSubscription.created * 1000
      );
      subscription.currentPeriodEnd = getExpiryTerm(subscription.plan);
      await subscription.save();

      console.log(
        `Updated existing subscription from invoice payment: ${subscription._id}`
      );
    }

    let payment = await Payment.findOne({ stripeInvoiceId: invoice.id });

    if (payment) {
      console.log('Payment already exists:', invoice.id);
      return;
    }

    payment = new Payment({
      user: subscription.user,
      subscription: subscription._id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent,
      amount: invoice.total / 100,
      currency: invoice.currency,
      status: invoice.status,
      description: `Payment for ${subscription.plan} plan`,
      billingPeriodStart: new Date(invoice.created * 1000),
      billingPeriodEnd: getExpiryTerm(subscription.plan),
      receiptUrl: invoice.hosted_invoice_url,
    });

    await payment.save();

    // Additional payment success handling as needed
    // e.g., send receipt email, update usage rights, etc.
  } catch (error) {
    console.error('Error in handlePaymentSucceeded:', error);
  }
};

const handlePaymentFailed = async (invoice) => {
  try {
    const stripeSubscriptionId = invoice.subscription;

    if (!stripeSubscriptionId) {
      console.log('No subscription associated with this failed invoice');
      return;
    }

    // Find subscription in our database
    let subscription = await Subscription.findOne({
      stripeSubscriptionId,
    });

    // If subscription doesn't exist yet (race condition), we need to create it
    if (!subscription) {
      // Get the subscription details from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        {
          expand: ['customer'],
        }
      );

      // Find user by stripeCustomerId
      const user = await User.findOne({
        stripeCustomerId: stripeSubscription.customer.id,
      });

      if (!user) {
        console.error(
          `No user found for customer: ${stripeSubscription.customer.id}`
        );
        return;
      }

      // Determine plan type from subscription or metadata
      const plan = stripeSubscription.metadata?.plan || 'standard'; // Use default or determine from your logic

      // Create a new subscription with past_due status
      subscription = new Subscription({
        user: user._id,
        plan,
        stripeCustomerId: stripeSubscription.customer.id,
        stripeSubscriptionId,
        status: 'past_due', // Set to past_due immediately since payment failed
        currentPeriodStart: new Date(stripeSubscription.created * 1000),
        currentPeriodEnd: expiry,
      });

      await subscription.save();

      // Update user with subscription reference
      await User.findByIdAndUpdate(user._id, {
        subscription: subscription._id,
      });

      console.log(
        `Created new subscription (past_due) from failed invoice: ${subscription._id}`
      );
    } else {
      // Update existing subscription status
      subscription.status = 'past_due';
      await subscription.save();
    }

    // Create payment record with failed status
    await Payment.create({
      user: subscription.user,
      subscription: subscription._id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent,
      amount: invoice.amount_due / 100, // Convert from cents
      currency: invoice.currency,
      status: 'failed',
      description: `Failed payment for ${subscription.plan} plan`,
      billingPeriodStart: new Date(invoice.period_start * 1000),
      billingPeriodEnd: new Date(invoice.period_end * 1000),
    });

    // Create subscription history record
    await SubscriptionHistory.create({
      user: subscription.user,
      subscription: subscription._id,
      changeType: 'payment_failed',
      previousPlan: subscription.plan,
      newPlan: subscription.plan,
      effectiveDate: new Date(),
      notes: `Payment failed for subscription`,
    });

    // Optional: Send notification to user about payment failure
    // await sendPaymentFailureNotification(subscription.user);
  } catch (error) {
    console.error('Error handling payment failure:', error);
    // createLogger.error('Error handling payment failure:', error);
  }
};

export const cancelSubscriptionService = catchAsync(async (req, res, next) => {
  const { id: userId } = req.user;

  // Find subscription for user
  const subscription = await Subscription.findOne({ user: userId });

  console.log({ userId, subscription });

  if (!subscription) return next(new AppError('No subscription found', 404));

  // Check if subscription is already canceled
  if (subscription.status === 'canceled') {
    return res.status(200).json({
      status: 'success',
      message: 'Subscription is already canceled',
    });
  }

  // Check if subscription is free plan (no Stripe subscription to cancel)
  if (subscription.plan === 'free' || !subscription.stripeSubscriptionId) {
    subscription.status = 'canceled';
    await subscription.save();

    await SubscriptionHistory.create({
      user: userId,
      subscription: subscription._id,
      changeType: 'canceled',
      previousPlan: subscription.plan,
      newPlan: 'free',
      effectiveDate: new Date(),
      notes: 'Free subscription canceled',
    });

    return res.status(200).json({
      status: 'success',
      message: 'Subscription canceled successfully',
    });
  }

  try {
    // Get current subscription status from Stripe first
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Check if Stripe subscription is already canceled
    if (stripeSubscription.status === 'canceled') {
      // Update our database to match Stripe
      subscription.status = 'canceled';
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      await SubscriptionHistory.create({
        user: userId,
        subscription: subscription._id,
        changeType: 'canceled',
        previousPlan: subscription.plan,
        newPlan: 'free',
        effectiveDate: new Date(),
        notes: 'Subscription was already canceled in Stripe',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Subscription was already canceled',
      });
    }

    // If subscription is active, schedule cancellation at period end
    if (stripeSubscription.status === 'active') {
      await updateSubscription(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update subscription in database
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      await SubscriptionHistory.create({
        user: userId,
        subscription: subscription._id,
        changeType: 'canceled',
        previousPlan: subscription.plan,
        newPlan: subscription.plan,
        effectiveDate: new Date(),
        notes: `Subscription scheduled for cancellation at period end: ${subscription.currentPeriodEnd.toLocaleDateString()}`,
      });

      return res.status(200).json({
        status: 'success',
        message:
          'Subscription will be canceled at the end of the billing period',
        data: {
          cancelAtPeriodEnd: subscription.currentPeriodEnd,
        },
      });
    } else {
      // For other statuses (past_due, incomplete, etc.), cancel immediately
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

      subscription.status = 'canceled';
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      await SubscriptionHistory.create({
        user: userId,
        subscription: subscription._id,
        changeType: 'canceled',
        previousPlan: subscription.plan,
        newPlan: 'free',
        effectiveDate: new Date(),
        notes: 'Subscription canceled immediately due to non-active status',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Subscription canceled successfully',
      });
    }
  } catch (stripeError) {
    console.error('Stripe error during cancellation:', stripeError);

    // If Stripe returns an error about subscription already being canceled
    if (stripeError.message?.includes('canceled subscription')) {
      subscription.status = 'canceled';
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      return res.status(200).json({
        status: 'success',
        message: 'Subscription was already canceled',
      });
    }

    return next(
      new AppError(`Failed to cancel subscription: ${stripeError.message}`, 500)
    );
  }
});

export const cancelSubscriptionImmediatelyService = catchAsync(
  async (req, res, next) => {
    const { id: userId } = req.user;

    // Find subscription for user
    const subscription = await Subscription.findOne({ user: userId });

    if (!subscription) return next(new AppError('No subscription found', 404));

    // Check if subscription is already canceled
    if (subscription.status === 'canceled') {
      return res.status(200).json({
        status: 'success',
        message: 'Subscription is already canceled',
      });
    }

    // Check if subscription is free plan (no Stripe subscription to cancel)
    if (subscription.plan === 'free' || !subscription.stripeSubscriptionId) {
      subscription.status = 'canceled';
      await subscription.save();

      return res.status(200).json({
        status: 'success',
        message: 'Free subscription canceled successfully',
      });
    }

    try {
      // Cancel immediately in Stripe
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

      // Update subscription in database
      subscription.status = 'canceled';
      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      // Create a new free subscription
      const freeSubscription = await Subscription.create({
        user: userId,
        plan: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Update user to point to new free subscription
      await User.findByIdAndUpdate(userId, {
        subscription: freeSubscription._id,
      });

      await SubscriptionHistory.create({
        user: userId,
        subscription: freeSubscription._id,
        changeType: 'canceled',
        previousPlan: subscription.plan,
        newPlan: 'free',
        effectiveDate: new Date(),
        notes: 'Subscription canceled immediately and downgraded to free',
      });

      res.status(200).json({
        status: 'success',
        message:
          'Subscription canceled immediately. You have been downgraded to the free plan.',
        data: {
          newSubscription: freeSubscription,
        },
      });
    } catch (stripeError) {
      console.error('Stripe error during immediate cancellation:', stripeError);

      if (stripeError.message?.includes('canceled subscription')) {
        subscription.status = 'canceled';
        await subscription.save();

        return res.status(200).json({
          status: 'success',
          message: 'Subscription was already canceled',
        });
      }

      return next(
        new AppError(
          `Failed to cancel subscription: ${stripeError.message}`,
          500
        )
      );
    }
  }
);

export const getCurrentSubscriptionService = catchAsync(
  async (req, res, next) => {
    const { id: userId } = req.user;

    const subscription = await Subscription.findOne({ user: userId }).populate(
      'user',
      'fullName email'
    );

    if (!subscription)
      return next(new AppError('No subscription found for this user', 404));

    res.status(200).json({
      status: 'success',
      data: {
        subscription,
      },
    });
  }
);

export const changePlanService = catchAsync(async (req, res, next) => {
  const { plan } = req.body;
  const userId = req.user._id;

  if (!['pro', 'max'].includes(plan))
    return next(new AppError('Invalid plan selected', 400));

  // Find user's subscription
  const subscription = await Subscription.findOne({ user: userId });

  const prevPlan = subscription?.plan;

  if (!subscription) return next(new AppError('No subscription found', 404));

  if (!subscription.stripeSubscriptionId)
    return next(new AppError('No active subscription to update', 404));

  // Update subscription with Stripe
  const priceId = config.stripe.prices[plan];

  await updateSubscription(subscription.stripeSubscriptionId, {
    items: [
      {
        id: subscription.stripeSubscriptionId,
        price: priceId,
      },
    ],
    proration_behavior: 'create_prorations',
  });

  // Update subscription in database
  subscription.plan = plan;
  await subscription.save();

  // const isUpgrade =
  //   (prevPlan === 'free' && plan.includes('pro')) ||
  //   (prevPlan === 'free' && plan.includes('max')) ||
  //   (prevPlan.includes('pro') && plan.includes('max'));

  const getTier = (planName) => {
    if (planName === 'free') return 0;
    if (planName.includes('pro')) return 1;
    if (planName.includes('max')) return 2;
    return -1; // Unknown plan
  };

  const prevTier = getTier(prevPlan);
  const currentTier = getTier(plan);

  // Classify the change
  const changeType =
    prevTier < currentTier
      ? 'upgrade'
      : prevTier > currentTier
      ? 'downgrade'
      : prevPlan !== plan
      ? 'billing_change'
      : 'no_change';

  console.log({ prevTier, currentTier, changeType });

  await SubscriptionHistory.create({
    user: userId,
    subscription: subscription._id,
    changeType,
    previousPlan: prevPlan,
    newPlan: plan,
    effectiveDate: new Date(),
    notes: `Subscription ${changeType} from ${prevPlan} to ${plan}`,
  });

  res.status(200).json({
    status: 'success',
    message: 'Subscription plan updated successfully',
  });
});

export const getPaymentHistoryService = catchAsync(async (req, res, next) => {
  const { id: userId } = req.user;

  const payments = await getAll(Payment, { user: userId }, {}, 'subscription');

  res.status(200).json({
    status: 'success',
    data: {
      payments,
    },
  });
});

export const getSubscriptionHistoryService = catchAsync(
  async (req, res, next) => {
    const { id: userId } = req.user;

    const subscriptionHistory = await getAll(
      SubscriptionHistory,
      { user: userId },
      {},
      [{ path: 'subscription' }, { path: 'user', select: 'fullName email' }]
    );

    res.status(200).json({
      status: 'success',
      data: {
        subscriptionHistory,
      },
    });
  }
);

export const listProducts = catchAsync(async (req, res, next) => {
  const products = await stripe.products.list({
    expand: ['data.default_price'],
  });

  const packages = await Promise.all(
    products.data.map(async (product) => {
      const packageData = {
        name: product.name,
        active: product.active,
        currency: product.currency,
        stripeProductId: product.id,
        stripePriceId: product.default_price.id,
        price: product.default_price.unit_amount / 100,
        type: product.type,
        recurring: product.recurring,
        slug: product.name.toLowerCase().split(' ').join('_'),
      };

      return await Package.create(packageData);
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      packages,
    },
  });
});

export const updatePackages = catchAsync(async (req, res, next) => {
  const { data: packages } = await getAll(Package, {});

  const updatedPackages = await Promise.all(
    packages.map(async (product) => {
      const slugify = product.name.toLowerCase().split(' ').join('_');
      product.slug = slugify;

      return await product.save();
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      updatedPackages,
    },
  });
});

export const getAllPackages = catchAsync(async (req, res, next) => {
  const packages = await getAll(Package, {}, {});

  res.status(200).json({
    status: 'success',
    data: {
      packages,
    },
  });
});

export const getIndividualSubscriptionHistory = catchAsync(
  async (req, res, next) => {
    const { subId } = req.params;

    const subscription = await findOne(SubscriptionHistory, { _id: subId });

    if (!subscription) return next(new AppError('No subscription found', 404));

    res.status(200).json({
      status: 'success',
      data: {
        subscription,
      },
    });
  }
);
