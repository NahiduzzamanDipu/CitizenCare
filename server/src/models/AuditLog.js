import mongoose from 'mongoose';

/**
 * Append-only trail of privileged actions so the admin portal can answer
 * "who changed this, and when".
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, default: '', maxlength: 40 },
    targetId: { type: String, default: '', maxlength: 64 },
    detail: { type: String, default: '', maxlength: 1000 },
    ip: { type: String, default: '', maxlength: 64 },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/** Never let audit bookkeeping break the request it is describing. */
export async function recordAudit(req, entry) {
  try {
    await AuditLog.create({
      actor: req.user?.id,
      actorName: req.dbUser?.name || '',
      actorRole: req.user?.role || '',
      ip: req.ip || '',
      ...entry,
    });
  } catch (err) {
    console.error('audit log failed', err);
  }
}
