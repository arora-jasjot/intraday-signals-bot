const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

class TelegramService {
  constructor() {
    this.bot = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the Telegram bot
   */
  async initialize() {
    try {
      if (!config.telegram.botToken) {
        throw new Error('Telegram bot token is not configured');
      }

      this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
      
      // Test the bot connection
      const botInfo = await this.bot.getMe();
      console.log(`Telegram bot initialized: ${botInfo.username}`);
      
      this.isInitialized = true;
      return botInfo;
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  /**
   * Send a text message
   * @param {string} message - Message to send
   * @param {string} chatId - Chat ID (optional, uses default from config)
   * @returns {Promise<Object>} Telegram API response
   */
  async sendMessage(message, chatId = null) {
    if (!this.isInitialized) {
      throw new Error('Telegram bot is not initialized');
    }

    const targetChatId = chatId || config.telegram.chatId;
    if (!targetChatId) {
      throw new Error('Chat ID is not configured');
    }

    try {
      const result = await this.bot.sendMessage(targetChatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      
      console.log(`Message sent to chat ${targetChatId}`);
      return result;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send formatted data as a message
   * @param {Object} data - Data to send
   * @param {string} format - Format type ('text' or 'json')
   * @param {string} chatId - Chat ID (optional)
   * @returns {Promise<Object>} Telegram API response
   */
  async sendData(data, format = 'text', chatId = null) {
    let message;

    if (format === 'json') {
      message = `<pre><code class="language-json">${JSON.stringify(data, null, 2)}</code></pre>`;
    } else {
      // Format as readable text
      message = this.formatDataAsText(data);
    }

    return this.sendMessage(message, chatId);
  }

  /**
   * Send a photo with caption
   * @param {string} photo - Photo URL or file path
   * @param {string} caption - Photo caption
   * @param {string} chatId - Chat ID (optional)
   * @returns {Promise<Object>} Telegram API response
   */
  async sendPhoto(photo, caption = '', chatId = null) {
    if (!this.isInitialized) {
      throw new Error('Telegram bot is not initialized');
    }

    const targetChatId = chatId || config.telegram.chatId;
    if (!targetChatId) {
      throw new Error('Chat ID is not configured');
    }

    try {
      const result = await this.bot.sendPhoto(targetChatId, photo, {
        caption,
        parse_mode: 'HTML',
      });
      
      console.log(`Photo sent to chat ${targetChatId}`);
      return result;
    } catch (error) {
      console.error('Failed to send photo:', error);
      throw error;
    }
  }

  /**
   * Format data object as readable text
   * @param {Object} data - Data to format
   * @returns {string} Formatted text
   */
  formatDataAsText(data) {
    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      let text = '';
      for (const [key, value] of Object.entries(data)) {
        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        text += `<b>${formattedKey}:</b> ${value}\n`;
      }
      return text;
    }

    return String(data);
  }

  /**
   * Get bot status
   * @returns {Object} Bot status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      botToken: config.telegram.botToken ? '***configured***' : 'not configured',
      chatId: config.telegram.chatId ? '***configured***' : 'not configured',
    };
  }

  /**
   * Close the bot connection
   */
  close() {
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
      this.isInitialized = false;
      console.log('Telegram bot connection closed');
    }
  }
}

module.exports = TelegramService;
