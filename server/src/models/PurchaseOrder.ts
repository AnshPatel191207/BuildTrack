import mongoose, { Schema } from 'mongoose';
import type { PurchaseOrderStatus } from '../types';

export interface PurchaseOrderDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  vendorId: any;
  poNumber: string;
  items: {
    materialName: string;
    category?: string | null;
    quantity: number;
    unit?: string | null;
    rate: number;
    amount: number;
  }[];
  totalAmount: number;
  paidAmount: number;
  status: PurchaseOrderStatus;
  expectedDeliveryDate?: Date | null;
  orderedAt?: Date | null;
  deliveredAt?: Date | null;
  closedAt?: Date | null;
  invoiceNumber?: string | null;
  notes?: string;
  requestedBy: any;
  approvedBy: any | null;
}

const poItemSchema = new Schema(
  {
    materialName: { type: String, required: true, trim: true, maxlength: 160 },
    category: { type: String, trim: true, maxlength: 40, default: null },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, trim: true, maxlength: 20, default: null },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema<PurchaseOrderDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    poNumber: { type: String, required: true },
    items: { type: [poItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'approved', 'ordered', 'delivered', 'closed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    expectedDeliveryDate: { type: Date, default: null },
    orderedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    invoiceNumber: { type: String, trim: true, maxlength: 60, default: null },
    notes: { type: String, trim: true, maxlength: 1000 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ companyId: 1, poNumber: 1 }, { unique: true });

purchaseOrderSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

/** Next sequential PO number scoped to a company, e.g. PO-0031. */
export async function nextPoNumber(companyId: unknown): Promise<string> {
  const count = await mongoose.model('PurchaseOrder').countDocuments({ companyId });
  let n = count + 1;
  for (;;) {
    const code = `PO-${String(n).padStart(4, '0')}`;
    const exists = await mongoose.model('PurchaseOrder').exists({ companyId, poNumber: code });
    if (!exists) return code;
    n += 1;
  }
}

export const PurchaseOrder = (mongoose.models.PurchaseOrder ??
  mongoose.model<PurchaseOrderDocument>('PurchaseOrder', purchaseOrderSchema)) as any;
