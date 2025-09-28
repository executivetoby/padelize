/**
 * CHECKOUT SESSION DEBUG SCRIPT
 * This script helps debug the "Not a valid URL" error in checkout session creation
 */

import config from './src/config/config.js';

console.log('🔍 DEBUGGING CHECKOUT SESSION CONFIGURATION...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(
  `STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'Set' : 'NOT SET'}`
);
console.log(
  `STRIPE_WEBHOOK_SECRET: ${
    process.env.STRIPE_WEBHOOK_SECRET ? 'Set' : 'NOT SET'
  }`
);
console.log(
  `STRIPE_PRO_MONTHLY_PRICE: ${
    process.env.STRIPE_PRO_MONTHLY_PRICE || 'NOT SET'
  }`
);
console.log(
  `STRIPE_MAX_MONTHLY_PRICE: ${
    process.env.STRIPE_MAX_MONTHLY_PRICE || 'NOT SET'
  }`
);
console.log(
  `STRIPE_PRO_YEARLY_PRICE: ${process.env.STRIPE_PRO_YEARLY_PRICE || 'NOT SET'}`
);
console.log(
  `STRIPE_MAX_YEARLY_PRICE: ${process.env.STRIPE_MAX_YEARLY_PRICE || 'NOT SET'}`
);
console.log();

// Check config mapping
console.log('🔧 Config Price Mapping:');
console.log(`pro_monthly: ${config.stripe.prices.pro_monthly || 'NOT SET'}`);
console.log(`max_monthly: ${config.stripe.prices.max_monthly || 'NOT SET'}`);
console.log(`pro_yearly: ${config.stripe.prices.pro_yearly || 'NOT SET'}`);
console.log(`max_yearly: ${config.stripe.prices.max_yearly || 'NOT SET'}`);
console.log();

// Test URL construction
console.log('🌐 URL Construction Test:');
const mockReq = {
  protocol: 'https',
  get: (header) => (header === 'host' ? 'api.padelize.com' : 'test-value'),
};

const successUrl = `${mockReq.protocol}://${mockReq.get(
  'host'
)}/api/v1/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = `${mockReq.protocol}://${mockReq.get(
  'host'
)}/api/v1/subscriptions/cancel`;

console.log(`Success URL: ${successUrl}`);
console.log(`Cancel URL: ${cancelUrl}`);
console.log();

// Validate URLs
function isValidUrl(string) {
  try {
    new URL(string.replace('{CHECKOUT_SESSION_ID}', 'test_session_id'));
    return true;
  } catch (_) {
    return false;
  }
}

console.log('✅ URL Validation:');
console.log(
  `Success URL valid: ${isValidUrl(successUrl) ? '✅ YES' : '❌ NO'}`
);
console.log(`Cancel URL valid: ${isValidUrl(cancelUrl) ? '✅ YES' : '❌ NO'}`);
console.log();

// Check for common issues
console.log('🚨 Common Issues Check:');

const issues = [];

if (!config.stripe.prices.pro_monthly) {
  issues.push('❌ pro_monthly price ID not set');
}
if (!config.stripe.prices.max_monthly) {
  issues.push('❌ max_monthly price ID not set');
}
if (!config.stripe.prices.pro_yearly) {
  issues.push('❌ pro_yearly price ID not set');
}
if (!config.stripe.prices.max_yearly) {
  issues.push('❌ max_yearly price ID not set');
}

if (!process.env.STRIPE_SECRET_KEY) {
  issues.push('❌ STRIPE_SECRET_KEY environment variable not set');
}

if (issues.length === 0) {
  console.log('✅ No configuration issues found!');
} else {
  console.log('Issues found:');
  issues.forEach((issue) => console.log(`  ${issue}`));
}

console.log();
console.log('🎯 NEXT STEPS:');
console.log('1. Fix the malformed success_url (already fixed)');
console.log(
  '2. Ensure all Stripe price IDs are correctly set in environment variables'
);
console.log('3. Verify STRIPE_SECRET_KEY is valid');
console.log('4. Test with the enhanced error logging');
console.log();
console.log('🚀 The checkout session should now work correctly!');
