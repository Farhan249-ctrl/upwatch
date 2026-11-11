const { Agent, request, interceptors } = require('undici');
const Check = require('../checks/check.model');
const Incident = require('../incidents/incident.model');
const notifier = require('./notifier');
const config = require('../config');

// Standard agent with certificate verification and up to 5 redirects
const secureAgent = new Agent({
  connect: { rejectUnauthorized: true },
}).compose(interceptors.redirect({ maxRedirections: 5 }));

// Insecure agent for self-signed certificates
const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
}).compose(interceptors.redirect({ maxRedirections: 5 }));

async function executeHttpCheck(monitor) {
  const timeoutMs = monitor.timeoutMs || 10000;
  const dispatcher = monitor.allowSelfSigned ? insecureAgent : secureAgent;
  const start = process.hrtime.bigint();

  let ok = false;
  let statusCode = null;
  let error = null;

  try {
    const res = await request(monitor.url, {
      method: 'GET',
      dispatcher,
      headers: {
        'User-Agent': 'UpWatch/1.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    statusCode = res.statusCode;
    // Consume the body stream to free the socket
    await res.body.dump();

    if (monitor.expectedStatus && monitor.expectedStatus.length > 0) {
      ok = monitor.expectedStatus.includes(statusCode);
    } else {
      ok = statusCode >= 200 && statusCode <= 399;
    }

    if (!ok) {
      error = `HTTP status ${statusCode} not in expected range`;
    }
  } catch (err) {
    ok = false;
    error = err.message || String(err);
  }

  const end = process.hrtime.bigint();
  const responseMs = Math.max(1, Number((end - start) / 1000000n));

  return {
    ok,
    statusCode,
    responseMs,
    error,
  };
}

async function processCheckResult(monitor, checkResult) {
  const check = await Check.create({
    monitorId: monitor._id,
    ts: new Date(),
    ok: checkResult.ok,
    statusCode: checkResult.statusCode,
    responseMs: checkResult.responseMs,
    error: checkResult.error || null,
  });

  monitor.lastCheckedAt = check.ts;
  const failureThreshold = config.FAILURE_THRESHOLD || 2;

  if (!checkResult.ok) {
    monitor.consecutiveFailures = (monitor.consecutiveFailures || 0) + 1;
    if (!monitor.firstFailureAt) {
      monitor.firstFailureAt = check.ts;
    }

    if (monitor.consecutiveFailures >= failureThreshold) {
      if (monitor.state !== 'DOWN') {
        monitor.state = 'DOWN';
        const reason = checkResult.error || `HTTP ${checkResult.statusCode}`;
        await Incident.create({
          monitorId: monitor._id,
          startedAt: monitor.firstFailureAt,
          resolvedAt: null,
          durationSeconds: null,
          reason,
        });
        notifier.alertDown(monitor, reason);
      }
    }
  } else {
    // Check succeeded
    if (monitor.state === 'DOWN') {
      monitor.state = 'UP';
      const incident = await Incident.findOne({
        monitorId: monitor._id,
        resolvedAt: null,
      }).sort({ startedAt: -1 });

      let durationSeconds = 0;
      if (incident) {
        incident.resolvedAt = check.ts;
        durationSeconds = Math.max(
          1,
          Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 1000)
        );
        incident.durationSeconds = durationSeconds;
        await incident.save();
      }
      notifier.alertRecovered(monitor, durationSeconds);
    } else {
      monitor.state = 'UP';
    }

    monitor.consecutiveFailures = 0;
    monitor.firstFailureAt = null;
  }

  await monitor.save();
  return { check, monitor };
}

async function runCheckAndProcess(monitor) {
  const result = await executeHttpCheck(monitor);
  return processCheckResult(monitor, result);
}

module.exports = {
  executeHttpCheck,
  processCheckResult,
  runCheckAndProcess,
  secureAgent,
  insecureAgent,
};
