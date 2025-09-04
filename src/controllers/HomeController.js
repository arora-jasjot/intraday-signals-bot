const TelegramService = require("../services/TelegramService");

class HomeController {
  constructor() {
    this.telegramService = new TelegramService();
  }

  async sendHelloMessage(req, res) {
    try {
      if (!this.telegramService.isInitialized) {
        await this.telegramService.initialize();
      }

      await this.telegramService.sendMessage("Hello from bot");

      res.status(200).json({
        success: true,
        message: "Message sent to Telegram successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to send Telegram message from root endpoint:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send message to Telegram",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = HomeController;
