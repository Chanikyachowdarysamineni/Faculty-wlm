'use strict';

const { mongoose } = require('../db');

const auditLogSchema = new mongoose.Schema(
  {
    actorEmpId: { type: String, default: 'system' },
    actorRole: { type: String, default: 'system' },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs',
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorEmpId: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

auditLogSchema.pre('updateOne', function immutable(next) {
  next(new Error('AuditLog is immutable and cannot be updated.'));
});
auditLogSchema.pre('findOneAndUpdate', function immutable(next) {
  next(new Error('AuditLog is immutable and cannot be updated.'));
});
auditLogSchema.pre('deleteOne', function immutable(next) {
  next(new Error('AuditLog is immutable and cannot be deleted.'));
});
auditLogSchema.pre('findOneAndDelete', function immutable(next) {
  next(new Error('AuditLog is immutable and cannot be deleted.'));
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
