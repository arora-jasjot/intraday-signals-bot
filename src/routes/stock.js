const express = require("express");
const StockController = require("../controllers/StockController");

const router = express.Router();
const stockController = new StockController();

router.get("/fetch-stock-data", stockController.fetchStockData.bind(stockController));
router.get("/backtest/:inv_key/:date", stockController.backtest.bind(stockController));

module.exports = router;
