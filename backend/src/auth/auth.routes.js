const express = require('express');
const { validate } = require('../common/middleware/validate');
const { requireAuth } = require('../common/middleware/auth');
const { authLimiter } = require('../common/middleware/rateLimiter');
const authController = require('./auth.controller');

const router = express.Router();

router.use(authLimiter);

router.post('/register', validate(authController.registerSchema), authController.register);
router.post('/login', validate(authController.loginSchema), authController.login);
router.get('/me', requireAuth, authController.me);
router.patch('/me/alerts', requireAuth, validate(authController.updateAlertsSchema), authController.updateAlerts);

module.exports = router;
