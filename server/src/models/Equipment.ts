import mongoose, { Schema } from 'mongoose';

export interface EquipmentDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any | null;
  equipmentNumber: string;
  name: string;
  type: string;
  ownership: 'owned' | 'rented';
  purchaseCost: number;
  rentalCostPerDay: number;
  fuelCostTotal: number;
  maintenanceCostTotal: number;
  operatingHours: number;
  purchaseDate?: Date | null;
  status: 'active' | 'idle' | 'maintenance' | 'retired';
  notes?: string;
}

export const EQUIPMENT_TYPES = [
  { value: 'excavator', label: 'Excavator' },
  { value: 'crane', label: 'Crane' },
  { value: 'mixer', label: 'Concrete Mixer' },
  { value: 'lift', label: 'Lift / Hoist' },
  { value: 'generator', label: 'Generator' },
  { value: 'jcb', label: 'JCB' },
  { value: 'tractor', label: 'Tractor / Trolley' },
  { value: 'pump', label: 'Water Pump' },
  { value: 'scaffolding', label: 'Scaffolding' },
  { value: 'other', label: 'Other' },
] as const;

const usageEntrySchema = new Schema(
  {
    date: { type: Date, required: true },
    hoursUsed: { type: Number, default: 0, min: 0 },
    fuelCost: { type: Number, default: 0, min: 0 },
    maintenanceCost: { type: Number, default: 0, min: 0 },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: true },
);

const equipmentSchema = new Schema<EquipmentDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    equipmentNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    type: {
      type: String,
      enum: [...EQUIPMENT_TYPES.map((t) => t.value)],
      default: 'other',
      index: true,
    },
    ownership: { type: String, enum: ['owned', 'rented'], default: 'owned' },
    purchaseCost: { type: Number, default: 0, min: 0 },
    rentalCostPerDay: { type: Number, default: 0, min: 0 },
    fuelCostTotal: { type: Number, default: 0, min: 0 },
    maintenanceCostTotal: { type: Number, default: 0, min: 0 },
    operatingHours: { type: Number, default: 0, min: 0 },
    purchaseDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'idle', 'maintenance', 'retired'],
      default: 'active',
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 500 },
    usageEntries: { type: [usageEntrySchema], default: [] },
  },
  { timestamps: true },
);

equipmentSchema.index({ companyId: 1, equipmentNumber: 1 }, { unique: true });

/** Utilisation over the last 30 days of logged entries (8h/day capacity). */
equipmentSchema.virtual('utilizationPercent').get(function (this: any) {
  const cutoff = Date.now() - 30 * 86_400_000;
  const recent = (this.usageEntries ?? []).filter(
    (e: any) => new Date(e.date).getTime() >= cutoff,
  );
  const hours = recent.reduce((s: number, e: any) => s + (e.hoursUsed ?? 0), 0);
  const capacity = Math.max(recent.length * 8, 1);
  return Math.min(Math.round((hours / capacity) * 100), 100);
});

equipmentSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret: any) {
    delete ret.__v;
    delete ret.usageEntries;
    return ret;
  },
});

export const Equipment = (mongoose.models.Equipment ??
  mongoose.model<EquipmentDocument>('Equipment', equipmentSchema)) as any;
