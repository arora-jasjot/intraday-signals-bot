const express = require('express');
const TelegramService = require('../services/TelegramService');

const router = express.Router();

/**
 * @desc    Root endpoint - sends "Hello from bot" to Telegram
 * @route   GET /
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Initialize Telegram service
    const telegramService = new TelegramService();
    
    // Initialize the service if not already done
    if (!telegramService.isInitialized) {
      await telegramService.initialize();
    }
    
    // Send message to chat
    await telegramService.sendMessage('Hello from bot');
    
    res.status(200).json({
      success: true,
      message: 'Message sent to Telegram successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to send Telegram message from root endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message to Telegram',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
