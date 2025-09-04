const axios = require("axios");
const config = require("../config");

const INSTRUMENT_KEY = "NSE_EQ%7CINE002A01018";
const TIMEFRAME = "minutes";
const INTERVAL = 5;
const REQUEST_TIMEOUT = 30000;
const USER_AGENT = "intraday-bot/1.0.0";

class StockDataService {
  async fetchApiData(url) {
    try {
      const response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        headers: { "User-Agent": USER_AGENT },
      });
      
      if (response.status === 200 && response.data?.status === "success") {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch data from ${url}:`, error.message);
      return null;
    }
  }

  calculatePivotPoint(candles) {
    if (!candles || candles.length === 0) return 0;
    
    const [, , prevHigh, prevLow, prevClose] = candles[0];
    return (prevHigh + prevLow + prevClose) / 3;
  }

  buildApiUrl(baseUrl, instrumentKey, timeframe, interval, date) {
    return `${baseUrl}/${instrumentKey}/${timeframe}/${interval}/${date}/${date}`;
  }

  convertToISTTime(utcDateStr) {
    const date = new Date(utcDateStr);

    const options = {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };

    return new Intl.DateTimeFormat("en-US", options).format(date);
  }

  async getPivotData(previousDate) {
    const pivotUrl = this.buildApiUrl(
      config.api.externalApiUrl,
      INSTRUMENT_KEY,
      "days",
      1,
      previousDate
    );

    console.log("Fetching pivot data from:", pivotUrl);
    return await this.fetchApiData(pivotUrl);
  }

  async getCurrentDayData(currentDate) {
    const candlesUrl = this.buildApiUrl(
      config.api.externalApiUrl,
      INSTRUMENT_KEY,
      TIMEFRAME,
      INTERVAL,
      currentDate
    );

    console.log("Fetching stock data from:", candlesUrl);
    return await this.fetchApiData(candlesUrl);
  }

  formatCandleData(candlesData) {
    return [...candlesData.data.candles].reverse().slice(0, 27).map(candle => ({
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      timestamp: this.convertToISTTime(candle[0])
    }));
  }

  async getStockDataWithPivot(previousDate, currentDate) {
    if (!config.api.externalApiUrl) {
      throw new Error("External API URL not configured");
    }

    const pivotData = await this.getPivotData(previousDate);
    if (!pivotData) {
      throw new Error("Failed to fetch pivot data");
    }

    const pivotPoint = this.calculatePivotPoint(pivotData.data.candles);
    console.log("Calculated pivot point:", pivotPoint);

    if (!pivotPoint) {
      return {
        success: true,
        message: "No pivot point calculated",
        pivotPoint: 0
      };
    }

    const candlesData = await this.getCurrentDayData(currentDate);
    if (!candlesData) {
      throw new Error("Failed to fetch current day data");
    }

    const formattedCandles = this.formatCandleData(candlesData);

    return {
      success: true,
      data: formattedCandles,
      pivotPoint: Number(pivotPoint.toFixed(4))
    };
  }
}

module.exports = StockDataService;
