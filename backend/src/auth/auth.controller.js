const { z } = require('zod');
const authService = require('./auth.service');
const notifier = require('../worker/notifier');

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateAlertsSchema = z.object({
  telegramChatId: z.string().nullable().optional(),
  alertsEnabled: z.boolean().optional(),
});

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

async function updateAlerts(req, res, next) {
  try {
    const user = await authService.updateAlerts(req.user.id, req.body);
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

async function testAlert(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    if (!user.telegramChatId) {
      return res.status(400).json({ error: 'Telegram Chat ID is not configured' });
    }
    await notifier.sendTestAlert(user.telegramChatId);
    return res.status(200).json({ message: 'Test alert sent successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerSchema,
  loginSchema,
  updateAlertsSchema,
  register,
  login,
  me,
  updateAlerts,
  testAlert,
};
