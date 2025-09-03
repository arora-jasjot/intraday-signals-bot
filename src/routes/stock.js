const express = require("express");
const axios = require("axios");
const config = require("../config");

const router = express.Router();

const INSTRUMENT_KEY = "NSE_EQ%7CINE002A01018";
const TIMEFRAME = "minutes";
const INTERVAL = 5;
const REQUEST_TIMEOUT = 30000;
const USER_AGENT = "intraday-bot/1.0.0";

async function fetchApiData(url) {
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

function calculatePivotPoint(candles) {
  if (!candles || candles.length === 0) return 0;
  
  const [, , prevHigh, prevLow, prevClose] = candles[0];
  return (prevHigh + prevLow + prevClose) / 3;
}

function buildApiUrl(baseUrl, instrumentKey, timeframe, interval, date) {
  return `${baseUrl}/${instrumentKey}/${timeframe}/${interval}/${date}/${date}`;
}

function convertToISTTime(utcDateStr) {
  const date = new Date(utcDateStr);

  const options = {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

// Example:
console.log(convertToISTTime("2025-09-02T03:45:00.000Z"));
// Output: 9:15 AM

router.get("/fetch-stock-data", async (req, res) => {
  try {
    if (!config.api.externalApiUrl) {
      return res.status(400).json({
        success: false,
        error: { message: "External API URL not configured" },
        timestamp: new Date().toISOString(),
      });
    }

    const previousDate = "2025-09-01";
    const pivotUrl = buildApiUrl(
      config.api.externalApiUrl,
      INSTRUMENT_KEY,
      "days",
      1,
      previousDate
    );

    console.log("Fetching pivot data from:", pivotUrl);
    const pivotData = await fetchApiData(pivotUrl);
    
    if (!pivotData) {
      return res.status(500).json({
        success: false,
        error: { message: "Failed to fetch pivot data" },
        timestamp: new Date().toISOString(),
      });
    }

    const pivotPoint = calculatePivotPoint(pivotData.data.candles);
    console.log("Calculated pivot point:", pivotPoint);

    if (!pivotPoint) {
      return res.status(200).json({
        success: true,
        message: "No pivot point calculated",
        timestamp: new Date().toISOString(),
      });
    }

    const currentDate = "2025-09-02";
    const candlesUrl = buildApiUrl(
      config.api.externalApiUrl,
      INSTRUMENT_KEY,
      TIMEFRAME,
      INTERVAL,
      currentDate
    );

    console.log("Fetching stock data from:", candlesUrl);
    const candlesData = await fetchApiData(candlesUrl);

    if (!candlesData) {
      return res.status(500).json({
        success: false,
        error: { message: "Failed to fetch current day data" },
        timestamp: new Date().toISOString(),
      });
    }

    const candles = [...candlesData.data.candles].reverse().slice(0, 27).map(candle => {
      return ({
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        timestamp: convertToISTTime(candle[0])
      })
    })
  
    res.status(200).json({
      success: true,
      data: candles,
      pivotPoint: Number(pivotPoint.toFixed(4)),
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
});

module.exports = router;
