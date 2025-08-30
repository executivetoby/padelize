import mongoose from 'mongoose';
import config from './src/config/config.js';
import WebhookLogService from './src/services/webhookLogService.js';
import WebhookLog from './src/models/WebhookLog.js';
import User from './src/models/User.js';
import Subscription from './src/models/Subscription.js';

// Mock Express request object
const createMockRequest = (eventData, signature = 'test-signature') => ({
  method: 'POST',
  headers: {
    'stripe-signature': signature,
    'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
    'content-type': 'application/json',
  },
  body: eventData,
  ip: '192.168.1.1',
  connection: { remoteAddress: '192.168.1.1' },
});

// Mock Stripe event data
const createMockStripeEvent = (
  type,
  customerId = null,
  subscriptionId = null
) => ({
  id: `evt_test_${Date.now()}`,
  type,
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: type.includes('subscription') ? 'sub_test123' : 'inv_test123',
      object: type.includes('subscription') ? 'subscription' : 'invoice',
      customer: customerId || 'cus_test123',
      subscription: subscriptionId || 'sub_test123',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(
        (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000
      ),
    },
  },
});

async function runWebhookLogTests() {
  try {
    console.log('🚀 Starting Webhook Logging Tests...\n');

    // Connect to database
    await mongoose.connect(config.database.uri);
    console.log('✅ Connected to database');

    // Clean up any existing test data
    await WebhookLog.deleteMany({ stripeEventId: /^evt_test_/ });
    console.log('✅ Cleaned up existing test data\n');

    // Test 1: Log incoming webhook without parsed event
    console.log('📝 Test 1: Log incoming webhook without parsed event');
    const mockReq1 = createMockRequest({ test: 'data' });
    const log1 = await WebhookLogService.logIncomingWebhook(mockReq1);

    console.log(`   ✅ Created log: ${log1._id}`);
    console.log(`   📊 Status: ${log1.status}`);
    console.log(`   🔒 Signature verified: ${log1.signatureVerified}\n`);

    // Test 2: Log incoming webhook with parsed Stripe event
    console.log('📝 Test 2: Log incoming webhook with parsed Stripe event');
    const stripeEvent = createMockStripeEvent('customer.subscription.updated');
    const mockReq2 = createMockRequest(stripeEvent);
    const log2 = await WebhookLogService.logIncomingWebhook(
      mockReq2,
      stripeEvent,
      true
    );

    console.log(`   ✅ Created log: ${log2._id}`);
    console.log(`   📊 Status: ${log2.status}`);
    console.log(`   🎯 Event type: ${log2.eventType}`);
    console.log(`   🆔 Stripe event ID: ${log2.stripeEventId}`);
    console.log(`   🔒 Signature verified: ${log2.signatureVerified}\n`);

    // Test 3: Update webhook status
    console.log('📝 Test 3: Update webhook status');
    await WebhookLogService.updateWebhookStatus(log2._id, 'processing', {
      responseStatus: 200,
      metadata: { step: 'validation' },
    });

    const updatedLog = await WebhookLog.findById(log2._id);
    console.log(`   ✅ Updated status: ${updatedLog.status}`);
    console.log(`   📊 Response status: ${updatedLog.responseStatus}`);
    console.log(`   📝 Metadata: ${JSON.stringify(updatedLog.metadata)}\n`);

    // Test 4: Mark webhook as completed
    console.log('📝 Test 4: Mark webhook as completed');
    await WebhookLogService.markWebhookCompleted(
      log2._id,
      200,
      { success: true },
      150
    );

    const completedLog = await WebhookLog.findById(log2._id);
    console.log(`   ✅ Final status: ${completedLog.status}`);
    console.log(`   ⏱️ Processing time: ${completedLog.processingTime}ms`);
    console.log(
      `   📊 Response body: ${JSON.stringify(completedLog.responseBody)}\n`
    );

    // Test 5: Mark webhook as failed
    console.log('📝 Test 5: Mark webhook as failed');
    await WebhookLogService.markWebhookFailed(
      log1._id,
      'Test error message',
      'Error stack trace',
      500
    );

    const failedLog = await WebhookLog.findById(log1._id);
    console.log(`   ✅ Failed status: ${failedLog.status}`);
    console.log(`   ❌ Error message: ${failedLog.errorMessage}`);
    console.log(`   📊 Response status: ${failedLog.responseStatus}\n`);

    // Test 6: Create multiple logs for testing aggregation
    console.log('📝 Test 6: Create multiple logs for aggregation testing');
    const eventTypes = [
      'customer.subscription.created',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ];
    const statuses = ['completed', 'failed', 'pending'];

    for (let i = 0; i < 15; i++) {
      const eventType = eventTypes[i % eventTypes.length];
      const status = statuses[i % statuses.length];
      const event = createMockStripeEvent(eventType);
      const req = createMockRequest(event);

      const log = await WebhookLogService.logIncomingWebhook(req, event, true);
      await WebhookLogService.updateWebhookStatus(log._id, status, {
        responseStatus: status === 'failed' ? 500 : 200,
        metadata: { testIndex: i },
      });
    }
    console.log('   ✅ Created 15 test logs with various statuses\n');

    // Test 7: Get webhook logs with filtering
    console.log('📝 Test 7: Get webhook logs with filtering');
    const filteredLogs = await WebhookLogService.getWebhookLogs(
      { eventType: 'customer.subscription.created', status: 'completed' },
      { page: 1, limit: 10 }
    );

    console.log(`   ✅ Found ${filteredLogs.logs.length} filtered logs`);
    console.log(`   📊 Total count: ${filteredLogs.pagination.total}`);
    console.log(`   📄 Pages: ${filteredLogs.pagination.pages}\n`);

    // Test 8: Get webhook statistics
    console.log('📝 Test 8: Get webhook statistics');
    const stats = await WebhookLogService.getWebhookStats();

    console.log(`   ✅ Total webhooks: ${stats.overview.total}`);
    console.log(`   ✅ Completed: ${stats.overview.completed}`);
    console.log(`   ❌ Failed: ${stats.overview.failed}`);
    console.log(`   ⏳ Pending: ${stats.overview.pending}`);
    console.log(`   📊 Event types: ${stats.byEventType.length}`);

    stats.byEventType.forEach((stat) => {
      console.log(
        `      - ${stat._id}: ${stat.count} total, ${stat.completed} completed, ${stat.failed} failed`
      );
    });
    console.log();

    // Test 9: Test retry functionality
    console.log('📝 Test 9: Test retry functionality');
    const retryLog = await WebhookLogService.retryWebhook(failedLog._id);
    console.log(`   ✅ Retry count: ${retryLog.retryCount}`);
    console.log(`   📅 Last retry: ${retryLog.lastRetryAt}\n`);

    // Test 10: Test with user and subscription associations
    console.log('📝 Test 10: Test with user and subscription associations');

    // Create a test user
    const testUser = await User.create({
      fullName: 'Test User',
      email: 'test@webhook.com',
      password: 'password123',
      stripeCustomerId: 'cus_webhook_test',
    });

    // Create a test subscription
    const testSubscription = await Subscription.create({
      user: testUser._id,
      plan: 'pro_monthly',
      status: 'active',
      stripeCustomerId: 'cus_webhook_test',
      stripeSubscriptionId: 'sub_webhook_test',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Create webhook with user association
    const userEvent = createMockStripeEvent(
      'customer.subscription.updated',
      'cus_webhook_test',
      'sub_webhook_test'
    );
    const userReq = createMockRequest(userEvent);
    const userLog = await WebhookLogService.logIncomingWebhook(
      userReq,
      userEvent,
      true
    );

    console.log(`   ✅ Created log with user association: ${userLog._id}`);
    console.log(`   👤 User ID: ${userLog.userId}`);
    console.log(`   📋 Subscription ID: ${userLog.subscriptionId}`);
    console.log(`   🏪 Stripe Customer ID: ${userLog.stripeCustomerId}\n`);

    // Test 11: Cleanup old logs
    console.log('📝 Test 11: Test cleanup old logs (dry run)');

    // First, create an old log by manually setting the date
    const oldLog = await WebhookLog.create({
      method: 'POST',
      stripeEventId: 'evt_old_test',
      eventType: 'test.old.event',
      status: 'completed',
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
    });

    const cleanupResult = await WebhookLogService.cleanupOldLogs(30);
    console.log(`   ✅ Cleaned up ${cleanupResult.deletedCount} old logs\n`);

    console.log('🎉 All webhook logging tests completed successfully!');

    // Clean up test data
    await WebhookLog.deleteMany({ stripeEventId: /^evt_test_/ });
    await WebhookLog.deleteMany({ stripeEventId: 'evt_old_test' });
    await User.findByIdAndDelete(testUser._id);
    await Subscription.findByIdAndDelete(testSubscription._id);

    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from database');
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runWebhookLogTests()
    .then(() => {
      console.log('\n🎊 All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Tests failed:', error);
      process.exit(1);
    });
}

export default runWebhookLogTests;
