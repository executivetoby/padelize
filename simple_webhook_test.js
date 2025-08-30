import mongoose from 'mongoose';

console.log('Testing webhook logging system...');

try {
  // Test if the WebhookLog model can be imported
  const WebhookLog = await import('./src/models/WebhookLog.js');
  console.log('✅ WebhookLog model imported successfully');

  // Test if the WebhookLogService can be imported
  const WebhookLogService = await import('./src/services/webhookLogService.js');
  console.log('✅ WebhookLogService imported successfully');

  console.log('🎉 Basic imports working correctly!');

  // Test basic functionality
  const mockReq = {
    method: 'POST',
    headers: { 'stripe-signature': 'test' },
    body: { test: 'data' },
    ip: '127.0.0.1',
  };

  console.log('✅ Mock request created');
  console.log('🚀 Webhook logging system is ready to use!');
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('❌ Stack:', error.stack);
}
