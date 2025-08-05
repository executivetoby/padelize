import { model, Schema } from 'mongoose';
import { freePlan, maxPlan, proPlan } from './Subscription.js';

const packageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    currency: {
      type: String,
    },
    stripeProductId: {
      type: String,
    },
    stripePriceId: {
      type: String,
    },
    price: {
      type: Number,
    },
    type: {
      type: String,
    },
    recurring: {
      interval: String,
      interval_count: String,
    },
    slug: String,
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

packageSchema.virtual('planFeatures').get(function () {
  switch (true) {
    case this.slug === 'free':
      return freePlan;
    case this.slug.startsWith('pro'):
      return proPlan;
    case this.slug.startsWith('max'):
      return maxPlan;
    default:
      return freePlan;
  }
});

const Package = model('Package', packageSchema);

export default Package;
