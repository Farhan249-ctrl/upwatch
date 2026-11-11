const { z } = require('zod');
const monitorService = require('./monitor.service');
const checkService = require('../checks/check.service');
const incidentService = require('../incidents/incident.service');
const Check = require('../checks/check.model');

const createMonitorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().min(1, 'URL is required'),
  intervalSeconds: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(300),
  ]),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
  expectedStatus: z.array(z.number().int()).optional(),
  allowSelfSigned: z.boolean().optional(),
  active: z.boolean().optional(),
});

const patchMonitorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).optional(),
  intervalSeconds: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(300),
  ]).optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
  expectedStatus: z.array(z.number().int()).optional(),
  allowSelfSigned: z.boolean().optional(),
  active: z.boolean().optional(),
});

async function create(req, res, next) {
  try {
    const monitor = await monitorService.createMonitor(req.user.id, req.body);
    return res.status(201).json(monitor);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const monitors = await monitorService.getMonitors(req.user.id);
    return res.status(200).json(monitors);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const monitor = await monitorService.getMonitorById(req.user.id, req.params.id);
    return res.status(200).json(monitor);
  } catch (err) {
    next(err);
  }
}

async function patch(req, res, next) {
  try {
    const monitor = await monitorService.updateMonitor(req.user.id, req.params.id, req.body);
    return res.status(200).json(monitor);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await monitorService.deleteMonitor(req.user.id, req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    // Check ownership first
    await monitorService.getMonitorById(req.user.id, req.params.id);
    const range = req.query.range === '7d' ? '7d' : '24h';
    const stats = await checkService.getMonitorStats(req.params.id, range);
    return res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}

async function getSeries(req, res, next) {
  try {
    // Check ownership first
    await monitorService.getMonitorById(req.user.id, req.params.id);
    const range = req.query.range === '7d' ? '7d' : '24h';
    const series = await checkService.getMonitorSeries(req.params.id, range);
    return res.status(200).json(series);
  } catch (err) {
    next(err);
  }
}

async function getIncidents(req, res, next) {
  try {
    // Check ownership first
    await monitorService.getMonitorById(req.user.id, req.params.id);
    const incidents = await incidentService.getMonitorIncidents(req.params.id);
    return res.status(200).json(incidents);
  } catch (err) {
    next(err);
  }
}

async function getChecks(req, res, next) {
  try {
    await monitorService.getMonitorById(req.user.id, req.params.id);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const checks = await Check.find({ monitorId: req.params.id })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json(checks);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createMonitorSchema,
  patchMonitorSchema,
  create,
  list,
  getOne,
  patch,
  remove,
  getStats,
  getSeries,
  getIncidents,
  getChecks,
};
