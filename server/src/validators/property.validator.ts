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

export const templateBodySchema = z.object({
  templateType: z.enum(['receipt', 'banakhat', 'dastavej', 'booking_confirmation', 'demand_letter']),
  title: z.string().min(1).max(140),
  headerHtml: z.string().optional().nullable(),
  bodyContent: z.string().min(10),
  footerHtml: z.string().optional().nullable(),
  termsAndConditions: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});
