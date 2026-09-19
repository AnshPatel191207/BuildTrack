import mongoose, { Schema, type FilterQuery } from 'mongoose';
import type { ProjectStatus } from '../types';
import { utcDay } from '../utils/dates';

export interface ProjectDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  companyId: any;
  name: string;
  projectCode: string;
  clientName?: string;
  clientPhone?: string;
  location?: string;
  address?: string;
  projectType: string;
  startDate: Date;
  expectedEndDate?: Date;
  budget: number;
  spentAmount: number;
  status: ProjectStatus;
  progressPercentage: number;
  description?: string;
  projectManagerId?: any | null;
  // Property ERP extensions
  builderName?: string;
  reraNumber?: string;
  launchDate?: Date | null;
  completionDate?: Date | null;
  totalTowers?: number;
  totalUnits?: number;
  amenities?: string[];
  // Dynamic Branding & ERP configuration
  branding?: {
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
    shortName?: string | null;
    developerName?: string | null;
    companyName?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    officeAddress?: string | null;
    siteAddress?: string | null;
    gstNumber?: string | null;
    reraNumber?: string | null;
    panNumber?: string | null;
  };
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  receiptConfig?: {
    showLogo: boolean;
    showGst: boolean;
    showRera: boolean;
    showCustomerAddress: boolean;
    showBankDetails: boolean;
    watermarkText?: string | null;
    enableDigitalSign: boolean;
    termsAndConditions: string[];
    authorizedSignatoryTitle?: string | null;
    tagline?: string | null;
    jurisdiction?: string | null;
  };
  legalDocConfig?: {
    partnershipFirmName?: string | null;
    managingPartners?: string[];
    subRegistrarOffice?: string | null;
    tpScheme?: string | null;
    surveyNumbers?: string | null;
    finalPlotNumbers?: string | null;
    citySurveyNumbers?: string | null;
    projectTagline?: string | null;
    jurisdiction?: string | null;
  };
  bookingRules?: {
    minTokenAmount: number;
    tokenValidityDays: number;
    cancellationPenaltyPct: number;
  };
  paymentRules?: {
    defaultGstRate: number;
    overdueInterestPctPerAnnum: number;
    gracePeriodDays: number;
  };
}

const projectTypes = [
  'residential',
  'commercial',
  'industrial',
  'renovation',
  'infrastructure',
  'interior',
  'other',
];

