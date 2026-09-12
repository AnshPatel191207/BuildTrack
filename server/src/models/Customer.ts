import mongoose, { Schema } from 'mongoose';
import type { CustomerJourneyStage, LeadSource } from '../types';

export interface CustomerDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any | null;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pan?: string | null;
  aadhaar?: string | null;
  occupation?: string | null;
  leadSource: LeadSource;
  journeyStage: CustomerJourneyStage;
  timeline: { stage: CustomerJourneyStage; note?: string; date: Date }[];
  assignedTo: any | null;
  isActive: boolean;
}

const timelineSchema = new Schema(
  {
    stage: {
      type: String,
      enum: ['inquiry', 'visit', 'negotiation', 'booking', 'payment', 'possession'],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 300 },
    date: { type: Date, default: Date.now },
  },
  { _id: false },
);

const customerSchema = new Schema<CustomerDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 15 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: null },
    address: { type: String, trim: true, maxlength: 300, default: null },
    city: { type: String, trim: true, maxlength: 80, default: null },
    state: { type: String, trim: true, maxlength: 80, default: null },
    pan: { type: String, trim: true, uppercase: true, maxlength: 10, default: null },
    aadhaar: { type: String, trim: true, default: null },
    occupation: { type: String, trim: true, maxlength: 80, default: null },
    leadSource: {
      type: String,
      enum: ['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other'],
      default: 'other',
      index: true,
    },
    journeyStage: {
      type: String,
      enum: ['inquiry', 'visit', 'negotiation', 'booking', 'payment', 'possession'],
      default: 'inquiry',
      index: true,
    },
    timeline: { type: [timelineSchema], default: [] },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customerSchema.index({ companyId: 1, phone: 1 });

customerSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Customer = (mongoose.models.Customer ??
  mongoose.model<CustomerDocument>('Customer', customerSchema)) as any;

/** Append a journey event and advance the current stage. */
export async function pushCustomerStage(
  customerId: unknown,
  stage: CustomerJourneyStage,
  note?: string,
): Promise<void> {
  await Customer.updateOne(
    { _id: customerId },
    {
      $push: { timeline: { stage, note, date: new Date() } },
      $set: { journeyStage: stage },
    },
  );
}
