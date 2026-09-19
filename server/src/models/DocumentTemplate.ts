import mongoose, { Schema, type Types } from 'mongoose';
import type { PropertyDocType } from '../types';

export interface TemplateClause {
  id: string;
  clauseNumber?: string;
  title: string;
  content: string;
  isMandatory: boolean;
  order: number;
  conditionVariable?: string | null;
}

export interface DocumentTemplateDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  templateType: PropertyDocType | 'quotation' | 'invoice' | 'agreement';
  title: string;
  headerHtml?: string | null;
  bodyContent: string;
  footerHtml?: string | null;
  clauses: TemplateClause[];
  termsAndConditions: string[];
  showLogo: boolean;
  showRera: boolean;
  showGst: boolean;
  watermarkText?: string | null;
  signatures: Array<{
    role: string;
    label: string;
    signerName?: string;
    required: boolean;
  }>;
  witnesses: Array<{
    label: string;
    required: boolean;
  }>;
  isDefault: boolean;
  version: number;
  createdBy: Types.ObjectId;
}

const clauseSchema = new Schema(
  {
    id: { type: String, required: true },
    clauseNumber: { type: String, default: null },
    title: { type: String, required: true },
    content: { type: String, required: true },
    isMandatory: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    conditionVariable: { type: String, default: null },
  },
  { _id: false },
);

const signatureSchema = new Schema(
  {
    role: { type: String, required: true },
    label: { type: String, required: true },
    signerName: { type: String, default: null },
    required: { type: Boolean, default: true },
  },
  { _id: false },
);

const witnessSchema = new Schema(
  {
    label: { type: String, required: true },
    required: { type: Boolean, default: true },
  },
  { _id: false },
);

const documentTemplateSchema = new Schema<DocumentTemplateDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    templateType: {
      type: String,
      enum: ['receipt', 'invoice', 'banakhat', 'dastavej', 'booking_confirmation', 'demand_letter', 'quotation', 'agreement'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    headerHtml: { type: String, default: null },
    bodyContent: { type: String, required: true },
    footerHtml: { type: String, default: null },
    clauses: { type: [clauseSchema], default: [] },
    termsAndConditions: { type: [String], default: [] },
    showLogo: { type: Boolean, default: true },
    showRera: { type: Boolean, default: true },
    showGst: { type: Boolean, default: true },
    watermarkText: { type: String, default: null },
    signatures: { type: [signatureSchema], default: [] },
    witnesses: { type: [witnessSchema], default: [] },
    isDefault: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

documentTemplateSchema.index({ companyId: 1, projectId: 1, templateType: 1 });

documentTemplateSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const DocumentTemplate = (mongoose.models.DocumentTemplate ??
  mongoose.model<DocumentTemplateDocument>('DocumentTemplate', documentTemplateSchema)) as any;
