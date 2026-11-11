const { claimDueMonitor } = require('./claimer');
const { runCheckAndProcess } = require('./checker');
const config = require('../config');

class Worker {
  constructor(options = {}) {
    this.tickSeconds = options.tickSeconds || config.WORKER_TICK_SECONDS;
    this.concurrency = options.concurrency || config.WORKER_CONCURRENCY;
    this.isRunning = false;
    this.timer = null;
    this.activeChecks = new Set();
  }

  async tick() {
    if (!this.isRunning) return;

    try {
      const claimedMonitors = [];
      const now = new Date();

      // Claim up to concurrency limit
      for (let i = 0; i < this.concurrency; i++) {
        const monitor = await claimDueMonitor(now);
        if (!monitor) break;
        claimedMonitors.push(monitor);
      }

      if (claimedMonitors.length > 0) {
        const checkPromises = claimedMonitors.map(monitor => {
          const promise = runCheckAndProcess(monitor).catch(err => {
            console.error(`Check error for monitor ${monitor._id}:`, err);
          });

          this.activeChecks.add(promise);
          promise.finally(() => this.activeChecks.delete(promise));
          return promise;
        });

        await Promise.allSettled(checkPromises);
      }
    } catch (err) {
      console.error('Worker tick cycle error:', err);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.tick(), this.tickSeconds * 1000);
    // Initial immediate tick
    this.tick();
  }

  async stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.activeChecks.size > 0) {
      await Promise.allSettled(Array.from(this.activeChecks));
    }
  }
}

module.exports = {
  Worker,
};
