const express = require('express');

// Import individual route modules
const homeRoutes = require('./home');
const stockRoutes = require('./stock');

const router = express.Router();

// Use the individual route modules
router.use('/', homeRoutes);
router.use('/', stockRoutes);

module.exports = router;
