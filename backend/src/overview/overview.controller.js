const Monitor = require('../monitors/monitor.model');
const Check = require('../checks/check.model');
const Incident = require('../incidents/incident.model');
const config = require('../config');

async function getOverview(req, res, next) {
  try {
    const range = req.query.range === '7d' ? '7d' : '24h';
    const is7d = range === '7d';
    const durationMs = is7d ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const now = new Date();
    const startTime = new Date(now.getTime() - durationMs);
    const bucketDurationMs = durationMs / 60;
    const degradedMs = config.DEGRADED_MS || 1500;

    const monitors = await Monitor.find({ userId: req.user.id }).lean();

    const counts = {
      up: monitors.filter(m => m.active && m.state === 'UP').length,
      down: monitors.filter(m => m.active && m.state === 'DOWN').length,
      paused: monitors.filter(m => !m.active).length,
    };

    const monitorResults = await Promise.all(
      monitors.map(async monitor => {
        // One aggregation per monitor across 60 buckets
        const pipeline = [
          {
            $match: {
              monitorId: monitor._id,
              ts: { $gte: startTime, $lte: now },
            },
          },
          {
            $group: {
              _id: {
                $min: [
                  59,
                  {
                    $max: [
                      0,
                      {
                        $floor: {
                          $divide: [{ $subtract: ['$ts', startTime] }, bucketDurationMs],
                        },
                      },
                    ],
                  },
                ],
              },
              totalCount: { $sum: 1 },
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
        ];

        const [bucketAggs, latestCheck, openIncidentDoc] = await Promise.all([
          Check.aggregate(pipeline),
          Check.findOne({ monitorId: monitor._id }).sort({ ts: -1 }).lean(),
          Incident.findOne({ monitorId: monitor._id, resolvedAt: null }).sort({ startedAt: -1 }).lean(),
        ]);

        const bucketMap = new Map();
        for (const b of bucketAggs) {
          bucketMap.set(b._id, b);
        }

        const strip = [];
        let totalRangeChecks = 0;
        let totalRangeOkChecks = 0;
        let totalRangeResponseSum = 0;

        for (let i = 0; i < 60; i++) {
          const bucketTime = new Date(startTime.getTime() + i * bucketDurationMs);
          const data = bucketMap.get(i);

          if (!data || data.totalCount === 0) {
            strip.push({
              ts: bucketTime.toISOString(),
              status: 'nodata',
              avgResponseMs: null,
              okCount: 0,
              failCount: 0,
            });
          } else {
            totalRangeChecks += data.totalCount;
            totalRangeOkChecks += data.okCount;
            if (data.okCount > 0 && data.avgResponseMs != null) {
              totalRangeResponseSum += data.avgResponseMs * data.okCount;
            }

            let status = 'nodata';
            if (data.failCount > 0) {
              status = 'down';
            } else if (data.okCount > 0) {
              if (data.avgResponseMs > degradedMs) {
                status = 'degraded';
              } else {
                status = 'up';
              }
            }

            strip.push({
              ts: bucketTime.toISOString(),
              status,
              avgResponseMs: data.avgResponseMs != null ? Number(data.avgResponseMs.toFixed(2)) : null,
              okCount: data.okCount,
              failCount: data.failCount,
            });
          }
        }

        const uptimePercent = totalRangeChecks > 0
          ? Number(((totalRangeOkChecks / totalRangeChecks) * 100).toFixed(2))
          : null;
        const avgResponseMs = totalRangeOkChecks > 0
          ? Number((totalRangeResponseSum / totalRangeOkChecks).toFixed(2))
          : null;

        const openIncident = openIncidentDoc
          ? {
              id: openIncidentDoc._id.toString(),
              startedAt: openIncidentDoc.startedAt,
              durationSeconds: Math.max(
                0,
                Math.round((Date.now() - new Date(openIncidentDoc.startedAt).getTime()) / 1000)
              ),
              reason: openIncidentDoc.reason,
            }
          : null;

        return {
          id: monitor._id.toString(),
          name: monitor.name,
          url: monitor.url,
          state: monitor.state,
          active: monitor.active,
          uptimePercent,
          avgResponseMs,
          lastCheckedAt: monitor.lastCheckedAt,
          lastStatusCode: latestCheck ? latestCheck.statusCode : null,
          openIncident,
          strip,
        };
      })
    );

    // Down monitors sort first, then alphabetical by name
    monitorResults.sort((a, b) => {
      if (a.state === 'DOWN' && b.state !== 'DOWN') return -1;
      if (b.state === 'DOWN' && a.state !== 'DOWN') return 1;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      counts,
      monitors: monitorResults,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
};
