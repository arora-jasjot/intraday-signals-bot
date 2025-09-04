const fs = require("fs");

// Read your original JSON file
const rawData = fs.readFileSync("NSE.json");
const data = JSON.parse(rawData);

// Filter objects where segment === "NSE_EQ"
const filtered = data.filter(obj => obj.segment === "NSE_EQ");

// Write the filtered data into a new JSON file
fs.writeFileSync("NSE_EQ.json", JSON.stringify(filtered, null, 2));

console.log(`Filtered ${filtered.length} records saved to NSE_EQ.json`);