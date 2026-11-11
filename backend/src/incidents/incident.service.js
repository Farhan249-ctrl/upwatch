const mongoose = require('mongoose');
const Incident = require('./incident.model');

async function getMonitorIncidents(monitorId) {
  const incidents = await Incident.find({
    monitorId: new mongoose.Types.ObjectId(monitorId),
  })
    .sort({ startedAt: -1 })
    .lean();

  return incidents.map(inc => {
    let durationSeconds = inc.durationSeconds;
    if (durationSeconds == null && inc.startedAt) {
      const end = inc.resolvedAt ? new Date(inc.resolvedAt) : new Date();
      durationSeconds = Math.max(0, Math.round((end.getTime() - new Date(inc.startedAt).getTime()) / 1000));
    }
    return {
      id: inc._id.toString(),
      monitorId: inc.monitorId.toString(),
      startedAt: inc.startedAt,
      resolvedAt: inc.resolvedAt,
      durationSeconds,
      reason: inc.reason,
      createdAt: inc.createdAt,
    };
  });
}

module.exports = {
  getMonitorIncidents,
};
