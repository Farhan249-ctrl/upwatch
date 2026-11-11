const http = require('http');
const mongoose = require('mongoose');
const Monitor = require('../src/monitors/monitor.model');
const Incident = require('../src/incidents/incident.model');
const { runCheckAndProcess } = require('../src/worker/checker');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('d. Worker State Machine Test Suite', () => {
  let server;
  let port;
  let currentStatus = 200;
  let testMonitor;

  beforeAll(async () => {
    await setupTestDB();

    server = http.createServer((req, res) => {
      res.writeHead(currentStatus, { 'Content-Type': 'text/plain' });
      res.end(`Status is ${currentStatus}`);
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });

    // Create monitor in UP state initially
    testMonitor = await Monitor.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'State Machine Target',
      url: `http://127.0.0.1:${port}/health`,
      intervalSeconds: 15,
      state: 'UP',
      consecutiveFailures: 0,
      active: true,
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await tearDownTestDB();
  });

  test('one failure keeps the monitor UP', async () => {
    currentStatus = 500;

    await runCheckAndProcess(testMonitor);
    testMonitor = await Monitor.findById(testMonitor._id);

    expect(testMonitor.consecutiveFailures).toBe(1);
    expect(testMonitor.state).toBe('UP');

    const incidents = await Incident.find({ monitorId: testMonitor._id });
    expect(incidents.length).toBe(0);
  });

  test('the second failure makes it DOWN and opens one incident', async () => {
    currentStatus = 500;

    await runCheckAndProcess(testMonitor);
    testMonitor = await Monitor.findById(testMonitor._id);

    expect(testMonitor.consecutiveFailures).toBe(2);
    expect(testMonitor.state).toBe('DOWN');

    const incidents = await Incident.find({ monitorId: testMonitor._id });
    expect(incidents.length).toBe(1);
    expect(incidents[0].resolvedAt).toBeNull();
    expect(incidents[0].startedAt).toBeDefined();
  });

  test('a success makes it UP and resolves the incident with a positive duration', async () => {
    // Wait slightly so resolved duration is positive
    await new Promise((resolve) => setTimeout(resolve, 1100));

    currentStatus = 200;

    await runCheckAndProcess(testMonitor);
    testMonitor = await Monitor.findById(testMonitor._id);

    expect(testMonitor.consecutiveFailures).toBe(0);
    expect(testMonitor.state).toBe('UP');

    const incidents = await Incident.find({ monitorId: testMonitor._id });
    expect(incidents.length).toBe(1);
    expect(incidents[0].resolvedAt).not.toBeNull();
    expect(incidents[0].durationSeconds).toBeGreaterThan(0);
  });
});
