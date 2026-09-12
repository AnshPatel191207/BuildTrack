import mongoose, { Schema } from 'mongoose';
import type { ContractorWorkType } from '../types';

export interface ContractorDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  workTypes: ContractorWorkType[];
  specialty?: string | null;
  gstNumber?: string | null;
  isActive: boolean;
}

const contractorSchema = new Schema<ContractorDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, trim: true, maxlength: 160, default: null },
    phone: { type: String, trim: true, maxlength: 15, default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: null },
    address: { type: String, trim: true, maxlength: 300, default: null },
    workTypes: {
      type: [String],
      enum: ['rcc', 'brickwork', 'plumbing', 'electrical', 'painting', 'flooring', 'interior', 'other'],
      default: [],
      index: true,
    },
    specialty: { type: String, trim: true, maxlength: 160, default: null },
    gstNumber: { type: String, trim: true, uppercase: true, maxlength: 15, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

contractorSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Contractor = (mongoose.models.Contractor ??
  mongoose.model<ContractorDocument>('Contractor', contractorSchema)) as any;

/** A contractor engaged on a specific project for a scope of work. */
export interface ContractorContractDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  contractorId: any;
  scope: string;
  contractValue: number;
  paidAmount: number;
  startDate?: Date | null;
  endDate?: Date | null;
  status: 'active' | 'completed' | 'terminated';
  notes?: string;
}

const contractSchema = new Schema<ContractorContractDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'Contractor',
      required: true,
      index: true,
    },
    scope: { type: String, required: true, trim: true, maxlength: 200 },
    contractValue: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'completed', 'terminated'],
      default: 'active',
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

contractSchema.virtual('pendingAmount').get(function (this: any) {
  return Math.max(this.contractValue - this.paidAmount, 0);
});

contractSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const ContractorContract = (mongoose.models.ContractorContract ??
  mongoose.model<ContractorContractDocument>(
    'ContractorContract',
    contractSchema,
  )) as any;

export interface ContractorPaymentDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  contractId: any;
  contractorId: any;
  paymentType: 'advance' | 'running_bill' | 'final_settlement';
  amount: number;
  date: Date;
  method: string;
  reference?: string | null;
  notes?: string;
  createdBy: any;
}

const contractPaymentSchema = new Schema<ContractorPaymentDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'ContractorContract',
      required: true,
      index: true,
    },
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'Contractor',
      required: true,
      index: true,
    },
    paymentType: {
      type: String,
      enum: ['advance', 'running_bill', 'final_settlement'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    method: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'],
      default: 'bank_transfer',
    },
    reference: { type: String, trim: true, maxlength: 80, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

contractPaymentSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const ContractorPayment = (mongoose.models.ContractorPayment ??
  mongoose.model<ContractorPaymentDocument>(
    'ContractorPayment',
    contractPaymentSchema,
  )) as any;
