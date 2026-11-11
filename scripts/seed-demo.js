const path = require('path');
// Allow resolving dependencies from backend/node_modules
const backendNodeModules = path.resolve(__dirname, '../backend/node_modules');
module.paths.push(backendNodeModules);

const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Load environment from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const config = require('../backend/src/config');
const { connectDB, disconnectDB } = require('../backend/src/common/db');
const User = require('../backend/src/auth/user.model');
const Monitor = require('../backend/src/monitors/monitor.model');
const Check = require('../backend/src/checks/check.model');
const Incident = require('../backend/src/incidents/incident.model');

async function clearDemoData() {
  console.log('Clearing existing demo data...');
  const demoEmail = (config.DEMO_EMAIL || 'demo@upwatch.dev').toLowerCase().trim();
  const demoUser = await User.findOne({ email: demoEmail });

  const monitorConditions = [{ name: { $regex: /^Demo:/i } }];
  if (demoUser) {
    monitorConditions.push({ userId: demoUser._id });
  }

  const demoMonitors = await Monitor.find({ $or: monitorConditions });
  const demoMonitorIds = demoMonitors.map(m => m._id);

  if (demoMonitorIds.length > 0) {
    const checksDeleted = await Check.deleteMany({ monitorId: { $in: demoMonitorIds } });
    const incidentsDeleted = await Incident.deleteMany({ monitorId: { $in: demoMonitorIds } });
    const monitorsDeleted = await Monitor.deleteMany({ _id: { $in: demoMonitorIds } });
    console.log(
      `Deleted ${monitorsDeleted.deletedCount} demo monitors, ${checksDeleted.deletedCount} checks, and ${incidentsDeleted.deletedCount} incidents.`
    );
  }

  if (demoUser) {
    await User.deleteOne({ _id: demoUser._id });
    console.log(`Deleted demo user: ${demoEmail}`);
  }

  console.log('Demo data clearance complete.');
}

async function seedDemoData() {
  await clearDemoData();

  console.log('Seeding fresh demo data...');
  const demoEmail = (config.DEMO_EMAIL || 'demo@upwatch.dev').toLowerCase().trim();
  const demoPassword = config.DEMO_PASSWORD || 'DemoSecretPassword123!';
  const degradedMs = config.DEGRADED_MS || 1500;

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const user = await User.create({
    name: 'Demo Student',
    email: demoEmail,
    passwordHash,
    role: 'USER',
    telegramChatId: '123456789',
    alertsEnabled: true,
  });
  console.log(`Created demo user: ${user.email} (Password: ${demoPassword})`);

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const startTime = now - sevenDaysMs;

  // 3 Demo Monitors
  const monitorDefs = [
    {
      name: 'Demo: Student Portfolio API',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 30,
      state: 'UP',
      active: true,
    },
    {
      name: 'Demo: Capstone Project Frontend',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 60,
      state: 'UP',
      active: true,
    },
    {
      name: 'Demo: Analytics Microservice',
      url: 'http://127.0.0.1:4000/api/health',
      intervalSeconds: 30,
      state: 'DOWN',
      active: true,
    },
  ];

  for (let mIdx = 0; mIdx < monitorDefs.length; mIdx++) {
    const def = monitorDefs[mIdx];
    const monitor = await Monitor.create({
      userId: user._id,
      name: def.name,
      url: def.url,
      intervalSeconds: def.intervalSeconds,
      state: def.state,
      active: def.active,
      lastCheckedAt: new Date(now - 15000),
      nextCheckAt: new Date(now + def.intervalSeconds * 1000),
    });

    const checks = [];
    const incidents = [];

    // Outage 1: 4 days ago (lasts 45 minutes)
    const outage1Start = now - 4 * 24 * 60 * 60 * 1000;
    const outage1End = outage1Start + 45 * 60 * 1000;
    incidents.push({
      monitorId: monitor._id,
      startedAt: new Date(outage1Start),
      resolvedAt: new Date(outage1End),
      durationSeconds: 2700,
      reason: 'HTTP status 503 Service Unavailable',
      createdAt: new Date(outage1Start),
    });

    // Outage 2: 1.5 days ago (lasts 18 minutes)
    const outage2Start = now - 36 * 60 * 60 * 1000;
    const outage2End = outage2Start + 18 * 60 * 1000;
    incidents.push({
      monitorId: monitor._id,
      startedAt: new Date(outage2Start),
      resolvedAt: new Date(outage2End),
      durationSeconds: 1080,
      reason: 'Request timed out after 10000ms',
      createdAt: new Date(outage2Start),
    });

    // Slow period: 2.5 days ago (lasts 3 hours)
    const slowStart = now - 60 * 60 * 60 * 1000;
    const slowEnd = slowStart + 3 * 60 * 60 * 1000;

    // Ongoing outage for Monitor 3: started 25 minutes ago
    const ongoingStart = now - 25 * 60 * 1000;
    if (mIdx === 2) {
      incidents.push({
        monitorId: monitor._id,
        startedAt: new Date(ongoingStart),
        resolvedAt: null,
        durationSeconds: null,
        reason: 'Connection refused on port 4000',
        createdAt: new Date(ongoingStart),
      });
    }

    // Step through 7 days in 12-minute steps to build dense strip data
    const stepMs = 12 * 60 * 1000;
    for (let t = startTime; t <= now; t += stepMs) {
      const isOutage1 = t >= outage1Start && t <= outage1End;
      const isOutage2 = t >= outage2Start && t <= outage2End;
      const isOngoing = mIdx === 2 && t >= ongoingStart;
      const isSlow = t >= slowStart && t <= slowEnd;

      if (isOutage1 || isOutage2 || isOngoing) {
        checks.push({
          monitorId: monitor._id,
          ts: new Date(t),
          ok: false,
          statusCode: isOutage1 ? 503 : isOngoing ? null : 504,
          responseMs: isOngoing ? 15 : 10000,
          error: isOutage1
            ? 'HTTP status 503'
            : isOngoing
            ? 'connect ECONNREFUSED 127.0.0.1:4000'
            : 'Gateway Timeout',
        });
      } else if (isSlow) {
        // Slow degraded period
        const slowMs = degradedMs + 200 + Math.floor(Math.random() * 400);
        checks.push({
          monitorId: monitor._id,
          ts: new Date(t),
          ok: true,
          statusCode: 200,
          responseMs: slowMs,
          error: null,
        });
      } else {
        // Normal check with realistic natural variance (80ms - 240ms)
        const variance = Math.floor(Math.sin(t / 3600000) * 35);
        const naturalMs = Math.max(45, 110 + variance + Math.floor(Math.random() * 50));
        checks.push({
          monitorId: monitor._id,
          ts: new Date(t),
          ok: true,
          statusCode: 200,
          responseMs: naturalMs,
          error: null,
        });
      }
    }

    await Check.insertMany(checks);
    await Incident.insertMany(incidents);
    console.log(`Seeded '${monitor.name}' with ${checks.length} checks and ${incidents.length} incidents.`);
  }

  console.log('Demo seed completed successfully!');
}

async function main() {
  await connectDB();
  const isClear = process.argv.includes('--clear') || process.argv.includes('clear');

  try {
    if (isClear) {
      await clearDemoData();
    } else {
      await seedDemoData();
    }
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Seed script error:', err);
    process.exit(1);
  });
}

module.exports = { seedDemoData, clearDemoData };
