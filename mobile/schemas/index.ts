import { z } from 'zod';

const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{9}$/;

export const phoneField = z
  .string()
  .trim()
  .regex(phoneRegex, 'Enter a valid 10-digit Indian mobile number')
  .transform((p) => p.replace(/[\s-]/g, '').replace(/^\+91/, ''));

export const optionalPhoneField = z
  .union([phoneField, z.literal('')])
  .optional();

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(120),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    phone: phoneField,
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-zA-Z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(120),
  phone: optionalPhoneField,
  email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
  address: z.string().trim().max(300).optional(),
});

export const projectSchema = z
  .object({
    name: z.string().trim().min(3, 'Project name must be at least 3 characters').max(140),
    clientName: z.string().trim().max(120).optional(),
    clientPhone: optionalPhoneField,
    location: z.string().trim().min(2, 'Location helps your team find the site').max(160),
    projectType: z.enum([
      'residential', 'commercial', 'industrial', 'renovation',
      'infrastructure', 'interior', 'other',
    ]),
    startDate: z.string().min(10, 'Pick a start date'),
    expectedEndDate: z.union([z.string(), z.literal('')]).optional(),
    budget: z.coerce.number().min(0, 'Budget cannot be negative'),
    description: z.string().trim().max(1000).optional(),
  })
  .refine(
    (d) => !d.expectedEndDate || !d.startDate || d.expectedEndDate >= d.startDate,
    { message: 'End date must be after the start date', path: ['expectedEndDate'] },
  );

export const expenseSchema = z.object({
  title: z.string().trim().min(3, 'Give this expense a short title').max(160),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount' })
    .positive('Amount must be greater than ₹0')
    .max(1_000_000_000, 'That amount looks too large'),
  category: z.enum([
    'materials', 'labor', 'transportation', 'equipment', 'electricity',
    'permits', 'food', 'maintenance', 'miscellaneous',
  ]),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']),
  date: z.string().min(10, 'Pick a date'),
  projectId: z.string().min(24, 'Choose a project'),
  description: z.string().trim().max(500).optional(),
});

export const workerSchema = z.object({
  name: z.string().trim().min(2, 'Worker name is required').max(120),
  phone: optionalPhoneField,
  workerType: z.enum([
    'mason', 'helper', 'electrician', 'plumber', 'carpenter',
    'painter', 'welder', 'operator', 'other',
  ]),
  dailyWage: z.coerce.number().min(0, 'Wage cannot be negative'),
  skill: z.string().trim().max(120).optional(),
  projectId: z.union([z.string(), z.literal('')]).optional(),
  joiningDate: z.string().min(10, 'Pick a joining date'),
});

export const materialSchema = z.object({
  name: z.string().trim().min(2, 'Material name is required').max(140),
  category: z.enum([
    'cement', 'steel', 'sand', 'aggregate', 'bricks', 'tiles',
    'plumbing', 'electrical', 'paint', 'hardware', 'other',
  ]),
  unit: z.enum([
    'bag', 'kg', 'quintal', 'ton', 'brass', 'cft', 'sqft', 'litre',
    'meter', 'roll', 'piece', 'packet', 'box', 'trip', 'other',
  ]),
  currentStock: z.coerce.number().min(0, 'Stock cannot be negative'),
  minimumStock: z.coerce.number().min(0, 'Minimum stock cannot be negative'),
  averagePrice: z.coerce.number().min(0, 'Price cannot be negative'),
  supplier: z.string().trim().max(160).optional(),
});

export const transactionSchema = z.object({
  quantity: z.coerce.number({ invalid_type_error: 'Enter a quantity' }).refine((q) => q !== 0, 'Quantity cannot be zero'),
  unitPrice: z.coerce.number().min(0).optional(),
  supplier: z.string().trim().max(160).optional(),
  invoiceNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(3, 'Task title is required').max(160),
  description: z.string().trim().max(1000).optional(),
  assignedTo: z.union([z.string(), z.literal('')]).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'completed', 'blocked']),
  dueDate: z.union([z.string(), z.literal('')]).optional(),
});

export const reportSchema = z.object({
  date: z.string().min(10),
  weather: z.enum(['sunny', 'cloudy', 'rainy', 'humid', 'windy', 'other']),
  workersPresent: z.coerce.number().int().min(0, 'Cannot be negative'),
  workCompleted: z.string().trim().min(3, 'Describe the work completed today').max(2000),
  summary: z.string().trim().max(2000).optional(),
  materialsUsed: z.string().trim().max(1000).optional(),
  issues: z.string().trim().max(1000).optional(),
  safetyNotes: z.string().trim().max(1000).optional(),
  tomorrowPlan: z.string().trim().max(1000).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type ProjectFormInput = z.input<typeof projectSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type WorkerFormInput = z.infer<typeof workerSchema>;
export type MaterialFormInput = z.infer<typeof materialSchema>;
export type TaskFormInput = z.infer<typeof taskSchema>;
export type ReportFormInput = z.infer<typeof reportSchema>;

// -- ERP form schemas ---------------------------------------------

const optionalDate = z.union([z.string(), z.literal('')]).optional();

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Customer name is required').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  pan: z
    .union([
      z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like ABCDE1234F'),
      z.literal(''),
    ])
    .optional(),
  occupation: z.string().trim().max(80).optional(),
  leadSource: z.enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other']),
  journeyStage: z.enum(['inquiry', 'visit', 'negotiation', 'booking', 'payment', 'possession']),
});

