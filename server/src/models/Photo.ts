import mongoose, { Schema } from 'mongoose';

const photoSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    kind: {
      type: String,
      enum: ['image', 'video', 'document'],
      default: 'image',
      index: true,
    },
    mimeType: { type: String, default: null },
    durationSeconds: { type: Number, default: null },
    category: {
      type: String,
      enum: ['progress', 'material', 'issue', 'safety', 'completion'],
      default: 'progress',
    },
    description: { type: String, trim: true, maxlength: 300 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    sizeBytes: { type: Number, default: null },
  },
  { timestamps: true },
);

photoSchema.index({ projectId: 1, createdAt: -1 });

photoSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Photo = mongoose.models.Photo ?? mongoose.model('Photo', photoSchema);
