/**
 * routes/auditLogs.js
 *
 * GET /api/audit-logs  — paginated audit log viewer (admin only)
 */

'use strict';

const express      = require('express');
const AuditLog     = require('../models/AuditLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit-logs?page=1&limit=50&action=&entity=&actorEmpId=&from=&to=
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit   = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip    = (page - 1) * limit;

    const filter = {};

    if (req.query.action) {
      const escaped = req.query.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.action = { $regex: escaped, $options: 'i' };
    }

    if (req.query.entity) {
      const escaped = req.query.entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.entity = { $regex: escaped, $options: 'i' };
    }

    if (req.query.actorEmpId) {
      const escaped = req.query.actorEmpId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.actorEmpId = { $regex: `^${escaped}$`, $options: 'i' };
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({ actorEmpId: 1, actorRole: 1, action: 1, entity: 1, entityId: 1, ip: 1, createdAt: 1 })
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
