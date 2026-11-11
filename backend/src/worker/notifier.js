const { request } = require('undici');
const config = require('../config');

const notifier = {
  sendTelegramMessage: async (chatId, text) => {
    if (!chatId) return false;

    const token = config.TELEGRAM_BOT_TOKEN;
    if (!token) {
      // If token is unset, the notifier only logs
      console.log(`[Telegram Log - No Token] Chat: ${chatId} | Message:\n${text}`);
      return true;
    }

    try {
      const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await request(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
        signal: AbortSignal.timeout(5000),
      });

      await res.body.dump();
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (err) {
      // A send failure must be caught and logged and must never crash or slow the worker. Never log the token.
      console.error(`Telegram send failed for chat ${chatId}: ${err.message}`);
      return false;
    }
  },

  alertDown: async (monitor, reason) => {
    const utcTime = new Date().toISOString();
    console.log(`ALERT DOWN: Monitor '${monitor.name}' (${monitor.url}) is DOWN. Reason: ${reason}`);

    try {
      if (monitor.userId) {
        // Dynamically load User model to prevent circular dependency
        const User = require('../auth/user.model');
        const user = await User.findById(monitor.userId).lean();
        if (user && user.alertsEnabled && user.telegramChatId) {
          const message = `🚨 ALERT DOWN\nMonitor: ${monitor.name}\nURL: ${monitor.url}\nReason: ${reason}\nTime (UTC): ${utcTime}`;
          await notifier.sendTelegramMessage(user.telegramChatId, message);
        }
      }
    } catch (err) {
      console.error(`Notifier alertDown error: ${err.message}`);
    }
  },

  alertRecovered: async (monitor, durationSeconds) => {
    const utcTime = new Date().toISOString();
    console.log(
      `ALERT RECOVERED: Monitor '${monitor.name}' (${monitor.url}) is UP. Outage duration: ${durationSeconds}s`
    );

    try {
      if (monitor.userId) {
        const User = require('../auth/user.model');
        const user = await User.findById(monitor.userId).lean();
        if (user && user.alertsEnabled && user.telegramChatId) {
          const message = `✅ ALERT RECOVERED\nMonitor: ${monitor.name}\nURL: ${monitor.url}\nOutage duration: ${durationSeconds}s\nTime (UTC): ${utcTime}`;
          await notifier.sendTelegramMessage(user.telegramChatId, message);
        }
      }
    } catch (err) {
      console.error(`Notifier alertRecovered error: ${err.message}`);
    }
  },

  sendTestAlert: async (chatId) => {
    const utcTime = new Date().toISOString();
    const message = `🔔 UpWatch Test Alert\nTelegram notifications are properly configured.\nTime (UTC): ${utcTime}`;
    return notifier.sendTelegramMessage(chatId, message);
  },
};

module.exports = notifier;
