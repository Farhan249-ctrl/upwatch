const express = require('express');
const { requireAuth } = require('../common/middleware/auth');
const incidentController = require('./incident.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', incidentController.listIncidents);

module.exports = router;
