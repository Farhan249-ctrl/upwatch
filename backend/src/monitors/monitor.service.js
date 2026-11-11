const Monitor = require('./monitor.model');
const Check = require('../checks/check.model');
const Incident = require('../incidents/incident.model');
const { validateTargetUrl } = require('../common/targetSafety');
const config = require('../config');

const MAX_MONITORS_PER_USER = 20;

async function createMonitor(userId, data) {
  const count = await Monitor.countDocuments({ userId });
  if (count >= MAX_MONITORS_PER_USER) {
    const error = new Error(`Maximum limit of ${MAX_MONITORS_PER_USER} monitors reached`);
    error.statusCode = 400;
    throw error;
  }

  // Validate URL target safety
  await validateTargetUrl(data.url, config.ALLOW_PRIVATE_TARGETS);

  const monitor = await Monitor.create({
    userId,
    name: data.name.trim(),
    url: data.url.trim(),
    intervalSeconds: data.intervalSeconds,
    timeoutMs: data.timeoutMs != null ? data.timeoutMs : 10000,
    expectedStatus: Array.isArray(data.expectedStatus) ? data.expectedStatus : [],
    allowSelfSigned: data.allowSelfSigned === true,
    active: data.active !== false,
    state: 'UNKNOWN',
    nextCheckAt: new Date(),
  });

  return monitor;
}

async function getMonitors(userId) {
  return Monitor.find({ userId }).sort({ createdAt: -1 });
}

async function getMonitorById(userId, monitorId) {
  const monitor = await Monitor.findOne({ _id: monitorId, userId });
  if (!monitor) {
    const error = new Error('Monitor not found');
    error.statusCode = 404;
    throw error;
  }
  return monitor;
}

async function updateMonitor(userId, monitorId, updates) {
  const monitor = await getMonitorById(userId, monitorId);

  if (updates.url && updates.url.trim() !== monitor.url) {
    await validateTargetUrl(updates.url, config.ALLOW_PRIVATE_TARGETS);
    monitor.url = updates.url.trim();
  }

  if (updates.name !== undefined) monitor.name = updates.name.trim();
  if (updates.intervalSeconds !== undefined) monitor.intervalSeconds = updates.intervalSeconds;
  if (updates.timeoutMs !== undefined) monitor.timeoutMs = updates.timeoutMs;
  if (updates.expectedStatus !== undefined) monitor.expectedStatus = updates.expectedStatus;
  if (updates.allowSelfSigned !== undefined) monitor.allowSelfSigned = updates.allowSelfSigned;

  if (updates.active !== undefined) {
    monitor.active = updates.active;
    if (monitor.active && monitor.nextCheckAt < new Date()) {
      monitor.nextCheckAt = new Date();
    }
  }

  await monitor.save();
  return monitor;
}

async function deleteMonitor(userId, monitorId) {
  const monitor = await getMonitorById(userId, monitorId);

  await Monitor.deleteOne({ _id: monitor._id });
  await Check.deleteMany({ monitorId: monitor._id });
  await Incident.deleteMany({ monitorId: monitor._id });

  return { message: 'Monitor deleted successfully' };
}

module.exports = {
  createMonitor,
  getMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
};
