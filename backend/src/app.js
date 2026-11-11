const express = require('express');
const helmet = require('helmet');
const authRoutes = require('./auth/auth.routes');
const monitorRoutes = require('./monitors/monitor.routes');
const { errorHandler } = require('./common/middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(express.json());

// Public healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Feature routes
app.use('/api/auth', authRoutes);
app.use('/api/monitors', monitorRoutes);

// Global error handler
app.use(errorHandler);

module.exports = app;
