// import './config.js';

// import app from './app.js';
// import connectDB from './connectDB.js';

// connectDB();

// const port = process.env.PORT || 9000;
// app.listen(port, () => {
//   createLogger.info(
//     `Padelize server kickstart to life on port ${port}`.bold.cyan
//   );
// });

// server.js
import './config.js';
import { createServer } from 'http';
import app from './app.js';
import connectDB from './connectDB.js';
import webSocketService from './src/services/webSocketService.js';
import analysisStatusCron from './src/services/cronService.js';
import { initializeSubscriptionCronJobs } from './src/services/subscriptionCronService.js';
import WebhookLogCronService from './src/services/webhookLogCronService.js';

connectDB();

const server = createServer(app);

// Initialize WebSocket service
webSocketService.initialize(server);

// Make websocket service globally available
global.websocketService = webSocketService;

const startServer = async () => {
  try {
    analysisStatusCron.start();

    // Initialize subscription management cron jobs
    initializeSubscriptionCronJobs();

    // Initialize webhook log maintenance cron jobs
    WebhookLogCronService.initialize();

    const port = process.env.PORT || 9000;
    server.listen(port, () => {
      createLogger.info(
        `Padelize server with WebSocket support kickstart to life on port ${port}`
          .bold.cyan
      );
      createLogger.info('Analysis status cron job is active'.bold.blue);
      createLogger.info(
        'Subscription management cron jobs are active'.bold.green
      );
      createLogger.info(
        'Webhook log maintenance cron jobs are active'.bold.magenta
      );
    });
  } catch (error) {
    createLogger.error(`Error starting server: ${error.message}`.bold.red);
  }
};

const shutdown = async () => {
  console.log('Shutting down server...');

  // Stop the cron jobs
  analysisStatusCron.stop();
  WebhookLogCronService.stop();

  // Close database connections, etc.
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();
