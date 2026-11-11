const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker } = require('../src/worker/worker');
const { checkHeartbeat } = require('../src/worker/healthcheck');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('k. Worker Heartbeat and Healthcheck Test Suite', () => {
  const tempDir = path.join(os.tmpdir(), `upwatch-heartbeat-test-${Date.now()}`);
  const heartbeatFile = path.join(tempDir, 'worker-heartbeat.txt');

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
    await tearDownTestDB();
  });

  it('fails checkHeartbeat if heartbeat file is missing', () => {
    expect(() => checkHeartbeat(path.join(tempDir, 'nonexistent'))).toThrow(
      /Heartbeat file does not exist/
    );
  });

  it('worker writes heartbeat file on tick', async () => {
    const worker = new Worker({
      heartbeatFile,
      tickSeconds: 5,
      concurrency: 1,
    });
    worker.isRunning = true;

    await worker.tick();

    expect(fs.existsSync(heartbeatFile)).toBe(true);
    const content = fs.readFileSync(heartbeatFile, 'utf8');
    expect(new Date(content).getTime()).not.toBeNaN();

    const result = checkHeartbeat(heartbeatFile, 5);
    expect(result.ok).toBe(true);
    expect(result.ageSec).toBeLessThanOrEqual(5);
  });

  it('fails checkHeartbeat when heartbeat is older than 3x tick seconds', () => {
    // Set file modification time to 30 seconds ago
    const pastTime = (Date.now() - 30000) / 1000;
    fs.utimesSync(heartbeatFile, pastTime, pastTime);

    expect(() => checkHeartbeat(heartbeatFile, 5)).toThrow(/Heartbeat stale/);
  });
});
