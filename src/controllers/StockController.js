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

  async backtest(req, res) {
    try {
      const { inv_key, date } = req.params;
      
      // Parse and validate the date parameter (DD-MM-YYYY format)
      const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
      const dateMatch = date.match(dateRegex);
      
      if (!dateMatch) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid date format. Please use DD-MM-YYYY format (example: 25-12-2023)"
        });
      }
      
      const [, day, month, year] = dateMatch;
      
      // Create date string in YYYY-MM-DD format to avoid timezone issues
      const testingDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const testingDate = new Date(testingDateStr + 'T00:00:00.000Z');
      
      // Validate if the date is valid
      if (testingDate.getUTCDate() != day || testingDate.getUTCMonth() != month - 1 || testingDate.getUTCFullYear() != year) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid date provided. Please check the date values"
        });
      }
      
      // Calculate previous trading day for pivot calculation
      const previousDay = new Date(testingDate);
      const dayOfWeek = testingDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      let daysToSubtract = 1;
      if (dayOfWeek === 1) { // Monday
        daysToSubtract = 3; // Go back to Friday
      } else if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 2; // Go back to Friday
      }
      
      previousDay.setUTCDate(testingDate.getUTCDate() - daysToSubtract);
      
      // Format dates for API (YYYY-MM-DD format) - testingDateStr already formatted above
      const previousDayStr = previousDay.toISOString().split('T')[0];

      console.log(`Running backtest for ${inv_key} on date: ${testingDateStr} using pivot from: ${previousDayStr}`);

      const result = await this.stockDataService.runBacktest(
        inv_key,
        previousDayStr,
        testingDateStr
      );

      res.status(200).json({
        status: "success",
        data: result
      });

    } catch (error) {
      console.error("Failed to run backtest:", error);
      res.status(500).json({
        status: "failure",
        message: "Failed to run backtest: " + error.message
      });
    }
  }

  async backtestAll(req, res) {
    try {
      const { date } = req.params;
      
      // Parse and validate the date parameter (DD-MM-YYYY format)
      const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
      const dateMatch = date.match(dateRegex);
      
      if (!dateMatch) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid date format. Please use DD-MM-YYYY format (example: 25-12-2023)"
        });
      }
      
      const [, day, month, year] = dateMatch;
      
      // Create date string in YYYY-MM-DD format to avoid timezone issues
      const testingDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const testingDate = new Date(testingDateStr + 'T00:00:00.000Z');
      
      // Validate if the date is valid
      if (testingDate.getUTCDate() != day || testingDate.getUTCMonth() != month - 1 || testingDate.getUTCFullYear() != year) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid date provided. Please check the date values"
        });
      }
      
      // Calculate previous trading day for pivot calculation
      const previousDay = new Date(testingDate);
      const dayOfWeek = testingDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      let daysToSubtract = 1;
      if (dayOfWeek === 1) { // Monday
        daysToSubtract = 3; // Go back to Friday
      } else if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 2; // Go back to Friday
      }
      
      previousDay.setUTCDate(testingDate.getUTCDate() - daysToSubtract);
      
      // Format dates for API (YYYY-MM-DD format) - testingDateStr already formatted above
      const previousDayStr = previousDay.toISOString().split('T')[0];

      console.log(`Running backtest for ALL symbols on date: ${testingDateStr} using pivot from: ${previousDayStr}`);
      
      console.log(previousDayStr, testingDateStr)
      const results = await this.stockDataService.runBacktestAll(
        previousDayStr,
        testingDateStr
      );


      res.status(200).json({
        status: "success",
        data: results
      });

    } catch (error) {
      console.error("Failed to run backtest for all symbols:", error);
      res.status(500).json({
        status: "failure",
        message: "Failed to run backtest for all symbols: " + error.message
      });
    }
  }

  async searchStocks(req, res) {
    try {
      // Get today's date
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Calculate previous trading day for pivot calculation
      const previousDay = new Date(today);
      const dayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      let daysToSubtract = 1;
      if (dayOfWeek === 1) { // Monday
        daysToSubtract = 3; // Go back to Friday
      } else if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 2; // Go back to Friday
      }
      
      previousDay.setUTCDate(today.getUTCDate() - daysToSubtract);
      const previousDayStr = previousDay.toISOString().split('T')[0];

      console.log(`Searching current stocks on: ${todayStr} using pivot from: ${previousDayStr}`);

      const results = await this.stockDataService.searchCurrentStocks(
        previousDayStr,
        todayStr
      );

      res.status(200).json({
        status: "success",
        data: results
      });

    } catch (error) {
      console.error("Failed to search current stocks:", error);
      res.status(500).json({
        status: "failure",
        message: "Failed to search current stocks: " + error.message
      });
    }
  }
}

module.exports = StockController;
