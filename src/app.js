const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Import routes
const routes = require('./routes');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', routes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
