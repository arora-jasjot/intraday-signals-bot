const axios = require("axios");
const config = require("../config");
const symbolsKeys = require("../symbols_keys.json");

const INSTRUMENT_KEY = "NSE_EQ%7CINE002A01018";
const TIMEFRAME = "minutes";
const INTERVAL = 5;
const REQUEST_TIMEOUT = 30000;
const USER_AGENT = "intraday-bot/1.0.0";

class StockDataService {
  getSymbolFromInvKey(invKey) {
    // Decode URL encoded inv_key
    const decodedInvKey = decodeURIComponent(invKey);
    
    // Find symbol in symbols_keys.json
    for (const symbolObj of symbolsKeys) {
      const symbol = Object.keys(symbolObj)[0];
      const key = symbolObj[symbol];
      if (key === decodedInvKey) {
        return symbol;
      }
    }
    
    return "UNKNOWN";
  }

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

    // Check if current date is today (using IST timezone)
    const now = new Date();
const istFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const istToday = istFormatter.format(now); 
    console.log(`Current date: ${currentDate}, IST Today: ${istToday}`);
    const isToday = currentDate === istToday;
    
    let candlesUrl;
    
    if (isToday) {
      // Use intraday URL for today's data
      candlesUrl = `${config.api.externalApiUrl}/intraday/${instrumentKey}/${TIMEFRAME}/${INTERVAL}`;
    } else {
      // Use historical URL for past dates
      candlesUrl = `${config.api.externalApiUrl}/${instrumentKey}/${TIMEFRAME}/${INTERVAL}/${currentDate}/${currentDate}`;
    }

    console.log("Fetching stock data from:", candlesUrl, isToday ? "(Today's data)" : "(Historical data)");
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

    const pivotData = await this.getPivotData(previousDate, INSTRUMENT_KEY);
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

    const candlesData = await this.getCurrentDayData(currentDate, INSTRUMENT_KEY);
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

  cutsTooManyPivots(candle1, candle2, allPivots) {
    // Count how many pivot points each candle cuts through
    const candle1Cuts = this.countPivotsCut(candle1, allPivots);
    const candle2Cuts = this.countPivotsCut(candle2, allPivots);
    
    // Check if either candle cuts more than 1 pivot point
    if (candle1Cuts > 1 || candle2Cuts > 1) {
      return true;
    }
    
    // Check if candle1 and candle2 combined cut more than 1 pivot point
    // This means finding the overall range covered by both candles
    const combinedHigh = Math.max(candle1.high, candle2.high);
    const combinedLow = Math.min(candle1.low, candle2.low);
    
    const combinedCuts = this.countPivotsBetween(combinedLow, combinedHigh, allPivots);
    
    return combinedCuts > 1;
  }

  countPivotsCut(candle, allPivots) {
    let count = 0;
    const candleHigh = Math.max(candle.open, candle.close, candle.high);
    const candleLow = Math.min(candle.open, candle.close, candle.low);
    
    for (const pivot of allPivots) {
      // A candle cuts a pivot if the pivot is between the candle's low and high
      if (pivot >= candleLow && pivot <= candleHigh) {
        count++;
      }
    }
    
    return count;
  }

  countPivotsBetween(low, high, allPivots) {
    let count = 0;
    
    for (const pivot of allPivots) {
      if (pivot >= low && pivot <= high) {
        count++;
      }
    }
    
    return count;
  }

