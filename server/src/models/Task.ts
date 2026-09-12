import mongoose, { Schema } from 'mongoose';

const taskPriorities = ['low', 'medium', 'high', 'urgent'];
const taskStatuses = ['todo', 'in_progress', 'completed', 'blocked'];

const taskSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    priority: { type: String, enum: taskPriorities, default: 'medium' },
    status: { type: String, enum: taskStatuses, default: 'todo', index: true },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

taskSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    if (ret.dueDate) ret.dueDate = new Date(ret.dueDate).toISOString().slice(0, 10);
    return ret;
  },
});

export const Task = mongoose.models.Task ?? mongoose.model('Task', taskSchema);
