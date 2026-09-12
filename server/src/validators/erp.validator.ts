import { z } from 'zod';
import { isValidDateString } from '../utils/dates';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().refine(isValidDateString, 'Enter a valid date (YYYY-MM-DD)');
const nullableIsoDate = isoDate.nullable().optional().or(z.literal(''));
const phone = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
  .or(z.literal(''));
const optionalText = (max: number) => z.string().trim().max(max).optional();
const money = z.coerce.number().min(0, 'Amount cannot be negative').max(1e12);
const positiveMoney = z.coerce.number().min(0.01, 'Enter an amount').max(1e12);
const pageQuery = {
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

// ── Project structure ────────────────────────────────────────────
const nodeType = z.enum(['phase', 'block', 'floor', 'unit', 'zone', 'area', 'custom']);

export const structureNodeBodySchema = z.object({
  projectId: objectId,
  nodeType,
  name: z.string().trim().min(1, 'Name is required').max(120),
  parentId: objectId.nullable().optional(),
  customType: optionalText(40),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  description: optionalText(500),
});

export const structureNodeUpdateSchema = structureNodeBodySchema.partial();

export const structureQuerySchema = z.object({
  projectId: objectId,
});

export const structureNodeQuerySchema = z.object({
  projectId: objectId.optional(),
  parentId: objectId.nullable().optional(),
  nodeType: nodeType.optional(),
  ...pageQuery,
});

// ── Units ────────────────────────────────────────────────────────
export const unitBodySchema = z.object({
  projectId: objectId,
  phaseId: objectId.nullable().optional(),
  blockId: objectId.nullable().optional(),
  floorId: objectId.nullable().optional(),
  unitNumber: z.string().trim().min(1, 'Unit number is required').max(30),
  unitType: z.string().trim().min(1, 'Unit type is required').max(40),
  areaSqft: money.optional(),
  carpetAreaSqft: money.optional(),
  superBuiltupAreaSqft: money.optional(),
  facing: optionalText(20),
  ratePerSqft: money.optional(),
  totalValue: money,
  status: z.enum(['available', 'reserved', 'booked', 'sold', 'blocked', 'cancelled']).optional(),
  notes: optionalText(500),
});

export const unitUpdateSchema = unitBodySchema.partial().omit({ projectId: true });

export const unitQuerySchema = z.object({
  projectId: objectId.optional(),
  status: z
    .enum(['available', 'reserved', 'booked', 'sold', 'blocked', 'cancelled'])
    .optional(),
  unitType: z.string().trim().max(40).optional(),
  blockId: objectId.optional(),
  floorId: objectId.optional(),
  ...pageQuery,
});

// ── Customers ────────────────────────────────────────────────────
export const customerTimelineSchema = z.object({
  stage: z.enum(['inquiry', 'visit', 'negotiation', 'booking', 'payment', 'possession']),
  note: optionalText(300),
});

export const customerBodySchema = z.object({
  projectId: objectId.nullable().optional(),
  name: z.string().trim().min(2, 'Customer name is required').max(120),
  phone,
  email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')).nullable().optional(),
  address: optionalText(300),
  city: optionalText(80),
  state: optionalText(80),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like ABCDE1234F')
    .or(z.literal(''))
    .nullable()
    .optional(),
  aadhaar: z
    .string()
    .trim()
    .regex(/^\d{12}$/, 'Aadhaar must be 12 digits')
    .or(z.literal(''))
    .nullable()
    .optional(),
  occupation: optionalText(80),
  leadSource: z
    .enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other'])
    .default('other'),
  journeyStage: z
    .enum(['inquiry', 'visit', 'negotiation', 'booking', 'payment', 'possession'])
    .default('inquiry'),
  assignedTo: objectId.nullable().optional(),
});

export const customerUpdateSchema = customerBodySchema.partial();

export const customerQuerySchema = z.object({
  projectId: objectId.optional(),
  leadSource: z
    .enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other'])
    .optional(),
  journeyStage: z
    .enum(['inquiry', 'visit', 'negotiation', 'booking', 'payment', 'possession'])
    .optional(),
  ...pageQuery,
});

// ── Leads ────────────────────────────────────────────────────────
const leadStageEnum = z.enum([
  'new',
  'contacted',
  'site_visit_scheduled',
  'site_visit_completed',
  'proposal_sent',
  'negotiation',
  'booked',
  'lost',
]);

export const leadBodySchema = z.object({
  projectId: objectId.nullable().optional(),
  name: z.string().trim().min(2, 'Lead name is required').max(120),
  phone,
  email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')).nullable().optional(),
  source: z
    .enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other'])
    .default('other'),
  stage: leadStageEnum.default('new'),
  interestedIn: optionalText(160),
  budgetMin: money.nullable().optional(),
  budgetMax: money.nullable().optional(),
  assignedTo: objectId.nullable().optional(),
  nextFollowUpDate: nullableIsoDate,
  notes: optionalText(500),
});

export const leadUpdateSchema = z.object({
  stage: leadStageEnum.optional(),
  interestedIn: optionalText(160),
  budgetMin: money.nullable().optional(),
  budgetMax: money.nullable().optional(),
  assignedTo: objectId.nullable().optional(),
  nextFollowUpDate: nullableIsoDate,
  lostReason: optionalText(300),
  projectId: objectId.nullable().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
    .or(z.literal(''))
    .optional(),
  source: z
    .enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other'])
    .optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')).nullable().optional(),
});

export const leadFollowUpSchema = z.object({
  date: isoDate,
  note: optionalText(300),
});

export const leadNoteSchema = z.object({
  text: z.string().trim().min(1, 'Note text is required').max(500),
});

export const leadConvertSchema = z.object({
  customerId: objectId,
});

export const leadQuerySchema = z.object({
  projectId: objectId.optional(),
  stage: leadStageEnum.optional(),
  source: z
    .enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other'])
    .optional(),
  assignedTo: objectId.optional(),
  ...pageQuery,
});

// ── Bookings ─────────────────────────────────────────────────────
export const bookingBodySchema = z
  .object({
    projectId: objectId,
    unitId: objectId,
    customerId: objectId,
    bookingDate: isoDate,
    bookingAmount: positiveMoney,
    salesManagerId: objectId.nullable().optional(),
    notes: optionalText(1000),
  })
  .refine((d) => !d.salesManagerId || d.salesManagerId !== '', {
    message: 'Invalid sales manager',
    path: ['salesManagerId'],
  });

export const bookingActionSchema = z.object({
  action: z.enum(['confirm', 'cancel', 'mark_sold', 'mark_possession']),
  cancellationReason: optionalText(300),
  possessionDate: nullableIsoDate,
});

export const bookingScheduleSchema = z.object({
  installments: z.coerce.number().int().min(1, 'At least one installment').max(60),
  startDate: isoDate,
  frequencyMonths: z.coerce.number().int().min(1).max(24).default(1),
});

export const bookingQuerySchema = z.object({
  projectId: objectId.optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'sold']).optional(),
  customerId: objectId.optional(),
  salesManagerId: objectId.optional(),
  ...pageQuery,
});

