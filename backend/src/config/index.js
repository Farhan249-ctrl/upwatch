const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables if not already set
if (!process.env.JWT_SECRET) {
  const rootEnv = path.resolve(__dirname, '../../../.env');
  const cwdEnv = path.resolve(process.cwd(), '.env');

  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  } else if (fs.existsSync(cwdEnv)) {
    dotenv.config({ path: cwdEnv });
  } else {
    dotenv.config();
  }
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET environment variable is required and must be at least 32 characters long. No secret defaults allowed.'
  );
}

const mongoUser = process.env.MONGO_ROOT_USER;
const mongoPassword = process.env.MONGO_ROOT_PASSWORD;
const mongoHost = process.env.MONGO_HOST || '127.0.0.1';
const mongoPort = process.env.MONGO_PORT || '27018';
const mongoDb = process.env.MONGO_DB || 'upwatch';

let mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  if (mongoUser && mongoPassword) {
    mongoUri = `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPassword)}@${mongoHost}:${mongoPort}/${mongoDb}?authSource=admin`;
  } else {
    mongoUri = `mongodb://${mongoHost}:${mongoPort}/${mongoDb}`;
  }
}

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: parseInt(process.env.API_PORT || '4000', 10),
  JWT_SECRET: jwtSecret,
  MONGO_URI: mongoUri,
  MONGO_DB: mongoDb,
  ALLOW_PRIVATE_TARGETS: process.env.ALLOW_PRIVATE_TARGETS === 'true',
  CHECK_RETENTION_DAYS: parseInt(process.env.CHECK_RETENTION_DAYS || '30', 10),
  WORKER_TICK_SECONDS: parseInt(process.env.WORKER_TICK_SECONDS || '5', 10),
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
  FAILURE_THRESHOLD: parseInt(process.env.FAILURE_THRESHOLD || '2', 10),
  DEGRADED_MS: parseInt(process.env.DEGRADED_MS || '1500', 10),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  DEMO_EMAIL: process.env.DEMO_EMAIL || 'demo@upwatch.dev',
  DEMO_PASSWORD: process.env.DEMO_PASSWORD || 'DemoSecretPassword123!',
};

module.exports = config;
