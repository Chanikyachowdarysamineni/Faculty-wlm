'use strict';

const AuditLog = require('../models/AuditLog');

const getIp = (req) => {
  if (!req) return '';
  // req.ip is already correct because express has 'trust proxy' set to 1
  return req.ip || req.socket?.remoteAddress || '';
};

const getActor = (req) => ({
  actorEmpId: req?.user?.id || 'system',
  actorRole: req?.user?.role || 'system',
  ip: getIp(req),
  userAgent: String(req?.headers?.['user-agent'] || ''),
});

const logAuditEvent = async ({ req, action, entity, entityId = '', metadata = {} }) => {
  try {
    const actor = getActor(req);
    await AuditLog.create({
      ...actor,
      action,
      entity,
      entityId: String(entityId || ''),
      metadata,
    });
  } catch (err) {
    console.error('[audit] Failed to log audit event:', err.message);
  }
};

module.exports = { logAuditEvent, getIp };
