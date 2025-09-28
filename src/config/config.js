const {
  STRIPE_PRO_MONTHLY_PRICE,
  STRIPE_MAX_MONTHLY_PRICE,
  STRIPE_PRO_YEARLY_PRICE,
  STRIPE_MAX_YEARLY_PRICE,
} = process.env;

// console.log('Stripe Pro Monthly:', STRIPE_PRO_MONTHLY_PRICE);
// console.log('Stripe Max Monthly:', STRIPE_MAX_MONTHLY_PRICE);
// console.log('Stripe Pro Yearly:', STRIPE_PRO_YEARLY_PRICE);
// console.log('Stripe Max Yearly:', STRIPE_MAX_YEARLY_PRICE);

export default {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    prices: {
      pro_monthly: STRIPE_PRO_MONTHLY_PRICE,
      max_monthly: STRIPE_MAX_MONTHLY_PRICE,
      pro_yearly: STRIPE_PRO_YEARLY_PRICE,
      max_yearly: STRIPE_MAX_YEARLY_PRICE,
    },
  },
};
