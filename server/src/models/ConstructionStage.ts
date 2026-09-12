import mongoose, { Schema } from 'mongoose';
import type { ConstructionStageName, StageStatus } from '../types';

export interface ConstructionStageDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  name: ConstructionStageName;
  customName?: string | null;
  order: number;
  startDate?: Date | null;
  endDate?: Date | null;
  status: StageStatus;
  progressPercentage: number;
  notes?: string;
}

export const STANDARD_STAGE_NAMES: { value: ConstructionStageName; label: string }[] = [
  { value: 'excavation', label: 'Excavation' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'rcc_structure', label: 'RCC Structure' },
  { value: 'brickwork', label: 'Brickwork' },
  { value: 'plaster', label: 'Plaster' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'painting', label: 'Painting' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'handover', label: 'Handover' },
];

const constructionStageSchema = new Schema<ConstructionStageDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: {
      type: String,
      enum: [...STANDARD_STAGE_NAMES.map((s) => s.value), 'custom'],
      required: true,
    },
    customName: { type: String, trim: true, maxlength: 80, default: null },
    order: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'on_hold'],
      default: 'not_started',
      index: true,
    },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

constructionStageSchema.index(
  { projectId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { name: { $type: 'string' } },
  },
);

constructionStageSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const ConstructionStage = (mongoose.models.ConstructionStage ??
  mongoose.model<ConstructionStageDocument>(
    'ConstructionStage',
    constructionStageSchema,
  )) as any;

/** Seed the canonical stage list for a new project. */
export async function ensureDefaultStages(
  companyId: unknown,
  projectId: unknown,
): Promise<void> {
  const existing = await ConstructionStage.countDocuments({ projectId });
  if (existing > 0) return;
  const docs = STANDARD_STAGE_NAMES.map((s, i) => ({
    companyId,
    projectId,
    name: s.value,
    order: i,
  }));
  await ConstructionStage.insertMany(docs);
}
