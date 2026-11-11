const mongoose = require('mongoose');
const Check = require('./check.model');

async function getMonitorStats(monitorId, range = '24h') {
  const durationMs = range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - durationMs);

  const checks = await Check.find({
    monitorId: new mongoose.Types.ObjectId(monitorId),
    ts: { $gte: since },
  }).lean();

  const totalChecks = checks.length;
  if (totalChecks === 0) {
    return {
      uptimePercent: null,
      avgResponseMs: null,
      maxResponseMs: null,
      totalChecks: 0,
      failedChecks: 0,
    };
  }

  const okChecks = checks.filter(c => c.ok);
  const failedChecks = totalChecks - okChecks.length;

  const uptimePercent = Number(((okChecks.length / totalChecks) * 100).toFixed(2));
  const avgResponseMs = okChecks.length > 0
    ? Number((okChecks.reduce((sum, c) => sum + c.responseMs, 0) / okChecks.length).toFixed(2))
    : null;
  const maxResponseMs = okChecks.length > 0
    ? Math.max(...okChecks.map(c => c.responseMs))
    : null;

  return {
    uptimePercent,
    avgResponseMs,
    maxResponseMs,
    totalChecks,
    failedChecks,
  };
}

async function getMonitorSeries(monitorId, range = '24h') {
  const is7d = range === '7d';
  const durationMs = is7d ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - durationMs);

  const unit = is7d ? 'hour' : 'minute';
  const binSize = is7d ? 1 : 5;

  const pipeline = [
    {
      $match: {
        monitorId: new mongoose.Types.ObjectId(monitorId),
        ts: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$ts',
            unit,
            binSize,
          },
        },
        okCount: { $sum: { $cond: ['$ok', 1, 0] } },
        failCount: { $sum: { $cond: ['$ok', 0, 1] } },
        avgResponseMs: {
          $avg: {
            $cond: ['$ok', '$responseMs', null],
          },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $project: {
        _id: 0,
        bucket: '$_id',
        okCount: 1,
        failCount: 1,
        avgResponseMs: {
          $cond: [
            { $eq: ['$avgResponseMs', null] },
            null,
            { $round: ['$avgResponseMs', 2] },
          ],
        },
      },
    },
  ];

  return Check.aggregate(pipeline);
}

module.exports = {
  getMonitorStats,
  getMonitorSeries,
};
