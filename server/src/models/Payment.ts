import mongoose, { Schema } from 'mongoose';
import type { CustomerPaymentMethod, PaymentStatus, PaymentType } from '../types';

export interface PaymentDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any | null;
  bookingId: any | null;
  customerId: any;
  unitId: any | null;
  paymentNumber: string;
  receiptNumber?: string | null;
  amount: number;
  paymentType: PaymentType;
  method: CustomerPaymentMethod;
  mode?: string;
  transactionId?: string | null;
  bankName?: string | null;
  chequeNumber?: string | null;
  chequeDate?: Date | null;
  installmentNo?: number | null;
  dueDate?: Date | null;
  paidDate?: Date | null;
  status: PaymentStatus;
  reference?: string | null;
  notes?: string;
  receiptPdfUrl?: string | null;
  qrCodeData?: string | null;
  recordedBy: any | null;
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
    paymentNumber: { type: String, required: true },
    receiptNumber: { type: String, trim: true, default: null, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentType: {
      type: String,
      enum: ['booking_amount', 'installment', 'milestone', 'final'],
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'loan', 'neft', 'rtgs', 'other'],
      default: 'bank_transfer',
    },
    mode: {
      type: String,
      enum: ['cash', 'cheque', 'upi', 'neft', 'rtgs', 'card', 'bank_transfer', 'loan', 'other'],
      default: 'bank_transfer',
    },
    transactionId: { type: String, trim: true, maxlength: 100, default: null },
    bankName: { type: String, trim: true, maxlength: 100, default: null },
    chequeNumber: { type: String, trim: true, maxlength: 40, default: null },
    chequeDate: { type: Date, default: null },
    installmentNo: { type: Number, default: null },
    dueDate: { type: Date, default: null, index: true },
    paidDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
      index: true,
    },
    reference: { type: String, trim: true, maxlength: 80, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
    receiptPdfUrl: { type: String, default: null },
    qrCodeData: { type: String, default: null },
    dueNotifiedAt: { type: Date, default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ companyId: 1, status: 1, dueDate: 1 });
paymentSchema.index({ companyId: 1, paymentNumber: 1 }, { unique: true });
paymentSchema.index({ companyId: 1, receiptNumber: 1 }, { sparse: true });

paymentSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

/** Next sequential receipt number scoped to a company, e.g. PAY-0042. */
export async function nextPaymentNumber(companyId: unknown): Promise<string> {
  const count = await mongoose.model('Payment').countDocuments({ companyId });
  let n = count + 1;
  for (;;) {
    const code = `PAY-${String(n).padStart(4, '0')}`;
    const exists = await mongoose.model('Payment').exists({ companyId, paymentNumber: code });
    if (!exists) return code;
    n += 1;
  }
}

/** Next sequential official receipt number: RCP-YYYY-000001 */
export async function nextReceiptNumber(companyId: unknown): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const count = await mongoose.model('Payment').countDocuments({
    companyId,
    receiptNumber: new RegExp(`^${prefix}`),
  });
  let n = count + 1;
  for (;;) {
    const code = `${prefix}${String(n).padStart(6, '0')}`;
    const exists = await mongoose.model('Payment').exists({ companyId, receiptNumber: code });
    if (!exists) return code;
    n += 1;
  }
}

export const Payment = (mongoose.models.Payment ??
  mongoose.model<PaymentDocument>('Payment', paymentSchema)) as any;
