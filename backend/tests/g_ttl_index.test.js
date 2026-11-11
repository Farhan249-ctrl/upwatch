const Check = require('../src/checks/check.model');
const config = require('../src/config');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('g. TTL Index Test Suite', () => {
  beforeAll(async () => {
    await setupTestDB();
    await Check.createIndexes();
  });

  afterAll(async () => {
    await tearDownTestDB();
  });

  test('assert the TTL index exists on checks with the configured seconds', async () => {
    const indexes = await Check.collection.indexes();
    const ttlIndex = indexes.find(
      (idx) => idx.key && idx.key.ts === 1 && typeof idx.expireAfterSeconds === 'number'
    );

    expect(ttlIndex).toBeDefined();
    const expectedExpireAfterSeconds = config.CHECK_RETENTION_DAYS * 86400;
    expect(ttlIndex.expireAfterSeconds).toBe(expectedExpireAfterSeconds);
  });
});
