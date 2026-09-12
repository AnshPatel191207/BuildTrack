import mongoose, { Schema } from 'mongoose';
import type { ConstructionStageName, StageStatus } from '../types';

export interface WorkItemDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  nodeId: any | null;
  name: string;
  stageName?: ConstructionStageName | null;
  progressPercentage: number;
  startDate?: Date | null;
  endDate?: Date | null;
  status: StageStatus;
  notes?: string;
  createdBy: any;
}

const workItemSchema = new Schema<WorkItemDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    nodeId: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectNode',
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    stageName: {
      type: String,
      enum: [
        'excavation',
        'foundation',
        'rcc_structure',
        'brickwork',
        'plaster',
        'electrical',
        'plumbing',
        'flooring',
        'painting',
        'finishing',
        'landscaping',
        'handover',
        'custom',
      ],
      default: null,
    },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'on_hold'],
      default: 'not_started',
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

workItemSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const WorkItem = (mongoose.models.WorkItem ??
  mongoose.model<WorkItemDocument>('WorkItem', workItemSchema)) as any;
