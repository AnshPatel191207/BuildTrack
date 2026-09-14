import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Payment, nextReceiptNumber } from '../models/Payment';
import { Booking } from '../models/Booking';
import { Unit } from '../models/Unit';
import { Customer } from '../models/Customer';
import { Project } from '../models/Project';
import { Company } from '../models/Company';
import { DocumentTemplate } from '../models/DocumentTemplate';
import { PropertyDocument, nextDocumentNumber } from '../models/PropertyDocument';
import {
  generateReceiptPdf,
  generateLegalDocumentPdf,
} from '../services/pdfGenerator.service';
import {
  renderTemplate,
  DEFAULT_BANAKHAT_TEMPLATE,
  DEFAULT_DASTAVEJ_TEMPLATE,
  numberToWordsINR,
} from '../services/templateEngine.service';
import { hasPermission } from '../utils/permissions';
import { logAudit } from '../utils/audit';
import type { AuthUser } from '../types';

type Req = Request & { validatedBody?: any; validatedQuery?: any };

// ── Receipt Generation ───────────────────────────────────────────

export async function generatePaymentReceipt(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManagePayments') && !hasPermission(user.role, 'canGenerateReceipts')) {
    throw ApiError.forbidden('You do not have permission to generate receipts.');
  }

  const paymentId = req.params.paymentId || req.body.paymentId;
  const payment = await Payment.findOne({ _id: paymentId, companyId: user.companyId })
    .populate('customerId')
    .populate('projectId')
    .populate('bookingId')
    .populate('unitId');

  if (!payment) throw ApiError.notFound('Payment record not found.');
  if (payment.status !== 'paid') {
    throw ApiError.badRequest('Receipts can only be generated for completed/paid payments.');
  }

  // Allocate official receipt number (RCP-YYYY-000001) if not already present
  if (!payment.receiptNumber) {
    payment.receiptNumber = await nextReceiptNumber(user.companyId);
  }

  const company = await Company.findById(user.companyId);
  const customer = payment.customerId as any;
  const project = payment.projectId as any;
  const unit = payment.unitId as any;
  const booking = payment.bookingId as any;

  // Calculate total paid and remaining balance if booking exists
  let totalPaidTillNow = payment.amount;
  let totalUnitValue = unit?.totalValue || booking?.totalValue || 0;

  if (booking) {
    const paidAgg = await Payment.aggregate([
      { $match: { bookingId: booking._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    totalPaidTillNow = paidAgg[0]?.total ?? payment.amount;
  }

  const remainingBalance = Math.max(0, totalUnitValue - totalPaidTillNow);

  // Generate the PDF
  const { relativeUrl } = await generateReceiptPdf({
    receiptNumber: payment.receiptNumber,
    paymentDate: payment.paidDate || payment.createdAt,
    companyName: company?.name || 'BuildTrack Real Estate',
    companyAddress: company?.address || undefined,
    companyPhone: company?.phone || undefined,
    companyEmail: company?.email || undefined,
    companyPan: company?.pan || undefined,
    companyGstin: company?.gstin || undefined,
    customerName: customer?.name || 'Customer',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || undefined,
    customerPan: customer?.pan || undefined,
    customerAddress: customer?.address || undefined,
    projectName: project?.name || 'Real Estate Project',
    projectCode: project?.projectCode || undefined,
    reraNumber: project?.reraNumber || undefined,
    unitNumber: unit?.unitNumber || 'N/A',
    unitType: unit?.unitType || undefined,
    carpetAreaSqft: unit?.carpetAreaSqft || undefined,
    paymentAmount: payment.amount,
    paymentMode: payment.mode || payment.method || 'cash',
    transactionId: payment.transactionId || payment.reference || undefined,
    chequeNumber: payment.chequeNumber || undefined,
    chequeDate: payment.chequeDate || undefined,
    bankName: payment.bankName || undefined,
    totalUnitValue,
    totalPaidTillNow,
    remainingBalance,
    notes: payment.notes || undefined,
  });

  payment.receiptPdfUrl = relativeUrl;
  await payment.save();

  await logAudit(req, {
    action: 'receipt_generated',
    module: 'receipts',
    entityType: 'payment',
    entityId: payment._id,
    description: `${user.name} generated receipt ${payment.receiptNumber} for payment of ₹${payment.amount}`,
  });

  const verificationQrCode = await QRCode.toDataURL(
    `BuildTrack Receipt: ${payment.receiptNumber} | Amount: ₹${payment.amount} | Date: ${new Date(payment.paidDate || payment.createdAt).toLocaleDateString('en-IN')}`,
    { width: 150, margin: 1 },
  );

  sendCreated(res, {
    paymentId: payment._id,
    receiptNumber: payment.receiptNumber,
    receiptPdfUrl: payment.receiptPdfUrl,
    verificationQrCode,
    amountInWords: numberToWordsINR(payment.amount),
  }, `Receipt ${payment.receiptNumber} generated.`);
}

// ── Banakhat (Agreement for Sale) Generation ───────────────────────

export async function generateBanakhatDocument(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageDocuments') && !hasPermission(user.role, 'canGenerateBanakhat')) {
    throw ApiError.forbidden('You do not have permission to generate Banakhat.');
  }

  const { bookingId } = req.params;
  const booking = await Booking.findOne({ _id: bookingId, companyId: user.companyId })
    .populate('customerId')
    .populate('projectId')
    .populate('unitId');

  if (!booking) throw ApiError.notFound('Booking record not found.');

  const company = await Company.findById(user.companyId);
  const customer = booking.customerId as any;
  const project = booking.projectId as any;
  const unit = booking.unitId as any;

  // Retrieve company-specific template or use built-in default
  let templateBody = DEFAULT_BANAKHAT_TEMPLATE;
  const customTemplate = await DocumentTemplate.findOne({
    companyId: user.companyId,
    templateType: 'banakhat',
    isDefault: true,
  });
  if (customTemplate && customTemplate.bodyContent) {
    templateBody = customTemplate.bodyContent;
  }

  // Populate dynamic variables
  const documentNumber = await nextDocumentNumber(user.companyId, 'banakhat');
  const totalAmount = unit?.totalValue || booking.totalValue || 0;
  const basePrice = unit?.basePrice || totalAmount * 0.95;
  const gstAmount = unit?.gstAmount || totalAmount * 0.05;

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const context = {
    today_date: todayStr,
    company_name: company?.name || 'Developer',
    company_address: company?.address || 'City',
    company_phone: company?.phone || '',
    builder_name: project?.builderName || company?.name || 'Developer',
    project_name: project?.name || 'Project',
    project_code: project?.projectCode || '',
    project_location: project?.location || project?.address || 'City',
    rera_number: project?.reraNumber || 'Applied / Pending',
    tower_name: unit?.towerName || 'Tower A',
    floor_name: unit?.floorName || '1st Floor',
    flat_number: unit?.unitNumber || 'Unit',
    unit_type: unit?.unitType || 'Flat',
    carpet_area: unit?.carpetAreaSqft || unit?.areaSqft || 0,
    builtup_area: unit?.builtUpAreaSqft || unit?.areaSqft || 0,
    facing: unit?.facing || 'Main Entrance',
    parking_slot: unit?.parkingSlot || 'Allotted Space',
    parking_charges: unit?.parkingCharges || 0,
    base_price: Math.round(basePrice).toLocaleString('en-IN'),
    gst_amount: Math.round(gstAmount).toLocaleString('en-IN'),
    total_amount: Math.round(totalAmount).toLocaleString('en-IN'),
    total_amount_in_words: numberToWordsINR(totalAmount),
    booking_number: booking.bookingNumber,
    booking_date: new Date(booking.bookingDate).toLocaleDateString('en-IN'),
    booking_amount: Math.round(booking.bookingAmount).toLocaleString('en-IN'),
    discount_amount: booking.discountAmount || 0,
    customer_name: customer?.name || 'Buyer',
    customer_phone: customer?.phone || '',
    customer_email: customer?.email || '',
    customer_address: customer?.address || 'Address',
    customer_pan: customer?.pan || 'N/A',
    customer_aadhaar: customer?.aadhaar || 'N/A',
    nominee_name: customer?.nominee?.name || 'N/A',
    nominee_relation: customer?.nominee?.relation || 'N/A',
    nominee_age: customer?.nominee?.age || 'N/A',
  };

  const renderedContent = renderTemplate(templateBody, context);

  // Generate PDF file
  const { relativeUrl } = await generateLegalDocumentPdf({
    title: 'Agreement for Sale (Banakhat)',
    documentNumber,
    companyName: company?.name || 'Developer',
    projectName: project?.name || 'Project',
    reraNumber: project?.reraNumber || undefined,
    bodyContent: renderedContent,
    todayDate: todayStr,
  });

  const propertyDoc = await PropertyDocument.create({
    companyId: user.companyId,
    projectId: project._id,
    bookingId: booking._id,
    customerId: customer._id,
    unitId: unit?._id || null,
    documentType: 'banakhat',
    documentNumber,
    title: `Banakhat — ${customer.name} (${unit?.unitNumber || 'Unit'})`,
    renderedContent,
    pdfUrl: relativeUrl,
    status: 'generated',
    generatedBy: user._id,
  });

  booking.banakhatDocumentId = propertyDoc._id;
  await booking.save();

  await logAudit(req, {
    action: 'banakhat_generated',
    module: 'documents',
    entityType: 'property_document',
    entityId: propertyDoc._id,
    description: `${user.name} generated Banakhat ${documentNumber} for Unit ${unit?.unitNumber}`,
  });

  sendCreated(res, propertyDoc, `Banakhat ${documentNumber} generated successfully.`);
}

// ── Dastavej (Conveyance / Sale Deed) Generation ───────────────────

export async function generateDastavejDocument(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageDocuments') && !hasPermission(user.role, 'canGenerateDastavej')) {
    throw ApiError.forbidden('You do not have permission to generate Dastavej.');
  }

  const { bookingId } = req.params;
  const booking = await Booking.findOne({ _id: bookingId, companyId: user.companyId })
    .populate('customerId')
    .populate('projectId')
    .populate('unitId');

  if (!booking) throw ApiError.notFound('Booking record not found.');

  const company = await Company.findById(user.companyId);
  const customer = booking.customerId as any;
  const project = booking.projectId as any;
  const unit = booking.unitId as any;

  let templateBody = DEFAULT_DASTAVEJ_TEMPLATE;
  const customTemplate = await DocumentTemplate.findOne({
    companyId: user.companyId,
    templateType: 'dastavej',
    isDefault: true,
  });
  if (customTemplate && customTemplate.bodyContent) {
    templateBody = customTemplate.bodyContent;
  }

  const documentNumber = await nextDocumentNumber(user.companyId, 'dastavej');
  const totalAmount = unit?.totalValue || booking.totalValue || 0;
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const context = {
    today_date: todayStr,
    company_name: company?.name || 'Vendor',
    company_address: company?.address || 'Address',
    builder_name: project?.builderName || company?.name || 'Vendor',
    project_name: project?.name || 'Project',
    project_location: project?.location || project?.address || 'City',
    tower_name: unit?.towerName || 'Tower A',
    floor_name: unit?.floorName || '1st Floor',
    flat_number: unit?.unitNumber || 'Unit',
    carpet_area: unit?.carpetAreaSqft || unit?.areaSqft || 0,
    builtup_area: unit?.builtUpAreaSqft || unit?.areaSqft || 0,
    parking_slot: unit?.parkingSlot || 'Dedicated Slot',
    total_amount: Math.round(totalAmount).toLocaleString('en-IN'),
    total_amount_in_words: numberToWordsINR(totalAmount),
    customer_name: customer?.name || 'Purchaser',
    customer_pan: customer?.pan || 'N/A',
    customer_aadhaar: customer?.aadhaar || 'N/A',
    customer_address: customer?.address || 'Address',
  };

  const renderedContent = renderTemplate(templateBody, context);

  const { relativeUrl } = await generateLegalDocumentPdf({
    title: 'Deed of Conveyance (Dastavej)',
    documentNumber,
    companyName: company?.name || 'Vendor',
    projectName: project?.name || 'Project',
    reraNumber: project?.reraNumber || undefined,
    bodyContent: renderedContent,
    todayDate: todayStr,
  });

  const propertyDoc = await PropertyDocument.create({
    companyId: user.companyId,
    projectId: project._id,
    bookingId: booking._id,
    customerId: customer._id,
    unitId: unit?._id || null,
    documentType: 'dastavej',
    documentNumber,
    title: `Dastavej — ${customer.name} (${unit?.unitNumber || 'Unit'})`,
    renderedContent,
    pdfUrl: relativeUrl,
    status: 'generated',
    generatedBy: user._id,
  });

  booking.dastavejDocumentId = propertyDoc._id;
  await booking.save();

  await logAudit(req, {
    action: 'dastavej_generated',
    module: 'documents',
    entityType: 'property_document',
    entityId: propertyDoc._id,
    description: `${user.name} generated Dastavej ${documentNumber} for Unit ${unit?.unitNumber}`,
  });

  sendCreated(res, propertyDoc, `Dastavej ${documentNumber} generated successfully.`);
}

// ── Template Management ──────────────────────────────────────────

export async function listDocumentTemplates(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const templates = await DocumentTemplate.find({ companyId: user.companyId }).sort({ createdAt: -1 });
  sendSuccess(res, templates);
}

export async function createDocumentTemplate(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageTemplates')) {
    throw ApiError.forbidden('You cannot manage templates.');
  }

  const body = req.validatedBody;
  if (body.isDefault) {
    await DocumentTemplate.updateMany(
      { companyId: user.companyId, templateType: body.templateType },
      { $set: { isDefault: false } },
    );
  }

  const template = await DocumentTemplate.create({
    ...body,
    companyId: user.companyId,
    createdBy: user._id,
  });

  sendCreated(res, template, 'Template created.');
}
