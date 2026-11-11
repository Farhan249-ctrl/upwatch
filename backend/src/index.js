const app = require('./app');
const config = require('./config');
const { connectDB } = require('./common/db');

async function start() {
  await connectDB();
  console.log('Connected to MongoDB');

  const server = app.listen(config.API_PORT, () => {
    console.log(`UpWatch API server running on port ${config.API_PORT}`);
  });

  const shutdown = async signal => {
    console.log(`Received ${signal}, shutting down API server...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start UpWatch API:', err);
    process.exit(1);
  });
}

module.exports = { start };
