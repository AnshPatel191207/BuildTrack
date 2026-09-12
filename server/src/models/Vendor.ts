import mongoose, { Schema } from 'mongoose';

export interface VendorDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  name: string;
  companyName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  materialsSupplied: string[];
  isActive: boolean;
}

const vendorSchema = new Schema<VendorDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    companyName: { type: String, trim: true, maxlength: 160, default: null },
    contactPerson: { type: String, trim: true, maxlength: 120, default: null },
    phone: { type: String, trim: true, maxlength: 15, default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: null },
    address: { type: String, trim: true, maxlength: 300, default: null },
    gstNumber: { type: String, trim: true, uppercase: true, maxlength: 15, default: null },
    materialsSupplied: { type: [String], trim: true, default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

vendorSchema.index({ companyId: 1, name: 1 }, { collation: { locale: 'en', strength: 2 } });

vendorSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Vendor = (mongoose.models.Vendor ??
  mongoose.model<VendorDocument>('Vendor', vendorSchema)) as any;
