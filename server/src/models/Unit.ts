import mongoose, { Schema } from 'mongoose';
import type { UnitStatus } from '../types';

export interface UnitDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any;
  phaseId: any | null;
  blockId: any | null;
  towerId: any | null;
  floorId: any | null;
  category: 'flat' | 'shop' | 'office' | 'penthouse' | 'plot';
  unitNumber: string;
  unitType: string;
  areaSqft: number;
  carpetAreaSqft: number;
  builtUpAreaSqft: number;
  superBuiltupAreaSqft: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  balconies?: number;
  floorNumber?: number;
  facing?: string | null;
  ratePerSqft: number;
  basePrice?: number;
  parkingSlot?: string | null;
  parkingCharges?: number;
  clubhouseCharges?: number;
  gstPercentage?: number;
  gstAmount?: number;
  finalPrice?: number;
  totalValue: number;
  status: UnitStatus;
  currentCustomerId: any | null;
  currentBookingId: any | null;
  notes?: string;
}

const unitSchema = new Schema<UnitDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    phaseId: { type: Schema.Types.ObjectId, ref: 'ProjectNode', default: null, index: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'ProjectNode', default: null, index: true },
    towerId: { type: Schema.Types.ObjectId, ref: 'ProjectNode', default: null, index: true },
    floorId: { type: Schema.Types.ObjectId, ref: 'ProjectNode', default: null, index: true },
    category: {
      type: String,
      enum: ['flat', 'shop', 'office', 'penthouse', 'plot'],
      default: 'flat',
      index: true,
    },
    unitNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    unitType: { type: String, required: true, trim: true, maxlength: 40 },
    areaSqft: { type: Number, default: 0, min: 0 },
    carpetAreaSqft: { type: Number, default: 0, min: 0 },
    builtUpAreaSqft: { type: Number, default: 0, min: 0 },
    superBuiltupAreaSqft: { type: Number, default: 0, min: 0 },
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    balconies: { type: Number, default: 0 },
    floorNumber: { type: Number, default: 0 },
    facing: { type: String, trim: true, maxlength: 20, default: null },
    ratePerSqft: { type: Number, default: 0, min: 0 },
    basePrice: { type: Number, default: 0, min: 0 },
    parkingSlot: { type: String, trim: true, default: null },
    parkingCharges: { type: Number, default: 0, min: 0 },
    clubhouseCharges: { type: Number, default: 0, min: 0 },
    gstPercentage: { type: Number, default: 5, min: 0, max: 28 },
    gstAmount: { type: Number, default: 0, min: 0 },
    finalPrice: { type: Number, default: 0, min: 0 },
    totalValue: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['available', 'reserved', 'booked', 'sold', 'blocked', 'cancelled'],
      default: 'available',
      index: true,
    },
    currentCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    currentBookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

unitSchema.index({ projectId: 1, unitNumber: 1 }, { unique: true });
unitSchema.index({ companyId: 1, status: 1 });

unitSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Unit = (mongoose.models.Unit ??
  mongoose.model<UnitDocument>('Unit', unitSchema)) as any;
