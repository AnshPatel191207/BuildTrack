import mongoose, { Schema } from 'mongoose';

const materialCategories = [
  'cement',
  'steel',
  'sand',
  'aggregate',
  'bricks',
  'tiles',
  'plumbing',
  'electrical',
  'paint',
  'hardware',
  'other',
];

const materialSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    category: { type: String, enum: materialCategories, default: 'other', index: true },
    unit: { type: String, enum: ['bag','kg','quintal','ton','brass','cft','sqft','litre','meter','roll','piece','packet','box','trip','other'], default: 'piece' },
    currentStock: { type: Number, default: 0, min: 0 },
    minimumStock: { type: Number, default: 0, min: 0 },
    averagePrice: { type: Number, default: 0, min: 0 },
    supplier: { type: String, trim: true, maxlength: 160 },
    lastRestockedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

materialSchema.index({ projectId: 1, name: 1 });

materialSchema.virtual('isLowStock').get(function () {
  return this.minimumStock > 0 && this.currentStock <= this.minimumStock;
});

materialSchema.virtual('estimatedValue').get(function () {
  return Math.round(this.currentStock * this.averagePrice * 100) / 100;
});

materialSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Material =
  mongoose.models.Material ?? mongoose.model('Material', materialSchema);
