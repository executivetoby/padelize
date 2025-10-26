import { Schema, model } from 'mongoose';

const subscriptionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: [
        'free',
        'pro_monthly',
        'pro_yearly',
        // 'max_monthly', 'max_yearly'
      ],
      default: 'free',
      required: true,
    },
    price: {
      type: Number,
    },
    status: {
      type: String,
      enum: [
        'active',
        'canceled',
        'expired',
        'past_due',
        'incomplete',
        'incomplete_expired',
      ],
      default: 'active',
    },
    stripeCustomerId: {
      type: String,
    },
    stripeSubscriptionId: {
      type: String,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
  }
);

export const freePlan = {
  matchAnalysesPerWeek: 10,
  shotSuccessPercentage: true,
  basicShotClassification: true, // forehand/backhand only
  fullShotBreakdown: false, // no smash & volley
  movementHeatmaps: false,
  averageSpeed: false,
  distanceCovered: true,
  caloriesBurned: true,
  communityFeedAccess: true,
  leaderboardAccess: true,
  processingSpeed: 'standard', // slower processing
  earlyFeatureAccess: false,
};

export const proPlan = {
  matchAnalysesPerWeek: 30,
  shotSuccessPercentage: true,
  basicShotClassification: true,
  fullShotBreakdown: true, // includes smash & volley
  movementHeatmaps: true,
  averageSpeed: true,
  distanceCovered: true,
  caloriesBurned: true,
  communityFeedAccess: true,
  leaderboardAccess: true,
  processingSpeed: 'fast', // within 1 hour
  earlyFeatureAccess: true,
};

// export const maxPlan = {
//   matchAnalysesPerWeek: -1, // unlimited
//   shotSuccessPercentage: true,
//   basicShotClassification: true,
//   fullShotBreakdown: true,
//   movementHeatmaps: true,
//   averageSpeed: true,
//   distanceCovered: true,
//   caloriesBurned: true,
//   communityFeedAccess: true,
//   leaderboardAccess: true,
//   processingSpeed: 'fastest', // priority processing
//   earlyFeatureAccess: true,
//   advancedAnalytics: true,
//   customReports: true,
// };

subscriptionSchema.virtual('planFeatures').get(function () {
  switch (true) {
    case this.plan === 'free':
      return freePlan;
    case this.plan.startsWith('pro'):
      return proPlan;
    // case this.plan.startsWith('max'):
    //   return maxPlan;
    default:
      return freePlan;
  }
});

const Subscription = model('Subscription', subscriptionSchema);
export default Subscription;
