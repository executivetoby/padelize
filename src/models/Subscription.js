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
      enum: ['free', 'pro_monthly', 'pro_yearly', 'max_monthly', 'max_yearly'],
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
  recordingHours: 2,
  cloudStorage: '4GB',
  lineCallbacks: false,
  advancedShotAnalysis: false,
  aiScoreboards: false,
  aiCoaching: false,
  videoQuality4k: false,
  liveLineCalls: false,
};

export const proPlan = {
  recordingHours: 30,
  cloudStorage: true,
  lineCallbacks: true,
  advancedShotAnalysis: true,
  aiScoreboards: false,
  aiCoaching: false,
  videoQuality4k: false,
  liveLineCalls: false,
};

export const maxPlan = {
  recordingHours: 60,
  cloudStorage: true,
  lineCallbacks: true,
  advancedShotAnalysis: true,
  aiScoreboards: true,
  aiCoaching: true,
  videoQuality4k: true,
  liveLineCalls: true,
};

subscriptionSchema.virtual('planFeatures').get(function () {
  switch (true) {
    case this.plan === 'free':
      return freePlan;
    case this.plan.startsWith('pro'):
      return proPlan;
    case this.plan.startsWith('max'):
      return maxPlan;
    // default:
    //   return freePlan;
  }
});

const Subscription = model('Subscription', subscriptionSchema);
export default Subscription;
