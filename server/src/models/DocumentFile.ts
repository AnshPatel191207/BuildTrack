import mongoose, { Schema } from 'mongoose';

export interface DocumentFileDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  projectId: any | null;
  customerId: any | null;
  title: string;
  category: string;
  url: string;
  publicId: string | null;
  mimeType: string | null;
  kind: 'image' | 'video' | 'document';
  sizeBytes?: number | null;
  expiryDate?: Date | null;
  notes?: string;
  uploadedBy: any;
}

export const DOCUMENT_CATEGORIES = [
  { value: 'drawing', label: 'Drawing' },
  { value: 'floor_plan', label: 'Floor Plan' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'noc', label: 'NOC' },
  { value: 'government_approval', label: 'Government Approval' },
  { value: 'structural_drawing', label: 'Structural Drawing' },
  { value: 'site_document', label: 'Site Document' },
  { value: 'customer_document', label: 'Customer Document' },
  { value: 'other', label: 'Other' },
] as const;

const documentFileSchema = new Schema<DocumentFileDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    category: {
      type: String,
      enum: [...DOCUMENT_CATEGORIES.map((c) => c.value)],
      default: 'other',
      index: true,
    },
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    mimeType: { type: String, default: null },
    kind: { type: String, enum: ['image', 'video', 'document'], default: 'document' },
    sizeBytes: { type: Number, default: null },
    expiryDate: { type: Date, default: null, index: true },
    expiryNotifiedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

documentFileSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const DocumentFile = (mongoose.models.DocumentFile ??
  mongoose.model<DocumentFileDocument>('DocumentFile', documentFileSchema)) as any;
