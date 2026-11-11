const express = require('express');
const { requireAuth } = require('../common/middleware/auth');
const overviewController = require('./overview.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', overviewController.getOverview);

module.exports = router;
