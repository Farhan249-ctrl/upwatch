const mongoose = require('mongoose');
const Monitor = require('../src/monitors/monitor.model');
const { claimDueMonitor } = require('../src/worker/claimer');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('h. Claim Race Test Suite', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await tearDownTestDB();
  });

  test('one due monitor, 10 concurrent claim attempts; assert exactly 1 wins', async () => {
    // Clean up any remaining monitors
    await Monitor.deleteMany({});

    // Create exactly one due active monitor
    const monitor = await Monitor.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Claim Race Contender',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 30,
      active: true,
      nextCheckAt: new Date(Date.now() - 5000), // due 5 seconds ago
    });

    const now = new Date();
    // 10 concurrent claimers
    const claimAttempts = Array.from({ length: 10 }, () => claimDueMonitor(now));
    const results = await Promise.all(claimAttempts);

    const winners = results.filter((res) => res !== null && res !== undefined);
    const losers = results.filter((res) => res === null || res === undefined);

    const claimRaceOutput = `CLAIM RACE: 10 claimers, winners: ${winners.length}`;
    console.log(claimRaceOutput);

    expect(winners.length).toBe(1);
    expect(losers.length).toBe(9);
    expect(winners[0]._id.toString()).toBe(monitor._id.toString());
  });
});
