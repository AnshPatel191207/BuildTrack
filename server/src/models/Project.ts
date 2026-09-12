import mongoose, { Schema, type FilterQuery } from 'mongoose';
import type { ProjectStatus } from '../types';
import { utcDay } from '../utils/dates';

export interface ProjectDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  name: string;
  projectCode: string;
  clientName?: string;
  clientPhone?: string;
  location?: string;
  address?: string;
  projectType: string;
  startDate: Date;
  expectedEndDate?: Date;
  budget: number;
  spentAmount: number;
  status: ProjectStatus;
  progressPercentage: number;
  description?: string;
  projectManagerId?: any | null;
}

const projectTypes = [
  'residential',
  'commercial',
  'industrial',
  'renovation',
  'infrastructure',
  'interior',
  'other',
];

const projectSchema = new Schema<ProjectDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    projectCode: { type: String, required: true },
    clientName: { type: String, trim: true, maxlength: 120 },
    clientPhone: { type: String, trim: true },
    location: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300 },
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    siteRadiusMeters: { type: Number, default: 100, min: 20, max: 2000 },
    projectType: {
      type: String,
      enum: projectTypes,
      default: 'residential',
    },
    startDate: { type: Date, default: () => utcDay(new Date()) },
    expectedEndDate: { type: Date },
    budget: { type: Number, default: 0, min: 0 },
    spentAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String, trim: true, maxlength: 1000 },
    projectManagerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

projectSchema.index({ companyId: 1, projectCode: 1 }, { unique: true });

projectSchema.virtual('remainingBudget').get(function (this: ProjectDocument) {
  return Math.round((this.budget - this.spentAmount) * 100) / 100;
});

projectSchema.virtual('budgetUtilization').get(function (this: ProjectDocument) {
  if (!this.budget) return 0;
  return Math.round((this.spentAmount / this.budget) * 1000) / 10;
});

projectSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

/** Next sequential code like PRJ-0001 scoped to a company. */
export async function nextProjectCode(companyId: unknown): Promise<string> {
  const count = await mongoose
    .model('Project')
    .countDocuments({ companyId } as FilterQuery<ProjectDocument>);
  let n = count + 1;
  // Ensure uniqueness even after deletions.
  for (;;) {
    const code = `PRJ-${String(n).padStart(4, '0')}`;
    const exists = await mongoose.model('Project').exists({
      companyId,
      projectCode: code,
    } as FilterQuery<ProjectDocument>);
    if (!exists) return code;
    n += 1;
  }
}

export const Project = (mongoose.models.Project ??
  mongoose.model<ProjectDocument>('Project', projectSchema)) as any;