// ── Payments ─────────────────────────────────────────────────────
export const paymentBodySchema = z.object({
  projectId: objectId.nullable().optional(),
  bookingId: objectId.nullable().optional(),
  customerId: objectId,
  amount: positiveMoney,
  paymentType: z.enum(['booking_amount', 'installment', 'milestone', 'final']),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'loan', 'other']).default('bank_transfer'),
  dueDate: nullableIsoDate,
  paidDate: nullableIsoDate,
  reference: optionalText(80),
  notes: optionalText(500),
});

export const paymentUpdateSchema = z.object({
  amount: positiveMoney.optional(),
  paymentType: z.enum(['booking_amount', 'installment', 'milestone', 'final']).optional(),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'loan', 'other']).optional(),
  dueDate: nullableIsoDate,
  paidDate: nullableIsoDate,
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  reference: optionalText(80),
  notes: optionalText(500),
});

export const markPaidSchema = z.object({
  paidDate: isoDate.optional(),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'loan', 'other']).optional(),
  reference: optionalText(80),
});

export const paymentQuerySchema = z.object({
  projectId: objectId.optional(),
  bookingId: objectId.optional(),
  customerId: objectId.optional(),
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  paymentType: z.enum(['booking_amount', 'installment', 'milestone', 'final']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  from: nullableIsoDate,
  to: nullableIsoDate,
  ...pageQuery,
});

// ── Contractors ──────────────────────────────────────────────────
const workTypeEnum = z.enum([
  'rcc',
  'brickwork',
  'plumbing',
  'electrical',
  'painting',
  'flooring',
  'interior',
  'other',
]);

export const contractorBodySchema = z.object({
  name: z.string().trim().min(2, 'Contractor name is required').max(120),
  companyName: optionalText(160),
  phone,
  email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')).nullable().optional(),
  address: optionalText(300),
  workTypes: z.array(workTypeEnum).min(1, 'Pick at least one work type'),
  specialty: optionalText(160),
  gstNumber: optionalText(15),
});

export const contractorUpdateSchema = contractorBodySchema.partial();

export const contractorQuerySchema = z.object({
  workType: workTypeEnum.optional(),
  ...pageQuery,
});

export const contractBodySchema = z.object({
  projectId: objectId,
  scope: z.string().trim().min(2, 'Describe the scope of work').max(200),
  contractValue: positiveMoney,
  startDate: nullableIsoDate,
  endDate: nullableIsoDate,
  notes: optionalText(500),
});

export const contractUpdateSchema = z.object({
  scope: z.string().trim().min(2).max(200).optional(),
  contractValue: positiveMoney.optional(),
  startDate: nullableIsoDate,
  endDate: nullableIsoDate,
  status: z.enum(['active', 'completed', 'terminated']).optional(),
  notes: optionalText(500),
});

export const contractPaymentBodySchema = z.object({
  paymentType: z.enum(['advance', 'running_bill', 'final_settlement']),
  amount: positiveMoney,
  date: isoDate,
  method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']).default('bank_transfer'),
  reference: optionalText(80),
  notes: optionalText(500),
});

// ── Vendors ──────────────────────────────────────────────────────
export const vendorBodySchema = z.object({
  name: z.string().trim().min(2, 'Vendor name is required').max(140),
  companyName: optionalText(160),
  contactPerson: optionalText(120),
  phone,
  email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')).nullable().optional(),
  address: optionalText(300),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}$/, 'Enter a valid GST number')
    .or(z.literal(''))
    .nullable()
    .optional(),
  // Accepts ["cement","steel"] or the raw form input "cement, steel".
  materialsSupplied: z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        : value,
    z.array(z.string().trim().max(80, 'Each material must be under 80 characters')).default([]),
  ),
});

