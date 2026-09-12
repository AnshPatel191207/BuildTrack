import mongoose, { Schema } from 'mongoose';

export interface MilestoneDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  name: string;
  description?: string | null;
  dueDate: Date;
  completedAt?: Date | null;
  status: 'upcoming' | 'completed' | 'delayed';
  notifyBeforeDays: number;
}

const milestoneSchema = new Schema<MilestoneDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 500 },
    dueDate: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['upcoming', 'completed', 'delayed'],
      default: 'upcoming',
      index: true,
    },
    notifyBeforeDays: { type: Number, default: 3 },
    delayNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

milestoneSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Milestone = (mongoose.models.Milestone ??
  mongoose.model<MilestoneDocument>('Milestone', milestoneSchema)) as any;

export const DEFAULT_MILESTONES = [
  'Foundation Complete',
  'Structure Complete',
  'Brickwork Complete',
  'Finishing Complete',
  'Handover Ready',
];
