const express = require('express');
const axios = require('axios');
const config = require('../config');
const TelegramService = require('../services/TelegramService');

const router = express.Router();

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

function calculateVWAP(candles) {
  let cumTPV = 0;  // cumulative (typical price × volume)
  let cumVol = 0;  // cumulative volume

  // Process in time order (oldest → newest)
  const sorted = [...candles].sort((a, b) => new Date(a[0]) - new Date(b[0]));

  return sorted.map(([time, open, high, low, close, volume]) => {
    const tp = (high + low + close) / 3;       // typical price
    const tpv = tp * volume;                   // typical price × volume
    cumTPV += tpv;
    cumVol += volume;

    const vwap = cumVol > 0 ? cumTPV / cumVol : null;

    return {
      time,
      vwap: vwap ? Number(vwap.toFixed(4)) : null
    };
  });
}



router.get('/fetch-stock-data', async (req, res) => {
  try {
    // Get the external API URL from config
    const externalApiUrl = config.api.externalApiUrl;
    
    if (!externalApiUrl) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'External API URL not configured',
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Make direct GET request to external API URL
    const response = await axios.get(externalApiUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'intraday-bot/1.0.0',
      },
    });
    if(response.status === 200){
      if(response.data && response.data.status === 'success'){
        const data = [...response.data.data.candles.slice(-3)];
        console.log(data);
        console.log(calculateVWAP(data));
      }
    }
    
    // Return the API data directly
    res.status(200).json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Failed to fetch stock data:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch stock data',
        details: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
