const notifier = {
  alertDown: (monitor, reason) => {
    console.log(`ALERT DOWN: Monitor '${monitor.name}' (${monitor.url}) is DOWN. Reason: ${reason}`);
  },
  alertRecovered: (monitor, durationSeconds) => {
    console.log(`ALERT RECOVERED: Monitor '${monitor.name}' (${monitor.url}) is UP. Outage duration: ${durationSeconds}s`);
  },
};

module.exports = notifier;
