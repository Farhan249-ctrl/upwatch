const Monitor = require('../monitors/monitor.model');
const Incident = require('./incident.model');

async function listIncidents(req, res, next) {
  try {
    const monitors = await Monitor.find({ userId: req.user.id }).lean();
    const monitorMap = new Map(monitors.map(m => [m._id.toString(), m.name]));
    const monitorIds = Array.from(monitorMap.keys());

    const statusFilter = req.query.status;
    const filter = { monitorId: { $in: monitorIds } };

    if (statusFilter === 'open') {
      filter.resolvedAt = null;
    }

    const incidents = await Incident.find(filter).sort({ startedAt: -1 }).lean();

    const result = incidents.map(inc => {
      let durationSeconds = inc.durationSeconds;
      if (durationSeconds == null && inc.startedAt) {
        const end = inc.resolvedAt ? new Date(inc.resolvedAt) : new Date();
        durationSeconds = Math.max(0, Math.round((end.getTime() - new Date(inc.startedAt).getTime()) / 1000));
      }
      return {
        id: inc._id.toString(),
        monitorId: inc.monitorId.toString(),
        monitorName: monitorMap.get(inc.monitorId.toString()) || 'Unknown Monitor',
        startedAt: inc.startedAt,
        resolvedAt: inc.resolvedAt,
        durationSeconds,
        reason: inc.reason,
        createdAt: inc.createdAt,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listIncidents,
};
