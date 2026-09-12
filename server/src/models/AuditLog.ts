import mongoose, { Schema } from 'mongoose';

export interface AuditLogDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  userId: any;
  userName?: string;
  userRole?: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  description: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String, trim: true },
    userRole: { type: String, trim: true },
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    entityType: { type: String, trim: true },
    entityId: { type: String, trim: true },
    description: { type: String, required: true, maxlength: 500 },
    meta: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ companyId: 1, createdAt: -1 });

auditLogSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const AuditLog = (mongoose.models.AuditLog ??
  mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema)) as any;
