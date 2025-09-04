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

  async getPivotData(previousDate, instrumentKey) {
    const pivotUrl = `${config.api.externalApiUrl}/${instrumentKey}/days/1/${previousDate}/${previousDate}`

    console.log("Fetching pivot data from:", pivotUrl);
    return await this.fetchApiData(pivotUrl);
  }

  async getCurrentDayData(currentDate, instrumentKey) {

    const candlesUrl = `${config.api.externalApiUrl}/intraday/${instrumentKey}/${TIMEFRAME}/${INTERVAL}`

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

  calculatePivotPoints(candles) {
    if (!candles || candles.length === 0) return {};
    
    const [, , prevHigh, prevLow, prevClose] = candles[0];
    const PP = (prevHigh + prevLow + prevClose) / 3;
    
    // Calculate additional pivot levels
    const R1 = (2 * PP) - prevLow;
    const S1 = (2 * PP) - prevHigh;
    const R2 = PP + (prevHigh - prevLow);
    const S2 = PP - (prevHigh - prevLow);
    const R3 = prevHigh + 2 * (PP - prevLow);
    const S3 = prevLow - 2 * (prevHigh - PP);
    
    return {
      PP: Number(PP.toFixed(4)),
      R1: Number(R1.toFixed(4)),
      R2: Number(R2.toFixed(4)),
      R3: Number(R3.toFixed(4)),
      S1: Number(S1.toFixed(4)),
      S2: Number(S2.toFixed(4)),
      S3: Number(S3.toFixed(4))
    };
  }

  parseTimeFromTimestamp(timestamp) {
    // Convert "10:20 AM" format to minutes from 9:20 AM (analysis start time)
    const [time, ampm] = timestamp.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let totalHours = hours;
    
    if (ampm === 'PM' && hours !== 12) {
      totalHours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      totalHours = 0;
    }
    
    const totalMinutes = totalHours * 60 + minutes;
    const analysisStartMinutes = 9 * 60 + 20; // 9:20 AM (analysis start)
    
    return totalMinutes - analysisStartMinutes;
  }

  isWithinBacktestTimeRange(timestamp) {
    const minutesFromStart = this.parseTimeFromTimestamp(timestamp);
    const endTime = 11 * 60 + 20 - (9 * 60 + 20); // 11:20 AM - 9:20 AM = 120 minutes
    
    return minutesFromStart >= 0 && minutesFromStart <= endTime;
  }

  checkLongSignal(candle1, candle2, pivotPoints) {
    const allPivots = [pivotPoints.PP, pivotPoints.S1, pivotPoints.S2, pivotPoints.S3, pivotPoints.R1, pivotPoints.R2, pivotPoints.R3];
    
    for (const pivot of allPivots) {
      // Check if candle1 opens below pivot and closes above pivot
      if (candle1.open < pivot && candle1.close > pivot) {
        // Calculate body portions
        const bodyBelowPivot = pivot - candle1.open;
        const bodyAbovePivot = candle1.close - pivot;
        
        // Check if body below pivot > body above pivot
        if (bodyBelowPivot > bodyAbovePivot) {
          // Check candle2 conditions: low above pivot and close > open (bullish)
          if (candle2.low > pivot && candle2.close > candle2.open) {
            return {
              detected: true,
              signalType: 'LONG',
              pivot: pivot,
              pivotType: this.getPivotType(pivot, pivotPoints),
              candle1: candle1,
              candle2: candle2,
              bodyBelowPivot: Number(bodyBelowPivot.toFixed(4)),
              bodyAbovePivot: Number(bodyAbovePivot.toFixed(4))
            };
          }
        }
      }
    }
    
    return { detected: false };
  }

  checkShortSignal(candle1, candle2, pivotPoints) {
    const allPivots = [pivotPoints.PP, pivotPoints.S1, pivotPoints.S2, pivotPoints.S3, pivotPoints.R1, pivotPoints.R2, pivotPoints.R3];
    
    for (const pivot of allPivots) {
      // Check if candle1 opens above pivot and closes below pivot
      if (candle1.open > pivot && candle1.close < pivot) {
        // Calculate body portions
        const bodyAbovePivot = candle1.open - pivot;
        const bodyBelowPivot = pivot - candle1.close;
        
        // Check if body above pivot > body below pivot
        if (bodyAbovePivot > bodyBelowPivot) {
          // Check candle2 conditions: high below pivot and close < open (bearish)
          if (candle2.high < pivot && candle2.close < candle2.open) {
            return {
              detected: true,
              signalType: 'SHORT',
              pivot: pivot,
              pivotType: this.getPivotType(pivot, pivotPoints),
              candle1: candle1,
              candle2: candle2,
              bodyAbovePivot: Number(bodyAbovePivot.toFixed(4)),
              bodyBelowPivot: Number(bodyBelowPivot.toFixed(4))
            };
          }
        }
      }
    }
    
    return { detected: false };
  }

  checkTradingSignals(candle1, candle2, pivotPoints) {
    // Check for LONG signal
    const longSignal = this.checkLongSignal(candle1, candle2, pivotPoints);
    if (longSignal.detected) {
      return longSignal;
    }
    
    // Check for SHORT signal
    const shortSignal = this.checkShortSignal(candle1, candle2, pivotPoints);
    if (shortSignal.detected) {
      return shortSignal;
    }
    
    return { detected: false };
  }

  getPivotType(pivot, pivotPoints) {
    if (pivot === pivotPoints.PP) return 'PP';
    if (pivot === pivotPoints.S1) return 'S1';
    if (pivot === pivotPoints.S2) return 'S2';
    if (pivot === pivotPoints.S3) return 'S3';
    if (pivot === pivotPoints.R1) return 'R1';
    if (pivot === pivotPoints.R2) return 'R2';
    if (pivot === pivotPoints.R3) return 'R3';
    return 'Unknown';
  }

  getNextCandleTime(currentTimestamp) {
    const [time, ampm] = currentTimestamp.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let totalHours = hours;
    if (ampm === 'PM' && hours !== 12) {
      totalHours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      totalHours = 0;
    }
    
    const totalMinutes = totalHours * 60 + minutes + 5; // Add 5 minutes for next candle
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    
    const displayHours = newHours > 12 ? newHours - 12 : (newHours === 0 ? 12 : newHours);
    const displayAmPm = newHours >= 12 ? 'PM' : 'AM';
    
    return `${displayHours}:${newMinutes.toString().padStart(2, '0')} ${displayAmPm}`;
  }

  async runBacktest(invKey, previousDate, currentDate) {
    if (!config.api.externalApiUrl) {
      throw new Error("External API URL not configured");
    }

    console.log(`Starting backtest for ${invKey} on ${currentDate} using previous day ${previousDate}`);

    // Fetch previous day data for pivot calculation
    const pivotData = await this.getPivotData(previousDate, invKey);
    if (!pivotData) {
      throw new Error("Failed to fetch pivot data for previous day");
    }

    // Calculate pivot points from previous day
    const pivotPoints = this.calculatePivotPoints(pivotData.data.candles);
    console.log("Calculated pivot points:", pivotPoints);

    // Fetch 5-minute candle data for current day
    const candlesData = await this.getCurrentDayData(currentDate, invKey);
    if (!candlesData) {
      throw new Error("Failed to fetch current day candle data");
    }

    // Format and reverse candles to get chronological order
    const allCandles = [...candlesData.data.candles].reverse().map(candle => ({
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      timestamp: this.convertToISTTime(candle[0])
    }));

    // Filter candles for backtest time range (9:20 AM to 11:20 AM)
    const backtestCandles = allCandles.filter(candle => 
      this.isWithinBacktestTimeRange(candle.timestamp)
    );

    console.log(`Analyzing ${backtestCandles.length} candles from 9:20 AM to 11:20 AM`);

    const signals = [];

    // Check each pair of consecutive candles
    for (let i = 0; i < backtestCandles.length - 1; i++) {
      const candle1 = backtestCandles[i];
      const candle2 = backtestCandles[i + 1];
      
      const signal = this.checkTradingSignals(candle1, candle2, pivotPoints);
      
      if (signal.detected) {
        const nextCandleTime = this.getNextCandleTime(candle2.timestamp);
        console.log(`${signal.signalType} Detected at ${nextCandleTime}`);
        
        const signalData = {
          signalType: signal.signalType,
          detectionTime: nextCandleTime,
          pivotType: signal.pivotType,
          pivotValue: signal.pivot,
          candle1: signal.candle1,
          candle2: signal.candle2
        };

        // Add body analysis based on signal type
        if (signal.signalType === 'LONG') {
          signalData.bodyBelowPivot = signal.bodyBelowPivot;
          signalData.bodyAbovePivot = signal.bodyAbovePivot;
        } else if (signal.signalType === 'SHORT') {
          signalData.bodyAbovePivot = signal.bodyAbovePivot;
          signalData.bodyBelowPivot = signal.bodyBelowPivot;
        }
        
        signals.push(signalData);
      }
    }

    // Count signals by type
    const longSignals = signals.filter(signal => signal.signalType === 'LONG');
    const shortSignals = signals.filter(signal => signal.signalType === 'SHORT');

    return {
      invKey,
      backtestDate: currentDate,
      pivotPoints,
      totalCandlesAnalyzed: backtestCandles.length,
      signalsDetected: signals.length,
      longSignalsDetected: longSignals.length,
      shortSignalsDetected: shortSignals.length,
      signals,
      candles: backtestCandles
    };
  }
}

module.exports = StockDataService;
