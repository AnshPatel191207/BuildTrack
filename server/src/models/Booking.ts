import mongoose, { Schema } from 'mongoose';
import type { BookingStatus } from '../types';

export interface BookingScheduleItem {
  installmentNo: number;
  title: string;
  percentage?: number;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
  paidAmount: number;
  paymentId?: any | null;
}

export interface BookingDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  unitId: any;
  customerId: any;
  bookingNumber: string;
  bookingDate: Date;
  bookingAmount: number;
  basePrice?: number;
  discountAmount?: number;
  discountReason?: string | null;
  finalPrice?: number;
  totalValue: number;
  salesManagerId: any | null;
  salesExecutiveId: any | null;
  remarks?: string | null;
  status: BookingStatus;
  paymentSchedule: BookingScheduleItem[];
  banakhatDocumentId?: any | null;
  dastavejDocumentId?: any | null;
  possessionDate?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  notes?: string;
  createdBy: any;
}

const bookingScheduleItemSchema = new Schema(
  {
    installmentNo: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    percentage: { type: Number, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'partially_paid', 'paid', 'overdue'],
      default: 'pending',
    },
    paidAmount: { type: Number, default: 0 },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
  },
  { _id: true },
);

const bookingSchema = new Schema<BookingDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    bookingNumber: { type: String, required: true },
    bookingDate: { type: Date, required: true },
    bookingAmount: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountReason: { type: String, trim: true, default: null },
    finalPrice: { type: Number, default: 0 },
    totalValue: { type: Number, required: true, min: 0 },
    salesManagerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    salesExecutiveId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    remarks: { type: String, trim: true, maxlength: 1000, default: null },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'sold'],
      default: 'pending',
      index: true,
    },
    paymentSchedule: { type: [bookingScheduleItemSchema], default: [] },
    banakhatDocumentId: { type: Schema.Types.ObjectId, ref: 'PropertyDocument', default: null },
    dastavejDocumentId: { type: Schema.Types.ObjectId, ref: 'PropertyDocument', default: null },
    possessionDate: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, maxlength: 300, default: null },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

bookingSchema.index({ companyId: 1, bookingNumber: 1 }, { unique: true });

bookingSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

/** Next sequential booking code scoped to a company, e.g. BKG-0007. */
export async function nextBookingNumber(companyId: unknown): Promise<string> {
  const count = await mongoose.model('Booking').countDocuments({ companyId });
  let n = count + 1;
  for (;;) {
    const code = `BKG-${String(n).padStart(4, '0')}`;
    const exists = await mongoose.model('Booking').exists({ companyId, bookingNumber: code });
    if (!exists) return code;
    n += 1;
  }
}

export const Booking = (mongoose.models.Booking ??
  mongoose.model<BookingDocument>('Booking', bookingSchema)) as any;
