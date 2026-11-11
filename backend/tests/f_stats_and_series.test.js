const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Monitor = require('../src/monitors/monitor.model');
const Check = require('../src/checks/check.model');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('f. Stats and Series Test Suite', () => {
  let token;
  let monitorId;
  const now = Date.now();

  beforeAll(async () => {
    await setupTestDB();

    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Stats User',
        email: 'stats@example.com',
        password: 'password123',
      });
    token = reg.body.token;

    const monitor = await Monitor.create({
      userId: new mongoose.Types.ObjectId(reg.body.user.id),
      name: 'Stats Service',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 60,
      state: 'UP',
      active: true,
    });
    monitorId = monitor._id.toString();

    // Insert known checks
    await Check.insertMany([
      {
        monitorId: monitor._id,
        ts: new Date(now - 15 * 60 * 1000), // 15 mins ago
        ok: true,
        statusCode: 200,
        responseMs: 100,
      },
      {
        monitorId: monitor._id,
        ts: new Date(now - 10 * 60 * 1000), // 10 mins ago
        ok: true,
        statusCode: 200,
        responseMs: 200,
      },
      {
        monitorId: monitor._id,
        ts: new Date(now - 5 * 60 * 1000), // 5 mins ago
        ok: false,
        statusCode: 500,
        responseMs: 50,
        error: 'Internal Server Error',
      },
      {
        monitorId: monitor._id,
        ts: new Date(now - 1 * 60 * 1000), // 1 min ago
        ok: true,
        statusCode: 200,
        responseMs: 300,
      },
    ]);
  });

  afterAll(async () => {
    await tearDownTestDB();
  });

  test('computes correct uptimePercent, avgResponseMs, maxResponseMs, totalChecks, failedChecks', async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/stats?range=24h`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalChecks).toBe(4);
    expect(res.body.failedChecks).toBe(1);
    expect(res.body.uptimePercent).toBe(75.0);
    expect(res.body.avgResponseMs).toBe(200.0);
    expect(res.body.maxResponseMs).toBe(300);
  });

  test('returns time series buckets aggregated via $dateTrunc', async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/series?range=24h`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    for (const bucket of res.body) {
      expect(bucket).toHaveProperty('bucket');
      expect(bucket).toHaveProperty('okCount');
      expect(bucket).toHaveProperty('failCount');
      expect(bucket).toHaveProperty('avgResponseMs');
    }

    const totalOk = res.body.reduce((sum, b) => sum + b.okCount, 0);
    const totalFail = res.body.reduce((sum, b) => sum + b.failCount, 0);
    expect(totalOk).toBe(3);
    expect(totalFail).toBe(1);
  });
});
