import mongoose, { Schema } from 'mongoose';
import type { ApprovalEntityType, ApprovalStepStatus, UserRole } from '../types';

export interface ApprovalDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any | null;
  entityType: ApprovalEntityType;
  entityId: any | null;
  title: string;
  amount?: number | null;
  requestedBy: any;
  steps: {
    level: number;
    role: UserRole;
    label?: string;
    status: ApprovalStepStatus;
    actedBy?: any | null;
    actedAt?: Date | null;
    comment?: string | null;
  }[];
  currentLevel: number;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  completedAt?: Date | null;
  reminderSentAt?: Date | null;
}

const stepSchema = new Schema(
  {
    level: { type: Number, required: true },
    role: { type: String, required: true },
    label: { type: String, trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending',
    },
    actedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actedAt: { type: Date, default: null },
    comment: { type: String, trim: true, maxlength: 300, default: null },
  },
  { _id: false },
);

const approvalSchema = new Schema<ApprovalDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    entityType: {
      type: String,
      enum: ['expense', 'purchase_order', 'booking', 'custom'],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, min: 0, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    steps: { type: [stepSchema], default: [] },
    currentLevel: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending',
      index: true,
    },
    completedAt: { type: Date, default: null },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

approvalSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Approval = (mongoose.models.Approval ??
  mongoose.model<ApprovalDocument>('Approval', approvalSchema)) as any;

/**
 * Standard approval chains per entity type. The requester automatically clears
 * a step whose role matches their own.
 */
export const APPROVAL_CHAINS: Record<string, UserRole[]> = {
  expense: ['site_engineer', 'project_manager', 'owner'],
  purchase_order: ['supervisor', 'project_manager', 'owner'],
  booking: ['sales_manager', 'owner'],
};
