import mongoose, { Schema } from 'mongoose';

const expenseCategories = [
  'materials',
  'labor',
  'transportation',
  'equipment',
  'electricity',
  'permits',
  'food',
  'maintenance',
  'miscellaneous',
];

const paymentMethods = ['cash', 'upi', 'bank_transfer', 'card', 'other'];

const expenseSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    category: {
      type: String,
      enum: expenseCategories,
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    amount: { type: Number, required: true, min: 1 },
    paymentMethod: { type: String, enum: paymentMethods, default: 'cash' },
    date: { type: Date, required: true, index: true },
    description: { type: String, trim: true, maxlength: 500 },
    receiptImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

expenseSchema.index({ projectId: 1, date: -1 });
expenseSchema.index({ companyId: 1, category: 1 });

expenseSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    ret.date && (ret.date = new Date(ret.date).toISOString().slice(0, 10));
    return ret;
  },
});

export const Expense =
  mongoose.models.Expense ?? mongoose.model('Expense', expenseSchema);
