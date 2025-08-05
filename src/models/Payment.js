import { Schema, model } from 'mongoose';

const paymentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
    },
    stripeInvoiceId: {
      type: String,
    },
    stripePaymentIntentId: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'usd',
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      required: true,
    },
    paymentMethod: {
      type: String, // e.g., 'card', 'bank_transfer'
    },
    cardBrand: {
      type: String, // e.g., 'visa', 'mastercard'
    },
    cardLast4: {
      type: String,
    },
    description: {
      type: String,
    },
    billingPeriodStart: {
      type: Date,
    },
    billingPeriodEnd: {
      type: Date,
    },
    receiptUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

const Payment = model('Payment', paymentSchema);
export default Payment;
