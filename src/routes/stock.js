const express = require("express");
const StockController = require("../controllers/StockController");

const router = express.Router();
const stockController = new StockController();

router.get("/fetch-stock-data", stockController.fetchStockData.bind(stockController));

module.exports = router;
