import { z } from 'zod';

export const propertyProjectBodySchema = z.object({
  name: z.string().min(1).max(140),
  location: z.string().max(160).optional(),
  address: z.string().max(300).optional(),
  builderName: z.string().max(140).optional(),
  reraNumber: z.string().max(60).optional(),
  projectType: z
    .enum(['residential', 'commercial', 'industrial', 'renovation', 'infrastructure', 'interior', 'other'])
    .default('residential'),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  completionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  budget: z.number().nonnegative().optional(),
  description: z.string().max(1000).optional(),
  totalTowers: z.number().int().nonnegative().optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  amenities: z.array(z.string()).optional(),
});

export const towerBodySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120), // e.g. "Tower A", "Wing 1"
  towerNumber: z.string().max(40).optional(),
  description: z.string().max(500).optional(),
  totalFloors: z.number().int().nonnegative().optional(),
});

export const floorBodySchema = z.object({
  projectId: z.string().min(1),
  towerId: z.string().min(1),
  name: z.string().min(1).max(120), // e.g. "1st Floor", "Ground Floor"
  order: z.number().int().optional(),
  description: z.string().max(500).optional(),
});

export const flatBodySchema = z.object({
  projectId: z.string().min(1),
  towerId: z.string().optional(),
  floorId: z.string().optional(),
  unitNumber: z.string().min(1).max(30), // e.g. "A-101"
  unitType: z.string().min(1).max(40).optional(), // "1BHK", "2BHK", "3BHK", etc.
  areaSqft: z.number().positive().optional(),
  carpetAreaSqft: z.number().nonnegative().optional(),
  builtUpAreaSqft: z.number().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  balconies: z.number().int().nonnegative().optional(),
  floorNumber: z.number().int().optional(),
  facing: z.string().max(20).optional(),
  ratePerSqft: z.number().nonnegative().optional(),
  parkingSlot: z.string().max(60).optional(),
  parkingCharges: z.number().nonnegative().optional(),
  clubhouseCharges: z.number().nonnegative().optional(),
  gstPercentage: z.number().nonnegative().max(28).optional(),
  basePrice: z.number().nonnegative().optional(),
  totalValue: z.number().positive().optional(),
  status: z.enum(['available', 'reserved', 'booked', 'sold', 'blocked', 'cancelled']).default('available'),
  notes: z.string().max(500).optional(),
});

export const shopBodySchema = z.object({
  projectId: z.string().min(1),
  towerId: z.string().optional(),
  floorId: z.string().optional(),
  unitNumber: z.string().min(1).max(30), // e.g. "SHOP-01"
  unitType: z.string().default('Shop'),
  areaSqft: z.number().positive().optional(),
  carpetAreaSqft: z.number().nonnegative().optional(),
  ratePerSqft: z.number().nonnegative().optional(),
  totalValue: z.number().positive().optional(),
  status: z.enum(['available', 'reserved', 'booked', 'sold', 'blocked', 'cancelled']).default('available'),
  facing: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
});

export const propertyCustomerBodySchema = z.object({
  projectId: z.string().optional().nullable(),
  name: z.string().min(1).max(120),
  phone: z.string().min(5).max(15),
  alternatePhone: z.string().max(15).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional().nullable(),
  aadhaar: z.string().max(12).optional().nullable(),
  gstNumber: z.string().max(15).optional().nullable(),
  occupation: z.string().max(80).optional().nullable(),
  leadSource: z.enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other']).default('walk_in'),
  nominee: z
    .object({
      name: z.string().optional().nullable(),
      relation: z.string().optional().nullable(),
      age: z.number().int().min(0).max(120).optional().nullable(),
      phone: z.string().optional().nullable(),
      aadhaar: z.string().optional().nullable(),
    })
    .optional(),
});

export const propertyBookingBodySchema = z.object({
  projectId: z.string().min(1),
  unitId: z.string().min(1),
  customerId: z.string().min(1),
  bookingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  bookingAmount: z.number().positive(),
  discountAmount: z.number().nonnegative().optional(),
  discountReason: z.string().max(200).optional(),
  salesExecutiveId: z.string().optional().nullable(),
  remarks: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  installmentsCount: z.number().int().min(1).max(60).optional(),
  installmentFrequencyMonths: z.number().int().min(1).max(12).optional(),
});

