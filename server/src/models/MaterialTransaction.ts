import mongoose, { Schema } from 'mongoose';

const transactionSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    type: {
      type: String,
      enum: ['purchase', 'usage', 'adjustment', 'return'],
      required: true,
    },
    /** Signed quantity. purchase/return positive, usage negative, adjustment either. */
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0 },
    supplier: { type: String, trim: true, maxlength: 160 },
    invoiceNumber: { type: String, trim: true, maxlength: 80 },
    date: { type: Date, required: true, index: true },
    notes: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

transactionSchema.index({ materialId: 1, date: -1 });

transactionSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    if (ret.date) ret.date = new Date(ret.date).toISOString().slice(0, 10);
    return ret;
  },
});

export const MaterialTransaction =
  mongoose.models.MaterialTransaction ??
  mongoose.model('MaterialTransaction', transactionSchema);
