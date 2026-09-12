import mongoose, { Schema } from 'mongoose';

const workerTypes = [
  'mason',
  'helper',
  'electrician',
  'plumber',
  'carpenter',
  'painter',
  'welder',
  'operator',
  'other',
];

const workerSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true },
    workerType: { type: String, enum: workerTypes, default: 'helper' },
    dailyWage: { type: Number, default: 0, min: 0 },
    skill: { type: String, trim: true, maxlength: 120 },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    joiningDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'inactive', 'terminated'],
      default: 'active',
      index: true,
    },
    profilePhoto: { type: String, default: null },
    contactId: { type: String, default: null },
  },
  { timestamps: true },
);

workerSchema.index({ name: 'text', phone: 'text' });

workerSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Worker =
  mongoose.models.Worker ?? mongoose.model('Worker', workerSchema);
