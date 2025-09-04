const fs = require("fs");

const stockSymbols = [
  "HDFCBANK",
  "ICICIBANK",
  "AXISBANK",
  "SBIN",
  "INFY",
  "TECHM",
  "HCLTECH",
  "ITC",
  "DABUR",
  "SUNPHARMA",
  "DRREDDY",
  "CIPLA",
  "TATAMOTORS",
  "RELIANCE",
  "ONGC",
  "NTPC",
  "POWERGRID",
  "TATASTEEL",
  "JSWSTEEL",
  "HINDALCO",
  "DLF",
  "MOTILALOFS",
  "OIL",
  "VOLTAS",
  "KPITTECH",
  "HAVELLS",
  "TATAPOWER",
  "BHARATFORG",
  "UNITDSPR",
  "UBL",
];

// Read original file
const rawData = fs.readFileSync("NSE_EQ.json");
const data = JSON.parse(rawData);

// Step 1: Filter only NSE_EQ
const filtered = data.filter((obj) => obj.segment === "NSE_EQ" && stockSymbols.includes(obj.trading_symbol));

// Step 2: Map new object structure
const mapped = filtered.map((obj) => ({
  [obj.trading_symbol]: obj.instrument_key,
}));

// Write to new file
fs.writeFileSync("symbols_keys.json", JSON.stringify(mapped, null, 2));

console.log(`Mapped ${mapped.length} records saved to symbols_keys.json`);