const projectSchema = new Schema<ProjectDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    projectCode: { type: String, required: true },
    clientName: { type: String, trim: true, maxlength: 120 },
    clientPhone: { type: String, trim: true },
    location: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300 },
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    siteRadiusMeters: { type: Number, default: 100, min: 20, max: 2000 },
    projectType: {
      type: String,
      enum: projectTypes,
      default: 'residential',
    },
    startDate: { type: Date, default: () => utcDay(new Date()) },
    expectedEndDate: { type: Date },
    budget: { type: Number, default: 0, min: 0 },
    spentAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String, trim: true, maxlength: 1000 },
    projectManagerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // Property ERP extensions
    builderName: { type: String, trim: true, maxlength: 140, default: null },
    reraNumber: { type: String, trim: true, maxlength: 60, default: null, index: true },
    launchDate: { type: Date, default: null },
    completionDate: { type: Date, default: null },
    totalTowers: { type: Number, default: 0, min: 0 },
    totalUnits: { type: Number, default: 0, min: 0 },
    amenities: { type: [String], default: [] },
    // Dynamic Branding & ERP configuration
    branding: {
      logoUrl: { type: String, default: null },
      logoDarkUrl: { type: String, default: null },
      shortName: { type: String, trim: true, default: null },
      developerName: { type: String, trim: true, default: null },
      companyName: { type: String, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      email: { type: String, trim: true, lowercase: true, default: null },
      website: { type: String, trim: true, default: null },
      officeAddress: { type: String, trim: true, default: null },
      siteAddress: { type: String, trim: true, default: null },
      gstNumber: { type: String, trim: true, uppercase: true, default: null },
      reraNumber: { type: String, trim: true, default: null },
      panNumber: { type: String, trim: true, uppercase: true, default: null },
    },
    theme: {
      primary: { type: String, default: '#E8590C' },
      secondary: { type: String, default: '#17263B' },
      accent: { type: String, default: '#F59E0B' },
      success: { type: String, default: '#10B981' },
      warning: { type: String, default: '#D97706' },
      danger: { type: String, default: '#DC2626' },
      info: { type: String, default: '#2563EB' },
    },
    receiptConfig: {
      showLogo: { type: Boolean, default: true },
      showGst: { type: Boolean, default: true },
      showRera: { type: Boolean, default: true },
      showCustomerAddress: { type: Boolean, default: true },
      showBankDetails: { type: Boolean, default: true },
      watermarkText: { type: String, default: null },
      enableDigitalSign: { type: Boolean, default: true },
      termsAndConditions: {
        type: [String],
        default: [
          'Subject to realization of Cheque / RTGS payment.',
          'Interest @ 12% p.a. applicable for delayed installments.',
          'All disputes subject to local jurisdiction.',
        ],
      },
      authorizedSignatoryTitle: { type: String, default: null },
      tagline: { type: String, default: '2 BHK PODIUM HOMES' },
      jurisdiction: { type: String, default: 'Ahmedabad Jurisdiction' },
    },
    legalDocConfig: {
      partnershipFirmName: { type: String, default: 'રૂદ્ર ડેવલોપર્સ એ નામની ભાગીદારી પેઢી' },
      managingPartners: {
        type: [String],
        default: [
          '૧. પ્રશાંતકુમાર હસમુખભાઈ લીંબાણી',
          '૨. જેનિલ વિપુલકુમાર શીંગાળા',
          '૩. ધવલ કિશોરભાઈ ડોબરીયા',
        ],
      },
      subRegistrarOffice: { type: String, default: 'ગાંધીનગર સબ-ડીસ્ટ્રીકટ ગાંધીનગર (ઝોન-૨)' },
      tpScheme: { type: String, default: '૪૦૯/અ (ખોરજ-ત્રાગડ)' },
      surveyNumbers: { type: String, default: '૩૫૩/૩, ૩૫૬/૨' },
      finalPlotNumbers: { type: String, default: '૮૨, ૮૭' },
      citySurveyNumbers: { type: String, default: 'NA99, NA353/3, NA356/2P1' },
      projectTagline: { type: String, default: '2 BHK PODIUM HOMES' },
      jurisdiction: { type: String, default: 'Ahmedabad Jurisdiction' },
    },
    bookingRules: {
      minTokenAmount: { type: Number, default: 100000 },
      tokenValidityDays: { type: Number, default: 7 },
      cancellationPenaltyPct: { type: Number, default: 10 },
    },
    paymentRules: {
      defaultGstRate: { type: Number, default: 5 },
      overdueInterestPctPerAnnum: { type: Number, default: 12 },
      gracePeriodDays: { type: Number, default: 15 },
    },
  },
  { timestamps: true },
);

projectSchema.index({ companyId: 1, projectCode: 1 }, { unique: true });

projectSchema.virtual('remainingBudget').get(function (this: ProjectDocument) {
  return Math.round((this.budget - this.spentAmount) * 100) / 100;
});

projectSchema.virtual('budgetUtilization').get(function (this: ProjectDocument) {
  if (!this.budget) return 0;
  return Math.round((this.spentAmount / this.budget) * 1000) / 10;
});

projectSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

/** Next sequential code like PRJ-0001 scoped to a company. */
export async function nextProjectCode(companyId: unknown): Promise<string> {
  const count = await mongoose
    .model('Project')
    .countDocuments({ companyId } as FilterQuery<ProjectDocument>);
  let n = count + 1;
  // Ensure uniqueness even after deletions.
  for (;;) {
    const code = `PRJ-${String(n).padStart(4, '0')}`;
    const exists = await mongoose.model('Project').exists({
      companyId,
      projectCode: code,
    } as FilterQuery<ProjectDocument>);
    if (!exists) return code;
    n += 1;
  }
}

export const Project = (mongoose.models.Project ??
  mongoose.model<ProjectDocument>('Project', projectSchema)) as any;
