const StockDataService = require("../services/StockDataService");

const holidays = [
  "26-02-2025",
  "14-03-2025",
  "31-03-2025",
  "10-04-2025",
  "14-04-2025",
  "18-04-2025",
  "01-05-2025",
  "15-08-2025",
  "27-08-2025",
]

class StockController {
  constructor() {
    this.stockDataService = new StockDataService();
  }

  isHoliday(dateStr) {
    // Check if the date is in the holidays array
    return holidays.includes(dateStr);
  }

  getPreviousValidTradingDay(date) {
    let previousDay = new Date(date);
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loop
    
    while (attempts < maxAttempts) {
      previousDay.setUTCDate(previousDay.getUTCDate() - 1);
      const dayOfWeek = previousDay.getUTCDay();
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        attempts++;
        continue;
      }
      
      // Format date as DD-MM-YYYY for holiday check
      const day = String(previousDay.getUTCDate()).padStart(2, '0');
      const month = String(previousDay.getUTCMonth() + 1).padStart(2, '0');
      const year = previousDay.getUTCFullYear();
      const dateStr = `${day}-${month}-${year}`;
      
      // If not a holiday, this is our valid trading day
      if (!this.isHoliday(dateStr)) {
        return previousDay;
      }
      
      attempts++;
    }
    
    throw new Error('Could not find a valid previous trading day');
  }

  getISTDate(date = new Date()) {
    const istFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return istFormatter.format(date);
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
      
      // Calculate previous trading day for pivot calculation (with holiday checking)
      const previousDay = this.getPreviousValidTradingDay(testingDate);
      const previousDayStr = this.getISTDate(previousDay);

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
      
      // Calculate previous trading day for pivot calculation (with holiday checking)
      const previousDay = this.getPreviousValidTradingDay(testingDate);
      const previousDayStr = this.getISTDate(previousDay);

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
      const todayStr = this.getISTDate(today);
      
      // Calculate previous trading day for pivot calculation (with holiday checking)
      const previousDay = this.getPreviousValidTradingDay(today);
      const previousDayStr = this.getISTDate(previousDay);

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

  async testStrategy(req, res) {
    try {
      const { start_date, end_date, instruments } = req.body;

      // Validate required fields
      if (!start_date || !end_date || !instruments) {
        return res.status(400).json({
          status: "failure",
          message: "Missing required fields: start_date, end_date, instruments"
        });
      }

      // Validate instruments array
      if (!Array.isArray(instruments) || instruments.length === 0) {
        return res.status(400).json({
          status: "failure",
          message: "instruments must be a non-empty array of inv_keys"
        });
      }

      // Parse and validate the date parameters (DD-MM-YYYY format)
      const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
      
      const startDateMatch = start_date.match(dateRegex);
      if (!startDateMatch) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid start_date format. Please use DD-MM-YYYY format (example: 25-12-2023)"
        });
      }

      const endDateMatch = end_date.match(dateRegex);
      if (!endDateMatch) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid end_date format. Please use DD-MM-YYYY format (example: 25-12-2023)"
        });
      }

      // Extract day, month, year from start_date and end_date (DD-MM-YYYY format)
      const [, startDay, startMonth, startYear] = startDateMatch;
      const [, endDay, endMonth, endYear] = endDateMatch;

      // Create date strings in YYYY-MM-DD format for API usage (treating input as IST)
      const startDateStr = `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
      const endDateStr = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;

      const startTestingDate = new Date(startDateStr + 'T00:00:00.000Z');
      const endTestingDate = new Date(endDateStr + 'T00:00:00.000Z');

      // Validate if the dates are valid
      if (startTestingDate.getUTCDate() != startDay || startTestingDate.getUTCMonth() != startMonth - 1 || startTestingDate.getUTCFullYear() != startYear) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid start_date provided. Please check the date values"
        });
      }

      if (endTestingDate.getUTCDate() != endDay || endTestingDate.getUTCMonth() != endMonth - 1 || endTestingDate.getUTCFullYear() != endYear) {
        return res.status(400).json({
          status: "failure",
          message: "Invalid end_date provided. Please check the date values"
        });
      }

      // Validate date range
      if (startTestingDate > endTestingDate) {
        return res.status(400).json({
          status: "failure",
          message: "Start date cannot be after end date"
        });
      }

      console.log(`Testing strategy for ${instruments.length} instruments from: ${startDateStr} to: ${endDateStr}`);

      const results = await this.stockDataService.testStrategyForDateRange(
        instruments,
        startDateStr,
        endDateStr
      );

      res.status(200).json({
        status: "success",
        data: results
      });

    } catch (error) {
      console.error("Failed to test strategy:", error);
      res.status(500).json({
        status: "failure",
        message: "Failed to test strategy: " + error.message
      });
    }
  }
}

module.exports = StockController;
