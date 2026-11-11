const express = require('express');
const { requireAuth } = require('../common/middleware/auth');
const { validate } = require('../common/middleware/validate');
const monitorController = require('./monitor.controller');

const router = express.Router();

router.use(requireAuth);

router.post('/', validate(monitorController.createMonitorSchema), monitorController.create);
router.get('/', monitorController.list);
router.get('/:id', monitorController.getOne);
router.patch('/:id', validate(monitorController.patchMonitorSchema), monitorController.patch);
router.delete('/:id', monitorController.remove);

router.get('/:id/stats', monitorController.getStats);
router.get('/:id/series', monitorController.getSeries);
router.get('/:id/incidents', monitorController.getIncidents);

module.exports = router;
