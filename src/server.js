const app = require('./app');
const config = require('./config');

// Import services
const TelegramService = require('./services/TelegramService');

// Initialize services
const telegramService = new TelegramService();

// Start server
const server = app.listen(config.server.port, () => {
  console.log(`🚀 Server running on port ${config.server.port}`);
  console.log(`📱 Environment: ${config.server.nodeEnv}`);
  
  // Initialize Telegram bot
  telegramService.initialize()
    .then(() => {
      console.log('✅ Telegram bot initialized successfully');
    })
    .catch((error) => {
      console.error('❌ Failed to initialize Telegram bot:', error);
    });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`🔄 Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close Telegram bot
    telegramService.close();
    console.log('📱 Telegram bot closed');
    
    console.log('👋 Process terminated gracefully');
    process.exit(0);
  });
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = server;