export const propertyPaymentBodySchema = z.object({
  projectId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  customerId: z.string().min(1),
  unitId: z.string().optional().nullable(),
  amount: z.number().positive(),
  paymentType: z.enum(['booking_amount', 'installment', 'milestone', 'final']).default('installment'),
  mode: z.enum(['cash', 'cheque', 'upi', 'neft', 'rtgs', 'card', 'bank_transfer', 'loan', 'other']),
  transactionId: z.string().max(100).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  chequeNumber: z.string().max(40).optional().nullable(),
  chequeDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  paidDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional(),
  generateReceiptImmediately: z.boolean().default(true),
});

export const templateClauseSchema = z.object({
  id: z.string().min(1),
  clauseNumber: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  isMandatory: z.boolean().default(false),
  order: z.number().int().default(0),
  conditionVariable: z.string().optional().nullable(),
});

export const templateBodySchema = z.object({
  projectId: z.string().optional().nullable(),
  templateType: z.enum(['receipt', 'invoice', 'banakhat', 'dastavej', 'booking_confirmation', 'demand_letter', 'quotation', 'agreement']),
  title: z.string().min(1).max(140),
  headerHtml: z.string().optional().nullable(),
  bodyContent: z.string().optional().default(''),
  footerHtml: z.string().optional().nullable(),
  clauses: z.array(templateClauseSchema).optional(),
  termsAndConditions: z.array(z.string()).optional(),
  showLogo: z.boolean().optional(),
  showQr: z.boolean().optional(),
  showRera: z.boolean().optional(),
  showGst: z.boolean().optional(),
  watermarkText: z.string().optional().nullable(),
  signatures: z.array(z.object({
    role: z.string(),
    label: z.string(),
    signerName: z.string().optional().nullable(),
    required: z.boolean().default(true),
  })).optional(),
  witnesses: z.array(z.object({
    label: z.string(),
    required: z.boolean().default(true),
  })).optional(),
  isDefault: z.boolean().optional(),
});

export const projectBrandingBodySchema = z.object({
  shortName: z.string().max(60).optional().nullable(),
  developerName: z.string().max(140).optional().nullable(),
  companyName: z.string().max(140).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().or(z.literal('')).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  officeAddress: z.string().max(400).optional().nullable(),
  siteAddress: z.string().max(400).optional().nullable(),
  gstNumber: z.string().max(30).optional().nullable(),
  reraNumber: z.string().max(60).optional().nullable(),
  panNumber: z.string().max(30).optional().nullable(),
});

export const projectThemeBodySchema = z.object({
  primary: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color'),
  secondary: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color').optional(),
  accent: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color').optional(),
  success: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color').optional(),
  warning: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color').optional(),
  danger: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color').optional(),
  info: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color').optional(),
});

export const projectReceiptConfigBodySchema = z.object({
  showLogo: z.boolean().optional(),
  showQr: z.boolean().optional(),
  showGst: z.boolean().optional(),
  showRera: z.boolean().optional(),
  showCustomerAddress: z.boolean().optional(),
  showBankDetails: z.boolean().optional(),
  watermarkText: z.string().max(100).optional().nullable(),
  enableDigitalSign: z.boolean().optional(),
  termsAndConditions: z.array(z.string()).optional(),
  authorizedSignatoryTitle: z.string().max(140).optional().nullable(),
  tagline: z.string().max(140).optional().nullable(),
  jurisdiction: z.string().max(140).optional().nullable(),
});

export const projectLegalDocConfigBodySchema = z.object({
  partnershipFirmName: z.string().max(200).optional().nullable(),
  managingPartners: z.array(z.string()).optional(),
  subRegistrarOffice: z.string().max(200).optional().nullable(),
  tpScheme: z.string().max(200).optional().nullable(),
  surveyNumbers: z.string().max(200).optional().nullable(),
  finalPlotNumbers: z.string().max(200).optional().nullable(),
  citySurveyNumbers: z.string().max(200).optional().nullable(),
  projectTagline: z.string().max(140).optional().nullable(),
  jurisdiction: z.string().max(140).optional().nullable(),
});

export const projectRulesBodySchema = z.object({
  bookingRules: z.object({
    minTokenAmount: z.number().nonnegative().optional(),
    tokenValidityDays: z.number().int().positive().optional(),
    cancellationPenaltyPct: z.number().min(0).max(100).optional(),
  }).optional(),
  paymentRules: z.object({
    defaultGstRate: z.number().min(0).max(28).optional(),
    overdueInterestPctPerAnnum: z.number().min(0).max(100).optional(),
    gracePeriodDays: z.number().int().nonnegative().optional(),
  }).optional(),
});
