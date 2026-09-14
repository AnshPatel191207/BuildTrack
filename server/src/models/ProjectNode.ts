import mongoose, { Schema } from 'mongoose';
import type { StructureNodeType } from '../types';

export interface ProjectNodeDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  parentId: any | null;
  nodeType: StructureNodeType;
  customType?: string | null;
  name: string;
  order: number;
  description?: string;
  progressPercentage: number;
  createdBy: any;
  // Property ERP extensions
  towerNumber?: string;
  totalFloors?: number;
  totalUnits?: number;
}

const projectNodeSchema = new Schema<ProjectNodeDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'ProjectNode', default: null, index: true },
    nodeType: {
      type: String,
      enum: ['phase', 'block', 'tower', 'floor', 'unit', 'zone', 'area', 'custom'],
      required: true,
      index: true,
    },
    customType: { type: String, trim: true, maxlength: 40, default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    order: { type: Number, default: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Property ERP extensions
    towerNumber: { type: String, trim: true, default: null },
    totalFloors: { type: Number, default: 0, min: 0 },
    totalUnits: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

projectNodeSchema.index(
  { projectId: 1, parentId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
projectNodeSchema.index({ companyId: 1, projectId: 1, nodeType: 1 });

projectNodeSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const ProjectNode = (mongoose.models.ProjectNode ??
  mongoose.model<ProjectNodeDocument>('ProjectNode', projectNodeSchema)) as any;

/**
 * Recompute a node's progress as the average of its direct children — both
 * sub-levels and work items attached directly to it.
 */
export async function recalcNodeProgress(nodeId: unknown): Promise<number> {
  const { WorkItem } = await import('./WorkItem.js');
  const [children, items] = await Promise.all([
    ProjectNode.find({ parentId: nodeId }).select('progressPercentage'),
    WorkItem.find({ nodeId }).select('progressPercentage'),
  ]);
  const values = [
    ...children.map((c: any) => c.progressPercentage ?? 0),
    ...items.map((i: any) => i.progressPercentage ?? 0),
  ];
  if (values.length === 0) return -1;
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  await ProjectNode.updateOne({ _id: nodeId }, { $set: { progressPercentage: avg } });
  return avg;
}

/** Walk up the tree refreshing rollups after a leaf change. */
export async function refreshAncestorProgress(
  parentId: unknown,
  projectId: unknown,
  companyId: unknown,
): Promise<void> {
  let current = parentId;
  let guard = 0;
  while (current && guard < 12) {
    const avg = await recalcNodeProgress(current);
    if (avg < 0) break;
    const parent: any = await ProjectNode.findById(current).select('parentId');
    current = parent?.parentId ?? null;
    guard += 1;
  }
  // Roll the root averages up into the project itself.
  const roots = await ProjectNode.find({
    projectId,
    companyId,
    parentId: null,
  }).select('progressPercentage');
  if (roots.length > 0) {
    const { Project } = await import('./Project.js');
    const overall = Math.round(
      roots.reduce((s: number, r: any) => s + (r.progressPercentage ?? 0), 0) / roots.length,
    );
    await Project.updateOne({ _id: projectId }, { $set: { progressPercentage: overall } });
  }
}
