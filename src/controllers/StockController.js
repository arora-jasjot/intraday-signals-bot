const StockDataService = require("../services/StockDataService");

class StockController {
  constructor() {
    this.stockDataService = new StockDataService();
  }

  async fetchStockData(req, res) {
    try {
      const previousDate = "2025-09-01";
      const currentDate = "2025-09-02";

      const result = await this.stockDataService.getStockDataWithPivot(
        previousDate,
        currentDate
      );

      res.status(200).json({
        ...result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error("Failed to fetch stock data:", error);
      res.status(500).json({
        success: false,
        error: {
          message: "Failed to fetch stock data",
          details: error.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = StockController;
