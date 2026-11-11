const fs = require('fs');
const config = require('../config');

function checkHeartbeat(
  filePath = config.WORKER_HEARTBEAT_FILE,
  tickSeconds = config.WORKER_TICK_SECONDS
) {
  const targetFile = filePath || '/tmp/worker-heartbeat';
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Heartbeat file does not exist: ${targetFile}`);
  }

  const stats = fs.statSync(targetFile);
  const ageSec = (Date.now() - stats.mtimeMs) / 1000;
  const maxAgeSec = (tickSeconds || 5) * 3;

  if (ageSec > maxAgeSec) {
    throw new Error(`Heartbeat stale: age ${ageSec.toFixed(1)}s exceeds max ${maxAgeSec}s`);
  }

  return { ok: true, ageSec };
}

if (require.main === module) {
  try {
    checkHeartbeat();
    process.exit(0);
  } catch (err) {
    console.error(`Worker healthcheck failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { checkHeartbeat };
