const { connectDB, disconnectDB } = require('../common/db');
const { Worker } = require('./worker');
const config = require('../config');

async function main() {
  await connectDB();
  console.log('Worker connected to MongoDB');

  const worker = new Worker();
  worker.start();
  console.log(
    `Worker running: tick=${config.WORKER_TICK_SECONDS}s, concurrency=${config.WORKER_CONCURRENCY}`
  );

  const shutdown = async signal => {
    console.log(`Received ${signal}, gracefully shutting down worker...`);
    await worker.stop();
    await disconnectDB();
    console.log('Worker shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal worker process error:', err);
    process.exit(1);
  });
}

module.exports = { main };
