const Monitor = require('../monitors/monitor.model');

/**
 * Atomically claims one due monitor by pushing its nextCheckAt forward by its interval.
 * Returns the claimed monitor document or null if no monitor is due.
 */
async function claimDueMonitor(now = new Date()) {
  const claimed = await Monitor.findOneAndUpdate(
    {
      active: true,
      nextCheckAt: { $lte: now },
    },
    [
      {
        $set: {
          nextCheckAt: {
            $add: [now, { $multiply: ['$intervalSeconds', 1000] }],
          },
        },
      },
    ],
    { returnDocument: 'after', updatePipeline: true }
  );

  return claimed;
}

module.exports = {
  claimDueMonitor,
};
