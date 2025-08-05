// models/subscriptionHistoryModel.js
import { Schema, model } from 'mongoose';

const subscriptionHistorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    changeType: {
      type: String,
      enum: [
        'created',
        'renewed',
        'upgraded',
        'downgraded',
        'canceled',
        'payment_failed',
        'reactivated',
      ],
      required: true,
    },
    previousPlan: {
      type: String,
      enum: [
        'free',
        'pro_monthly',
        'pro_yearly',
        'max_monthly',
        'max_yearly',
        null,
      ],
    },
    newPlan: {
      type: String,
      enum: [
        'free',
        'pro_monthly',
        'pro_yearly',
        'max_monthly',
        'max_yearly',
        null,
      ],
      required: true,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

const SubscriptionHistory = model(
  'SubscriptionHistory',
  subscriptionHistorySchema
);
export default SubscriptionHistory;