export const vendorUpdateSchema = vendorBodySchema.partial();

export const vendorQuerySchema = z.object({
  ...pageQuery,
});

// ── Purchase orders ──────────────────────────────────────────────
export const poItemSchema = z.object({
  materialName: z.string().trim().min(1, 'Material name is required').max(160),
  category: optionalText(40),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit: optionalText(20),
  rate: money,
});

export const poBodySchema = z
  .object({
    projectId: objectId,
    vendorId: objectId,
    items: z.array(poItemSchema).min(1, 'Add at least one material line'),
    expectedDeliveryDate: nullableIsoDate,
    notes: optionalText(1000),
    submitForApproval: z.boolean().optional(),
  })
  .transform((d) => ({
    ...d,
    items: d.items.map((i) => ({ ...i, amount: Math.round(i.quantity * i.rate * 100) / 100 })),
  }));

export const poUpdateSchema = z.object({
  items: z.array(poItemSchema).min(1).optional(),
  expectedDeliveryDate: nullableIsoDate,
  notes: optionalText(1000),
});

export const poTransitionSchema = z.object({
  action: z.enum(['submit_approval', 'order', 'deliver', 'close', 'cancel']),
  invoiceNumber: optionalText(60),
});

export const poPaymentSchema = z.object({
  amount: positiveMoney,
  date: isoDate,
  method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']).default('bank_transfer'),
  reference: optionalText(80),
});

export const poQuerySchema = z.object({
  projectId: objectId.optional(),
  vendorId: objectId.optional(),
  status: z
    .enum(['draft', 'approved', 'ordered', 'delivered', 'closed', 'cancelled'])
    .optional(),
  ...pageQuery,
});

// ── Equipment ────────────────────────────────────────────────────
export const equipmentBodySchema = z.object({
  projectId: objectId.nullable().optional(),
  equipmentNumber: z
    .string()
    .trim()
    .min(1, 'Equipment number is required')
    .max(30)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2, 'Equipment name is required').max(140),
  type: z
    .enum([
      'excavator',
      'crane',
      'mixer',
      'lift',
      'generator',
      'jcb',
      'tractor',
      'pump',
      'scaffolding',
      'other',
    ])
    .default('other'),
  ownership: z.enum(['owned', 'rented']).default('owned'),
  purchaseCost: money.optional(),
  rentalCostPerDay: money.optional(),
  purchaseDate: nullableIsoDate,
  status: z.enum(['active', 'idle', 'maintenance', 'retired']).optional(),
  notes: optionalText(500),
});

export const equipmentUpdateSchema = equipmentBodySchema.partial();

