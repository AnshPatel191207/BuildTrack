import mongoose, { Schema, type Types } from 'mongoose';
import type { PropertyDocType } from '../types';

export interface DocumentTemplateDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: Types.ObjectId;
  templateType: PropertyDocType;
  title: string;
  headerHtml?: string | null;
  bodyContent: string;
  footerHtml?: string | null;
  termsAndConditions: string[];
  isDefault: boolean;
  createdBy: Types.ObjectId;
}

const documentTemplateSchema = new Schema<DocumentTemplateDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    templateType: {
      type: String,
      enum: ['receipt', 'banakhat', 'dastavej', 'booking_confirmation', 'demand_letter'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    headerHtml: { type: String, default: null },
    bodyContent: { type: String, required: true },
    footerHtml: { type: String, default: null },
    termsAndConditions: { type: [String], default: [] },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

documentTemplateSchema.index({ companyId: 1, templateType: 1 });

documentTemplateSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const DocumentTemplate = (mongoose.models.DocumentTemplate ??
  mongoose.model<DocumentTemplateDocument>('DocumentTemplate', documentTemplateSchema)) as any;
