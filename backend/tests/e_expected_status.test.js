const http = require('http');
const mongoose = require('mongoose');
const Monitor = require('../src/monitors/monitor.model');
const { runCheckAndProcess } = require('../src/worker/checker');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('e. Expected Status Test Suite', () => {
  let server;
  let port;

  beforeAll(async () => {
    await setupTestDB();

    server = http.createServer((req, res) => {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized Endpoint');
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await tearDownTestDB();
  });

  test('a monitor expecting [401] is UP when the server returns 401', async () => {
    const monitor = await Monitor.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Auth Protected Monitor',
      url: `http://127.0.0.1:${port}/protected`,
      intervalSeconds: 30,
      expectedStatus: [401],
      state: 'UNKNOWN',
      active: true,
    });

    const { check, monitor: updatedMonitor } = await runCheckAndProcess(monitor);

    expect(check.ok).toBe(true);
    expect(check.statusCode).toBe(401);
    expect(updatedMonitor.state).toBe('UP');
    expect(updatedMonitor.consecutiveFailures).toBe(0);
  });
});