export const equipmentLogSchema = z.object({
  date: isoDate,
  hoursUsed: money.optional(),
  fuelCost: money.optional(),
  maintenanceCost: money.optional(),
  note: optionalText(300),
});

export const equipmentQuerySchema = z.object({
  projectId: objectId.optional(),
  type: z.string().trim().max(30).optional(),
  ownership: z.enum(['owned', 'rented']).optional(),
  status: z.enum(['active', 'idle', 'maintenance', 'retired']).optional(),
  ...pageQuery,
});

// ── Documents ────────────────────────────────────────────────────
export const documentCategoryEnum = z.enum([
  'drawing',
  'floor_plan',
  'agreement',
  'noc',
  'government_approval',
  'structural_drawing',
  'site_document',
  'customer_document',
  'other',
]);

export const documentMetaSchema = z.object({
  title: z.string().trim().min(2, 'Document title is required').max(160),
  category: documentCategoryEnum.default('other'),
  projectId: objectId.nullable().optional(),
  customerId: objectId.nullable().optional(),
  expiryDate: nullableIsoDate,
  notes: optionalText(500),
});

export const documentQuerySchema = z.object({
  projectId: objectId.optional(),
  customerId: objectId.optional(),
  category: documentCategoryEnum.optional(),
  expiring: z.enum(['true', 'false']).optional(),
  ...pageQuery,
});

// ── Approvals ────────────────────────────────────────────────────
export const approvalActionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_changes']),
  comment: optionalText(300),
});

export const approvalCreateSchema = z.object({
  entityType: z.enum(['expense', 'purchase_order', 'booking', 'custom']),
  entityId: objectId.nullable().optional(),
  projectId: objectId.nullable().optional(),
  title: z.string().trim().min(2, 'Title is required').max(200),
  amount: money.nullable().optional(),
});

export const approvalQuerySchema = z.object({
  entityType: z.enum(['expense', 'purchase_order', 'booking', 'custom']).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'changes_requested']).optional(),
  requestedBy: objectId.optional(),
  mine: z.enum(['true', 'false']).optional(),
  ...pageQuery,
});

// ── Milestones ───────────────────────────────────────────────────
export const milestoneBodySchema = z
  .object({
    projectId: objectId,
    name: z.string().trim().min(2, 'Milestone name is required').max(160),
    description: optionalText(500),
    dueDate: isoDate,
    notifyBeforeDays: z.coerce.number().int().min(0).max(90).optional(),
  })
  .refine((d) => Boolean(d.projectId), { message: 'Project is required', path: ['projectId'] });

export const milestoneUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: optionalText(500),
  dueDate: isoDate.optional(),
  completed: z.boolean().optional(),
  notifyBeforeDays: z.coerce.number().int().min(0).max(90).optional(),
});

export const milestoneQuerySchema = z.object({
  projectId: objectId.optional(),
  view: z.enum(['upcoming', 'delayed', 'completed', 'all']).optional(),
  ...pageQuery,
});

// ── Construction stages & work items ─────────────────────────────
const stageStatusEnum = z.enum(['not_started', 'in_progress', 'completed', 'on_hold']);

export const stageUpdateSchema = z.object({
  startDate: nullableIsoDate,
  endDate: nullableIsoDate,
  status: stageStatusEnum.optional(),
  progressPercentage: z.coerce.number().min(0).max(100).optional(),
  notes: optionalText(500),
});

export const stageQuerySchema = z.object({
  projectId: objectId,
});

export const workItemBodySchema = z
  .object({
    projectId: objectId,
    nodeId: objectId.nullable().optional(),
    name: z.string().trim().min(2, 'Work item name is required').max(160),
    stageName: z
      .enum([
        'excavation',
        'foundation',
        'rcc_structure',
        'brickwork',
        'plaster',
        'electrical',
        'plumbing',
        'flooring',
        'painting',
        'finishing',
        'landscaping',
        'handover',
        'custom',
      ])
      .nullable()
      .optional(),
    startDate: nullableIsoDate,
    endDate: nullableIsoDate,
    status: stageStatusEnum.default('not_started'),
    notes: optionalText(500),
  });

export const workItemUpdateSchema = z.object({
  progressPercentage: z.coerce.number().min(0).max(100).optional(),
  status: stageStatusEnum.optional(),
  startDate: nullableIsoDate,
  endDate: nullableIsoDate,
  notes: optionalText(500),
});

export const workItemQuerySchema = z.object({
  projectId: objectId.optional(),
  nodeId: objectId.optional(),
  status: stageStatusEnum.optional(),
  ...pageQuery,
});
