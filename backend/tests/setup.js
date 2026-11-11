const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/common/db');
const Check = require('../src/checks/check.model');

// Override DB to use separate test database
process.env.NODE_ENV = 'test';
process.env.MONGO_DB = process.env.MONGO_DB_TEST || 'upwatch_test';

let setupDone = false;

async function setupTestDB() {
  if (!setupDone) {
    const mongoUser = process.env.MONGO_ROOT_USER;
    const mongoPassword = process.env.MONGO_ROOT_PASSWORD;
    const mongoHost = process.env.MONGO_HOST || '127.0.0.1';
    const mongoPort = process.env.MONGO_PORT || '27018';
    const testDb = 'upwatch_test';

    const testUri = mongoUser && mongoPassword
      ? `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPassword)}@${mongoHost}:${mongoPort}/${testDb}?authSource=admin`
      : `mongodb://${mongoHost}:${mongoPort}/${testDb}`;

    await connectDB(testUri);

    // Drop database at start as required by spec
    await mongoose.connection.dropDatabase();

    // Ensure models create indexes (including TTL)
    await Check.createIndexes();

    setupDone = true;
  }
}

async function tearDownTestDB() {
  await disconnectDB();
}

module.exports = {
  setupTestDB,
  tearDownTestDB,
};
