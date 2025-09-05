const express = require("express");
const StockController = require("../controllers/StockController");

const router = express.Router();
const stockController = new StockController();

router.get("/fetch-stock-data", stockController.fetchStockData.bind(stockController));
router.get("/backtest/:inv_key/:date", stockController.backtest.bind(stockController));
router.get("/backtest-all/:date", stockController.backtestAll.bind(stockController));
router.get("/search-stocks", stockController.searchStocks.bind(stockController));
router.post("/test-strategy", stockController.testStrategy.bind(stockController));

module.exports = router;