export const leadSchema = z.object({
  name: z.string().trim().min(2, 'Lead name is required').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  source: z.enum(['website', 'walk_in', 'reference', 'facebook', 'instagram', 'broker', 'other']),
  stage: z.enum([
    'new', 'contacted', 'site_visit_scheduled', 'site_visit_completed',
    'proposal_sent', 'negotiation', 'booked', 'lost',
  ]),
  interestedIn: z.string().trim().max(160).optional(),
  projectId: z.union([z.string(), z.literal('')]).optional(),
});

export const unitSchema = z.object({
  projectId: z.string().min(24, 'Choose a project'),
  unitNumber: z.string().trim().min(1, 'Unit number is required').max(30),
  unitType: z.string().trim().min(1, 'Unit type is required').max(40),
  areaSqft: z.coerce.number().min(0).optional(),
  ratePerSqft: z.coerce.number().min(0).optional(),
  totalValue: z.coerce
    .number({ invalid_type_error: 'Enter the total value' })
    .positive('Enter the total value'),
  facing: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const bookingSchema = z.object({
  projectId: z.string().min(24, 'Choose a project'),
  customerId: z.string().min(24, 'Choose a customer'),
  bookingAmount: z.coerce
    .number({ invalid_type_error: 'Enter the booking amount' })
    .positive('Booking amount must be greater than ?0'),
  bookingDate: z.string().min(10, 'Pick a date'),
  notes: z.string().trim().max(1000).optional(),
});

export const paymentSchema = z.object({
  projectId: z.string().min(24, 'Choose a project'),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount' })
    .positive('Amount must be greater than ?0'),
  paymentType: z.enum(['booking_amount', 'installment', 'milestone', 'final']),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'loan', 'other']),
  dueDate: optionalDate,
  paidDate: optionalDate,
  reference: z.string().trim().max(80).optional(),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2, 'Vendor name is required').max(140),
  companyName: z.string().trim().max(160).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.union([
    z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid mobile number'),
    z.literal(''),
  ]).optional(),
  gstNumber: z.union([
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}$/, 'Enter a valid GSTIN (e.g. 24ABCDE1234F1Z5)'),
    z.literal(''),
  ]).optional(),
  materialsSupplied: z.string().trim().max(300).optional(),
});

export const contractorSchema = z.object({
  name: z.string().trim().min(2, 'Contractor name is required').max(120),
  companyName: z.string().trim().max(160).optional(),
  phone: z.union([
    z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid mobile number'),
    z.literal(''),
  ]).optional(),
  workType: z.enum(['rcc', 'brickwork', 'plumbing', 'electrical', 'painting', 'flooring', 'interior', 'other']),
  gstNumber: z.string().trim().max(15).optional(),
});

export const equipmentSchema = z.object({
  projectId: z.union([z.string(), z.literal('')]).optional(),
  equipmentNumber: z.string().trim().min(1, 'Equipment number is required').max(30),
  name: z.string().trim().min(2, 'Equipment name is required').max(140),
  type: z.enum(['excavator', 'crane', 'mixer', 'lift', 'generator', 'jcb', 'tractor', 'pump', 'scaffolding', 'other']),
  ownership: z.enum(['owned', 'rented']),
  purchaseCost: z.coerce.number().min(0).optional(),
  rentalCostPerDay: z.coerce.number().min(0).optional(),
});

export const milestoneSchema = z.object({
  projectId: z.string().min(24, 'Choose a project'),
  name: z.string().trim().min(2, 'Milestone name is required').max(160),
  dueDate: z.string().min(10, 'Pick a due date'),
  description: z.string().trim().max(500).optional(),
});

export type CustomerFormInput = z.infer<typeof customerSchema>;
export type LeadFormInput = z.infer<typeof leadSchema>;
export type UnitFormInput = z.infer<typeof unitSchema>;
export type BookingFormInput = z.input<typeof bookingSchema>;
export type PaymentFormInput = z.input<typeof paymentSchema>;
export type VendorFormInput = z.infer<typeof vendorSchema>;
export type ContractorFormInput = z.infer<typeof contractorSchema>;
export type EquipmentFormInput = z.input<typeof equipmentSchema>;
export type MilestoneFormInput = z.input<typeof milestoneSchema>;
