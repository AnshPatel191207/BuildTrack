import mongoose, { Schema, type Types } from 'mongoose';
import type { PropertyDocStatus, PropertyDocType } from '../types';

export interface PropertyDocumentDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: Types.ObjectId;
  projectId: Types.ObjectId;
  bookingId?: Types.ObjectId | null;
  customerId: Types.ObjectId;
  unitId?: Types.ObjectId | null;
  documentType: PropertyDocType;
  documentNumber: string;
  title: string;
  templateId?: Types.ObjectId | null;
  renderedContent?: string | null;
  pdfUrl?: string | null;
  status: PropertyDocStatus;
  registrationDetails?: {
    registrationNumber?: string | null;
    registrationDate?: Date | null;
    subRegistrarOffice?: string | null;
    stampDutyPaid?: number;
    registrationFee?: number;
  };
  generatedBy: Types.ObjectId;
}

const propertyDocumentSchema = new Schema<PropertyDocumentDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', default: null, index: true },
    documentType: {
      type: String,
      enum: ['receipt', 'banakhat', 'dastavej', 'booking_confirmation', 'demand_letter'],
      required: true,
      index: true,
    },
    documentNumber: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    templateId: { type: Schema.Types.ObjectId, ref: 'DocumentTemplate', default: null },
    renderedContent: { type: String, default: null },
    pdfUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'generated', 'signed', 'registered'],
      default: 'generated',
      index: true,
    },
    registrationDetails: {
      registrationNumber: { type: String, trim: true, default: null },
      registrationDate: { type: Date, default: null },
      subRegistrarOffice: { type: String, trim: true, default: null },
      stampDutyPaid: { type: Number, default: 0 },
      registrationFee: { type: Number, default: 0 },
    },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

propertyDocumentSchema.index({ companyId: 1, documentNumber: 1 }, { unique: true });
propertyDocumentSchema.index({ companyId: 1, customerId: 1 });
propertyDocumentSchema.index({ companyId: 1, bookingId: 1 });

propertyDocumentSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

/** Next document code e.g. BNK-2026-000001 or DST-2026-000001 */
export async function nextDocumentNumber(
  companyId: unknown,
  docType: 'banakhat' | 'dastavej' | 'receipt' | 'booking_confirmation' | 'demand_letter',
): Promise<string> {
  const year = new Date().getFullYear();
  const prefixMap: Record<string, string> = {
    banakhat: `BNK-${year}-`,
    dastavej: `DST-${year}-`,
    receipt: `RCP-${year}-`,
    booking_confirmation: `BC-${year}-`,
    demand_letter: `DL-${year}-`,
  };
  const prefix = prefixMap[docType] ?? `DOC-${year}-`;
  const count = await mongoose.model('PropertyDocument').countDocuments({
    companyId,
    documentNumber: new RegExp(`^${prefix}`),
  });
  let n = count + 1;
  for (;;) {
    const code = `${prefix}${String(n).padStart(6, '0')}`;
    const exists = await mongoose.model('PropertyDocument').exists({
      companyId,
      documentNumber: code,
    });
    if (!exists) return code;
    n += 1;
  }
}

export const PropertyDocument = (mongoose.models.PropertyDocument ??
  mongoose.model<PropertyDocumentDocument>('PropertyDocument', propertyDocumentSchema)) as any;