  checkLongSignal(candle1, candle2, pivotPoints) {
    const allPivots = [pivotPoints.PP, pivotPoints.S1, pivotPoints.S2, pivotPoints.S3, pivotPoints.R1, pivotPoints.R2, pivotPoints.R3];
    
    // Check if candle1 or candle2 or both combined cut more than 1 pivot point
    if (this.cutsTooManyPivots(candle1, candle2, allPivots)) {
      return { detected: false };
    }
    
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
    
    // Check if candle1 or candle2 or both combined cut more than 1 pivot point
    if (this.cutsTooManyPivots(candle1, candle2, allPivots)) {
      return { detected: false };
    }
    
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

  calculateStopLossAndTarget(signal, priceAtDetection) {
    if (!priceAtDetection) {
      return { stopLoss: null, target: null };
    }

    let stopLoss, target;

    if (signal.signalType === 'LONG') {
      // For LONG trades:
      // 1. LOW of Candle 1 that cuts PP
      const candle1Low = signal.candle1.low;
      
      // 2. PivotValue - 0.10%
      const pivotMinus01Percent = signal.pivot * (1 - 0.001); // 0.10% = 0.001
      
      // Choose whichever is lower (more restrictive for long trades)
      const calculatedStopLoss = Math.min(candle1Low, pivotMinus01Percent);
      
      // Maximum stop loss = 0.50% below detection price
      const maxStopLoss = priceAtDetection * (1 - 0.005); // 0.50% = 0.005
      
      // Use the higher value (less restrictive) between calculated and max stop loss
      stopLoss = Math.max(calculatedStopLoss, maxStopLoss);
      
      // Calculate target: 1:2 risk-reward ratio
      // Risk = detection price - stop loss
      // Target = detection price + (2 * risk)
      const risk = priceAtDetection - stopLoss;
      target = priceAtDetection + (2 * risk);
      
    } else if (signal.signalType === 'SHORT') {
      // For SHORT trades:
      // 1. HIGH of Candle 1 that cuts PP
      const candle1High = signal.candle1.high;
      
      // 2. PivotValue + 0.10%
      const pivotPlus01Percent = signal.pivot * (1 + 0.001); // 0.10% = 0.001
      
      // Choose whichever is higher (more restrictive for short trades)
      const calculatedStopLoss = Math.max(candle1High, pivotPlus01Percent);
      
      // Maximum stop loss = 0.50% above detection price
      const maxStopLoss = priceAtDetection * (1 + 0.005); // 0.50% = 0.005
      
      // Use the lower value (less restrictive) between calculated and max stop loss
      stopLoss = Math.min(calculatedStopLoss, maxStopLoss);
      
      // Calculate target: 1:2 risk-reward ratio
      // Risk = stop loss - detection price
      // Target = detection price - (2 * risk)
      const risk = stopLoss - priceAtDetection;
      target = priceAtDetection - (2 * risk);
    }

    return {
      stopLoss: Number(stopLoss.toFixed(4)),
      target: Number(target.toFixed(4))
    };
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

  isBeforeThreePM(timestamp) {
    const [time, ampm] = timestamp.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let totalHours = hours;
    if (ampm === 'PM' && hours !== 12) {
      totalHours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      totalHours = 0;
    }
    
    const totalMinutes = totalHours * 60 + minutes;
    const threePMMinutes = 15 * 60; // 3:00 PM = 15:00 = 15 * 60 minutes
    
    return totalMinutes <= threePMMinutes;
  }

  checkTradeOutcome(signalType, entryPrice, stopLoss, target, candles, startIndex) {
    if (!entryPrice || !stopLoss || !target) {
      console.log(`Invalid prices - Entry: ${entryPrice}, Stop Loss: ${stopLoss}, Target: ${target}`);
      return 0; // No valid prices
    }

    console.log(`\n=== CHECKING TRADE OUTCOME ===`);
    console.log(`Signal Type: ${signalType}`);
    console.log(`Entry Price: ${entryPrice}`);
    console.log(`Stop Loss: ${stopLoss}`);
    console.log(`Target: ${target}`);
    console.log(`Start Index: ${startIndex}`);
    console.log(`Total candles available: ${candles.length}`);
    console.log(`Checking from candle index ${startIndex} onwards until 3:00 PM`);
    console.log(`================================\n`);

    let candleCount = 0;
    
    // Check all candles from startIndex onwards until 3:00 PM
    for (let i = startIndex; i < candles.length; i++) {
      const candle = candles[i];
      candleCount++;
      
      console.log(`[${candleCount}] Candle ${i}: ${candle.timestamp}`);
      console.log(`    Open: ${candle.open}, High: ${candle.high}, Low: ${candle.low}, Close: ${candle.close}`);
      
      // Stop checking after 3:00 PM
      if (!this.isBeforeThreePM(candle.timestamp)) {
        console.log(`    ⏰ STOPPING - ${candle.timestamp} is after 3:00 PM`);
        break;
      }

      if (signalType === 'LONG') {
        console.log(`    📈 LONG trade check:`);
        console.log(`       Stop Loss check: ${candle.low} <= ${stopLoss} ? ${candle.low <= stopLoss}`);
        console.log(`       Target check: ${candle.high} >= ${target} ? ${candle.high >= target}`);
        
        // For LONG trades: check if price goes below stop loss or high reaches/exceeds target
        if (candle.low <= stopLoss) {
          console.log(`    ❌ LONG STOP LOSS HIT at ${candle.timestamp}`);
          console.log(`       Candle Low (${candle.low}) <= Stop Loss (${stopLoss})`);
          return -1; // Stop loss hit
        }
        if (candle.high >= target) {
          console.log(`    ✅ LONG TARGET HIT at ${candle.timestamp}`);
          console.log(`       Candle High (${candle.high}) >= Target (${target})`);
          return 2; // Target hit
        }
        console.log(`    ⏳ Continue checking...`);
        
      } else if (signalType === 'SHORT') {
        console.log(`    📉 SHORT trade check:`);
        console.log(`       Stop Loss check: ${candle.high} >= ${stopLoss} ? ${candle.high >= stopLoss}`);
        console.log(`       Target check: ${candle.low} <= ${target} ? ${candle.low <= target}`);
        
        // For SHORT trades: check if price goes above stop loss or low reaches/goes below target
        if (candle.high >= stopLoss) {
          console.log(`    ❌ SHORT STOP LOSS HIT at ${candle.timestamp}`);
          console.log(`       Candle High (${candle.high}) >= Stop Loss (${stopLoss})`);
          return -1; // Stop loss hit
        }
        if (candle.low <= target) {
          console.log(`    ✅ SHORT TARGET HIT at ${candle.timestamp}`);
          console.log(`       Candle Low (${candle.low}) <= Target (${target})`);
          return 2; // Target hit
        }
        console.log(`    ⏳ Continue checking...`);
      }
      console.log(``);
    }

    console.log(`⏰ END OF ANALYSIS: Checked ${candleCount} candles until 3:00 PM`);
    console.log(`❌ No target or stop loss hit by 3:00 PM - returning 0`);
    console.log(`=======================================\n`);
    return 0; // Neither target nor stop loss hit by 3:00 PM
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

    // Filter candles for signal detection (9:20 AM to 11:20 AM)
    const signalDetectionCandles = allCandles.filter(candle => 
      this.isWithinBacktestTimeRange(candle.timestamp)
    );

    console.log(`Signal detection from ${signalDetectionCandles.length} candles (9:20 AM to 11:20 AM)`);
    console.log(`Total candles available for outcome checking: ${allCandles.length} (until market close)`);

    const signals = [];

    // Check each pair of consecutive candles for signals (only in 9:20-11:20 range)
    // Stop after finding the first signal (1 signal per stock per day maximum)
    for (let i = 0; i < signalDetectionCandles.length - 1; i++) {
      const candle1 = signalDetectionCandles[i];
      const candle2 = signalDetectionCandles[i + 1];
      
      const signal = this.checkTradingSignals(candle1, candle2, pivotPoints);
      
      if (signal.detected) {
        const nextCandleTime = this.getNextCandleTime(candle2.timestamp);
        console.log(`${signal.signalType} Detected at ${nextCandleTime} - First signal for this stock today`);
        
        // Find the next candle in ALL candles (for price at detection)
        let priceAtDetection = null;
        let nextCandleIndexInAllCandles = -1;
        
        // Find the index of candle2 in the full allCandles array
        const candle2IndexInAll = allCandles.findIndex(c => 
          c.timestamp === candle2.timestamp && 
          c.open === candle2.open && 
          c.close === candle2.close
        );
        
        if (candle2IndexInAll >= 0 && candle2IndexInAll + 1 < allCandles.length) {
          nextCandleIndexInAllCandles = candle2IndexInAll + 1;
          priceAtDetection = allCandles[nextCandleIndexInAllCandles].open;
        }
        
        // Calculate stop loss and target
        const { stopLoss, target } = this.calculateStopLossAndTarget(signal, priceAtDetection);
        
        // Check if target or stop loss is hit from detection time to 3:00 PM using ALL candles
        const tradeReturn = this.checkTradeOutcome(
          signal.signalType, 
          priceAtDetection, 
          stopLoss, 
          target, 
          allCandles, // Use ALL candles for outcome checking
          nextCandleIndexInAllCandles >= 0 ? nextCandleIndexInAllCandles : candle2IndexInAll + 1
        );
        
        const signalData = {
          signalType: signal.signalType,
          detectionTime: nextCandleTime,
          priceAtDetection: priceAtDetection,
          stopLoss: stopLoss,
          target: target,
          return: tradeReturn
        };
        
        signals.push(signalData);
        
        // Break after finding the first signal - only 1 signal per stock per day
        console.log(`Stopping signal detection for this stock after finding first signal`);
        break;
      }
    }

    // Count signals by type
    const longSignals = signals.filter(signal => signal.signalType === 'LONG');
    const shortSignals = signals.filter(signal => signal.signalType === 'SHORT');

    return {
      symbol: this.getSymbolFromInvKey(invKey),
      backtestDate: currentDate,
      signals
    };
  }

  async runBacktestAll(previousDate, currentDate) {
    console.log(`Starting backtest for ALL symbols on ${currentDate} using previous day ${previousDate}`);
    
    const results = [];
    const errors = [];
    
    // Extract all inv_keys from symbols_keys.json
    const allInvKeys = symbolsKeys.map(symbolObj => {
      const symbol = Object.keys(symbolObj)[0];
      return symbolObj[symbol];
    });

    console.log(`Processing ${allInvKeys.length} symbols for backtest`);

    // Process all symbols with limited concurrency to avoid overwhelming the API
    const batchSize = 5; // Process 5 symbols at a time
    for (let i = 0; i < allInvKeys.length; i += batchSize) {
      const batch = allInvKeys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (invKey) => {
        try {
          const result = await this.runBacktest(invKey, previousDate, currentDate);
          return { success: true, data: result };
        } catch (error) {
          console.error(`Failed to process ${this.getSymbolFromInvKey(invKey)} (${invKey}):`, error.message);
          return {
            success: false,
            invKey,
            symbol: this.getSymbolFromInvKey(invKey),
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Separate successful results from errors, only include results with signals
      batchResults.forEach(result => {
        if (result.success) {
          // Only include results that have signals detected
          if (result.data.signals && result.data.signals.length > 0) {
            results.push(result.data);
          }
        } else {
          errors.push({
            invKey: result.invKey,
            symbol: result.symbol,
            error: result.error
          });
        }
      });

      // Small delay between batches to be respectful to the API
      if (i + batchSize < allInvKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Backtest completed. Symbols with signals: ${results.length}, Failed: ${errors.length}`);

    // Return results with summary
    return {
      totalSymbols: allInvKeys.length,
      symbolsWithSignals: results.length,
      failedBacktests: errors.length,
      backtestDate: currentDate,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async searchCurrentStocks(previousDate, currentDate) {
    console.log(`Starting current stock search on ${currentDate} using pivot from ${previousDate}`);
    
    const results = [];
    const errors = [];
    
    // Extract all inv_keys from symbols_keys.json
    const allInvKeys = symbolsKeys.map(symbolObj => {
      const symbol = Object.keys(symbolObj)[0];
      return symbolObj[symbol];
    });

    console.log(`Processing ${allInvKeys.length} symbols for current search (last 2 candles only)`);

    // Process all symbols with limited concurrency to avoid overwhelming the API
    const batchSize = 5; // Process 5 symbols at a time
    for (let i = 0; i < allInvKeys.length; i += batchSize) {
      const batch = allInvKeys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (invKey) => {
        try {
          const result = await this.runCurrentSearch(invKey, previousDate, currentDate);
          return { success: true, data: result };
        } catch (error) {
          console.error(`Failed to process ${this.getSymbolFromInvKey(invKey)} (${invKey}):`, error.message);
          return {
            success: false,
            invKey,
            symbol: this.getSymbolFromInvKey(invKey),
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Separate successful results from errors, only include results with signals
      batchResults.forEach(result => {
        if (result.success) {
          // Only include results that have signals detected
          if (result.data.signals && result.data.signals.length > 0) {
            results.push(result.data);
          }
        } else {
          errors.push({
            invKey: result.invKey,
            symbol: result.symbol,
            error: result.error
          });
        }
      });

      // Small delay between batches to be respectful to the API
      if (i + batchSize < allInvKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Current stock search completed. Symbols with signals: ${results.length}, Failed: ${errors.length}`);

    // Return results with summary
    return {
      totalSymbols: allInvKeys.length,
      symbolsWithSignals: results.length,
      failedSearches: errors.length,
      searchDate: currentDate,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async runCurrentSearch(invKey, previousDate, currentDate) {
    if (!config.api.externalApiUrl) {
      throw new Error("External API URL not configured");
    }

    console.log(`Starting current search for ${this.getSymbolFromInvKey(invKey)} on ${currentDate}`);

    // Fetch previous day data for pivot calculation
    const pivotData = await this.getPivotData(previousDate, invKey);
    if (!pivotData) {
      throw new Error("Failed to fetch pivot data for previous day");
    }

    // Calculate pivot points from previous day
    const pivotPoints = this.calculatePivotPoints(pivotData.data.candles);

    // Fetch current day 5-minute candle data
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

    // Filter candles for signal detection (9:20 AM to 11:20 AM) to ensure we're in trading hours
    const signalDetectionCandles = allCandles.filter(candle => 
      this.isWithinBacktestTimeRange(candle.timestamp)
    );

    // Get only the last 2 candles for current search from signal detection range
    if (signalDetectionCandles.length < 2) {
      return {
        symbol: this.getSymbolFromInvKey(invKey),
        backtestDate: currentDate,
        signals: []
      };
    }

    const lastTwoCandles = signalDetectionCandles.slice(-2);
    const candle1 = lastTwoCandles[0]; // candle[-2]
    const candle2 = lastTwoCandles[1]; // candle[-1]

    console.log(`Analyzing last 2 candles for ${this.getSymbolFromInvKey(invKey)}: ${candle1.timestamp} and ${candle2.timestamp}`);
    console.log(`Total candles available for outcome checking: ${allCandles.length} (until current time)`);

    const signals = [];

    // Check the last two candles for trading signals
    // For current search, we only check the most recent 2 candles (1 signal per stock per day maximum)
    const signal = this.checkTradingSignals(candle1, candle2, pivotPoints);
    
    if (signal.detected) {
      const nextCandleTime = this.getNextCandleTime(candle2.timestamp);
      console.log(`${signal.signalType} Detected for ${this.getSymbolFromInvKey(invKey)} at ${nextCandleTime} - First signal for this stock today`);
      
      // For current search, we might not have the next candle yet
      // So we'll use the close price of candle2 as the best available price
      const priceAtDetection = candle2.close;
      
      // Calculate stop loss and target
      const { stopLoss, target } = this.calculateStopLossAndTarget(signal, priceAtDetection);
      
      // Find the index of candle2 in the full allCandles array for outcome checking
      const candle2IndexInAll = allCandles.findIndex(c => 
        c.timestamp === candle2.timestamp && 
        c.open === candle2.open && 
        c.close === candle2.close
      );
      
      // For current search, check outcome from available candles after detection using ALL candles
      const tradeReturn = this.checkTradeOutcome(
        signal.signalType, 
        priceAtDetection, 
        stopLoss, 
        target, 
        allCandles, // Use ALL candles for outcome checking
        candle2IndexInAll >= 0 ? candle2IndexInAll + 1 : allCandles.length - 1
      );
      
      const signalData = {
        signalType: signal.signalType,
        detectionTime: nextCandleTime,
        priceAtDetection: priceAtDetection,
        stopLoss: stopLoss,
        target: target,
        return: tradeReturn
      };
      
      signals.push(signalData);
      console.log(`Signal added for ${this.getSymbolFromInvKey(invKey)} - Only 1 signal per stock per day`);
    } else {
      console.log(`No signal detected for ${this.getSymbolFromInvKey(invKey)} in the last 2 candles`);
    }

    // Count signals by type
    const longSignals = signals.filter(signal => signal.signalType === 'LONG');
    const shortSignals = signals.filter(signal => signal.signalType === 'SHORT');

    return {
      symbol: this.getSymbolFromInvKey(invKey),
      backtestDate: currentDate,
      signals
    };
  }

  async testStrategyForInstruments(invKeys, previousDate, currentDate) {
    console.log(`Starting strategy test for ${invKeys.length} instruments on ${currentDate} using pivot from ${previousDate}`);
    
    const results = [];
    const errors = [];
    
    console.log(`Processing ${invKeys.length} instruments for strategy test`);

    // Process all instruments with limited concurrency to avoid overwhelming the API
    const batchSize = 5; // Process 5 instruments at a time
    for (let i = 0; i < invKeys.length; i += batchSize) {
      const batch = invKeys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (invKey) => {
        try {
          const result = await this.runBacktest(invKey, previousDate, currentDate);
          return { success: true, data: result };
        } catch (error) {
          console.error(`Failed to process ${this.getSymbolFromInvKey(invKey)} (${invKey}):`, error.message);
          return {
            success: false,
            invKey,
            symbol: this.getSymbolFromInvKey(invKey),
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Separate successful results from errors, only include results with signals
      batchResults.forEach(result => {
        if (result.success) {
          // Only include results that have signals detected
          if (result.data.signals && result.data.signals.length > 0) {
            results.push(result.data);
          }
        } else {
          errors.push({
            invKey: result.invKey,
            symbol: result.symbol,
            error: result.error
          });
        }
      });

      // Small delay between batches to be respectful to the API
      if (i + batchSize < invKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Strategy test completed. Processed: ${results.length}, Failed: ${errors.length}`);

    // Calculate summary statistics
    const totalSignals = results.reduce((sum, result) => sum + result.signals.length, 0);
    const totalLongSignals = results.reduce((sum, result) => 
      sum + result.signals.filter(signal => signal.signalType === 'LONG').length, 0);
    const totalShortSignals = results.reduce((sum, result) => 
      sum + result.signals.filter(signal => signal.signalType === 'SHORT').length, 0);
    
    // Calculate total return by summing all signal returns
    const totalReturn = results.reduce((sum, result) => 
      sum + result.signals.reduce((signalSum, signal) => signalSum + signal.return, 0), 0);
    
    // Calculate processed instruments (successful + failed)
    const processedInstruments = invKeys.length - errors.length;

    // Return results with summary
    return {
      totalInstruments: invKeys.length,
      processedInstruments: processedInstruments,
      failedInstruments: errors.length,
      symbolsWithSignals: results.length, // results array now only contains symbols with signals
      totalSignalsDetected: totalSignals,
      totalLongSignals: totalLongSignals,
      totalShortSignals: totalShortSignals,
      totalReturn: totalReturn,
      testDate: currentDate,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

module.exports = StockDataService;
