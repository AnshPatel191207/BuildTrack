import mongoose, { Schema } from 'mongoose';
import type { LeadSource, LeadStage } from '../types';

export interface LeadDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any | null;
  name: string;
  phone: string;
  email?: string | null;
  source: LeadSource;
  stage: LeadStage;
  interestedIn?: string | null;
  budgetMin?: number;
  budgetMax?: number;
  assignedTo: any | null;
  customerId: any | null;
  bookingId: any | null;
  followUps: { date: Date; note?: string; done: boolean }[];
  nextFollowUpDate?: Date | null;
  notes: { text: string; author: any; createdAt: Date }[];
  lostReason?: string | null;
  convertedValue?: number | null;
}

const leadSchema = new Schema<LeadDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 15 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: null },
    source: {
      type: String,
      enum: ['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other'],
      default: 'other',
      index: true,
    },
    stage: {
      type: String,
      enum: [
        'new',
        'contacted',
        'site_visit_scheduled',
        'site_visit_completed',
        'proposal_sent',
        'negotiation',
        'booked',
        'lost',
      ],
      default: 'new',
      index: true,
    },
    interestedIn: { type: String, trim: true, maxlength: 160, default: null },
    budgetMin: { type: Number, min: 0, default: null },
    budgetMax: { type: Number, min: 0, default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    followUps: {
      type: [
        new Schema(
          {
            date: { type: Date, required: true },
            note: { type: String, trim: true, maxlength: 300 },
            done: { type: Boolean, default: false },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    nextFollowUpDate: { type: Date, default: null, index: true },
    notes: {
      type: [
        new Schema(
          {
            text: { type: String, required: true, maxlength: 500 },
            author: { type: Schema.Types.ObjectId, ref: 'User' },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    lostReason: { type: String, trim: true, maxlength: 300, default: null },
    convertedValue: { type: Number, min: 0, default: null },
  },
  { timestamps: true },
);

leadSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Lead = (mongoose.models.Lead ??
  mongoose.model<LeadDocument>('Lead', leadSchema)) as any;
