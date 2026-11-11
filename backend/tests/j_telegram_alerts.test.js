const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Monitor = require('../src/monitors/monitor.model');
const notifier = require('../src/worker/notifier');
const { processCheckResult } = require('../src/worker/checker');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('j. Telegram Alerts and Notifier Test Suite', () => {
  let token;
  let userId;

  beforeAll(async () => {
    await setupTestDB();

    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alert User',
        email: 'alert_user@example.com',
        password: 'password123',
      });
    token = reg.body.token;
    userId = reg.body.user.id;
  });

  afterAll(async () => {
    await tearDownTestDB();
  });

  test('PATCH /api/auth/me/alerts updates telegram settings', async () => {
    const res = await request(app)
      .patch('/api/auth/me/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        telegramChatId: '987654321',
        alertsEnabled: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.user.telegramChatId).toBe('987654321');
    expect(res.body.user.alertsEnabled).toBe(true);
  });

  test('POST /api/alerts/test sends test alert to caller', async () => {
    const spy = jest.spyOn(notifier, 'sendTelegramMessage').mockResolvedValue(true);

    const res = await request(app)
      .post('/api/alerts/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('987654321', expect.stringContaining('UpWatch Test Alert'));
    spy.mockRestore();
  });

  test('Notifier: one DOWN transition sends exactly one message, repeated failures send none', async () => {
    const sendSpy = jest.spyOn(notifier, 'sendTelegramMessage').mockResolvedValue(true);

    const monitor = await Monitor.create({
      userId: new mongoose.Types.ObjectId(userId),
      name: 'Alert Transition Monitor',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 30,
      state: 'UP',
      consecutiveFailures: 0,
      active: true,
    });

    const failedCheck = {
      ok: false,
      statusCode: 500,
      responseMs: 80,
      error: 'HTTP 500 Internal Server Error',
    };

    // First failure (consecutiveFailures = 1) -> remains UP, no alert sent
    await processCheckResult(monitor, failedCheck);
    expect(sendSpy).not.toHaveBeenCalled();

    // Second failure (consecutiveFailures = 2) -> transitions to DOWN, sends exactly 1 message
    await processCheckResult(monitor, failedCheck);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      '987654321',
      expect.stringContaining('ALERT DOWN')
    );

    // Third failure (repeated failure while DOWN) -> no additional message sent
    await processCheckResult(monitor, failedCheck);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    sendSpy.mockRestore();
  });

  test('Notifier: a send failure does not throw or crash', async () => {
    const sendSpy = jest.spyOn(notifier, 'sendTelegramMessage').mockRejectedValue(new Error('Network failure to api.telegram.org'));

    const monitor = await Monitor.create({
      userId: new mongoose.Types.ObjectId(userId),
      name: 'Resilient Monitor',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 30,
      state: 'UP',
      active: true,
    });

    await expect(notifier.alertDown(monitor, 'Simulated Outage')).resolves.not.toThrow();
    sendSpy.mockRestore();
  });
});
