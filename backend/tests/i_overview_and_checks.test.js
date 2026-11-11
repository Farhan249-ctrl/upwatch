const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Monitor = require('../src/monitors/monitor.model');
const Check = require('../src/checks/check.model');
const Incident = require('../src/incidents/incident.model');
const config = require('../src/config');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('i. Overview, Checks, and Incidents Test Suite', () => {
  let tokenA;
  let tokenB;
  let userAId;
  let monitorA1Id;
  let monitorA2Id;

  beforeAll(async () => {
    await setupTestDB();

    const regA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Overview User A',
        email: 'overview_a@example.com',
        password: 'password123',
      });
    tokenA = regA.body.token;
    userAId = regA.body.user.id;

    const regB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Overview User B',
        email: 'overview_b@example.com',
        password: 'password123',
      });
    tokenB = regB.body.token;

    // Create monitors for User A
    const m1 = await Monitor.create({
      userId: userAId,
      name: 'Monitor A1 Up',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 30,
      state: 'UP',
      active: true,
      lastCheckedAt: new Date(),
    });
    monitorA1Id = m1._id.toString();

    const m2 = await Monitor.create({
      userId: userAId,
      name: 'Monitor A2 Down',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 60,
      state: 'DOWN',
      active: true,
      lastCheckedAt: new Date(),
    });
    monitorA2Id = m2._id.toString();

    // Paused monitor
    await Monitor.create({
      userId: userAId,
      name: 'Monitor A3 Paused',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 60,
      state: 'UP',
      active: false,
    });

    // Create an incident for Monitor A2
    await Incident.create({
      monitorId: m2._id,
      startedAt: new Date(Date.now() - 300000),
      resolvedAt: null,
      reason: 'Server returned HTTP 500',
    });

    // Insert checks for Monitor A1:
    // Some normal checks (up), some degraded checks (> DEGRADED_MS)
    const now = Date.now();
    await Check.insertMany([
      {
        monitorId: m1._id,
        ts: new Date(now - 10000),
        ok: true,
        statusCode: 200,
        responseMs: 120,
      },
      {
        monitorId: m1._id,
        ts: new Date(now - 20000),
        ok: true,
        statusCode: 200,
        responseMs: (config.DEGRADED_MS || 1500) + 300, // degraded check
      },
    ]);

    // Insert checks for Monitor A2: failed check (down)
    await Check.create({
      monitorId: m2._id,
      ts: new Date(now - 15000),
      ok: false,
      statusCode: 500,
      responseMs: 50,
      error: 'HTTP 500',
    });
  });

  afterAll(async () => {
    await tearDownTestDB();
  });

  test('GET /api/overview returns correct counts, monitors, and 60-bucket strips', async () => {
    const res = await request(app)
      .get('/api/overview?range=24h')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('counts');
    expect(res.body.counts.up).toBe(1);
    expect(res.body.counts.down).toBe(1);
    expect(res.body.counts.paused).toBe(1);

    expect(Array.isArray(res.body.monitors)).toBe(true);
    expect(res.body.monitors.length).toBe(3);

    // Down monitors sort first
    expect(res.body.monitors[0].state).toBe('DOWN');

    const m1Data = res.body.monitors.find(m => m.id === monitorA1Id);
    expect(m1Data).toBeDefined();
    expect(m1Data.strip.length).toBe(60);

    // Strip contains valid statuses
    const statuses = m1Data.strip.map(s => s.status);
    expect(statuses).toContain('nodata');
    // At least one bucket should be up or degraded
    expect(statuses.some(s => s === 'up' || s === 'degraded')).toBe(true);

    const m2Data = res.body.monitors.find(m => m.id === monitorA2Id);
    expect(m2Data.openIncident).not.toBeNull();
    expect(m2Data.strip.some(s => s.status === 'down')).toBe(true);
  });

  test('User B cannot see User A monitors in overview', async () => {
    const res = await request(app)
      .get('/api/overview')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.counts.up).toBe(0);
    expect(res.body.counts.down).toBe(0);
    expect(res.body.monitors.length).toBe(0);
  });

  test('GET /api/monitors/:id/checks returns recent checks and honors limit', async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorA1Id}/checks?limit=10`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].monitorId).toBe(monitorA1Id);
  });

  test('User B cannot access User A checks', async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorA1Id}/checks`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  test('GET /api/incidents returns caller incidents with duration and monitorName', async () => {
    const res = await request(app)
      .get('/api/incidents?status=open')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].monitorName).toBe('Monitor A2 Down');
    expect(res.body[0].durationSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body[0].resolvedAt).toBeNull();
  });
});
