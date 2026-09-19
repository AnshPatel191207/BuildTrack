import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
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
  compileClauses,
  VARIABLE_REGISTRY,
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

  // Dynamic branding, theme, and logo resolution
  const projectBranding = project?.branding || {};
  const projectTheme = project?.theme || {};
  const receiptConfig = project?.receiptConfig || {};

  const logoRelative = projectBranding.logoUrl || company?.logo;
  const logoPath = logoRelative ? path.resolve(process.cwd(), logoRelative.replace(/^\//, '')) : undefined;

  // Generate the PDF
  const { relativeUrl } = await generateReceiptPdf({
    receiptNumber: payment.receiptNumber,
    paymentDate: payment.paidDate || payment.createdAt,
    companyName: projectBranding.companyName || company?.name || 'BuildTrack Real Estate',
    companyAddress: projectBranding.officeAddress || company?.address || undefined,
    companyPhone: projectBranding.phone || company?.phone || undefined,
    companyEmail: projectBranding.email || company?.email || undefined,
    companyPan: projectBranding.panNumber || company?.pan || undefined,
    companyGstin: projectBranding.gstNumber || company?.gstin || undefined,
    customerName: customer?.name || 'Customer',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || undefined,
    customerPan: customer?.pan || undefined,
    customerAddress: customer?.address || undefined,
    projectName: project?.name || 'Real Estate Project',
    projectCode: project?.projectCode || undefined,
    developerName: projectBranding.developerName || project?.builderName || company?.name,
    reraNumber: projectBranding.reraNumber || project?.reraNumber || undefined,
    towerName: unit?.towerName || undefined,
    floorName: unit?.floorName || undefined,
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
    // Dynamic settings
    logoPath,
    primaryColor: projectTheme.primary,
    secondaryColor: projectTheme.secondary,
    watermarkText: receiptConfig.watermarkText || project?.name,
    showLogo: receiptConfig.showLogo ?? true,
    showGst: receiptConfig.showGst ?? true,
    showRera: receiptConfig.showRera ?? true,
    showCustomerAddress: receiptConfig.showCustomerAddress ?? true,
    showBankDetails: receiptConfig.showBankDetails ?? true,
    authorizedSignatoryTitle: receiptConfig.authorizedSignatoryTitle || `For ${projectBranding.developerName || project?.name}`,
    termsAndConditions: receiptConfig.termsAndConditions,
    tagline: receiptConfig.tagline || project?.legalDocConfig?.projectTagline || '2 BHK PODIUM HOMES',
    jurisdiction: receiptConfig.jurisdiction || project?.legalDocConfig?.jurisdiction || 'Ahmedabad Jurisdiction',
    legalDocConfig: project?.legalDocConfig,
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

  sendCreated(res, {
    paymentId: payment._id,
    receiptNumber: payment.receiptNumber,
    receiptPdfUrl: payment.receiptPdfUrl,
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

  // Retrieve project-specific template or company default or fallback
  let customTemplate = await DocumentTemplate.findOne({
    companyId: user.companyId,
    projectId: project?._id,
    templateType: 'banakhat',
  });
  if (!customTemplate) {
    customTemplate = await DocumentTemplate.findOne({
      companyId: user.companyId,
      projectId: null,
      templateType: 'banakhat',
      isDefault: true,
    });
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

  const projectBranding = project?.branding || {};
  const projectTheme = project?.theme || {};

  const context = {
    today_date: todayStr,
    current_date: todayStr,
    company_name: projectBranding.companyName || company?.name || 'Developer',
    company_address: projectBranding.officeAddress || company?.address || 'City',
    company_phone: projectBranding.phone || company?.phone || '',
    builder_name: projectBranding.developerName || project?.builderName || company?.name || 'Developer',
    developer_name: projectBranding.developerName || project?.builderName || company?.name || 'Developer',
    project_name: project?.name || 'Project',
    project_short_name: projectBranding.shortName || project?.name || 'Project',
    project_code: project?.projectCode || '',
    project_location: project?.location || project?.address || 'City',
    rera_number: projectBranding.reraNumber || project?.reraNumber || 'Applied / Pending',
    gst_number: projectBranding.gstNumber || company?.gstin || '',
    tower_name: unit?.towerName || 'Tower A',
    floor_name: unit?.floorName || '1st Floor',
    flat_number: unit?.unitNumber || 'Unit',
    unit_type: unit?.unitType || 'Flat',
    unit_area: unit?.carpetAreaSqft || unit?.areaSqft || 0,
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
    customer_mobile: customer?.phone || '',
    customer_email: customer?.email || '',
    customer_address: customer?.address || 'Address',
    customer_pan: customer?.pan || 'N/A',
    customer_aadhaar: customer?.aadhaar || 'N/A',
    nominee_name: customer?.nominee?.name || 'N/A',
    nominee_relation: customer?.nominee?.relation || 'N/A',
    nominee_age: customer?.nominee?.age || 'N/A',
  };

  let renderedContent = '';
  if (customTemplate && customTemplate.clauses && customTemplate.clauses.length > 0) {
    renderedContent = compileClauses(customTemplate.clauses, context);
  } else if (customTemplate && customTemplate.bodyContent) {
    renderedContent = renderTemplate(customTemplate.bodyContent, context);
  } else {
    renderedContent = renderTemplate(DEFAULT_BANAKHAT_TEMPLATE, context);
  }

  const logoRelative = projectBranding.logoUrl || company?.logo;
  const logoPath = logoRelative ? path.resolve(process.cwd(), logoRelative.replace(/^\//, '')) : undefined;

  // Generate PDF file
  const { relativeUrl } = await generateLegalDocumentPdf({
    title: customTemplate?.title || 'Agreement for Sale (Banakhat)',
    documentNumber,
    companyName: projectBranding.companyName || company?.name || 'Developer',
    projectName: project?.name || 'Project',
    developerName: projectBranding.developerName || project?.builderName || company?.name,
    reraNumber: projectBranding.reraNumber || project?.reraNumber || undefined,
    bodyContent: renderedContent,
    todayDate: todayStr,
    logoPath,
    primaryColor: projectTheme.primary,
    secondaryColor: projectTheme.secondary,
    watermarkText: customTemplate?.watermarkText || project?.name,
    showLogo: customTemplate?.showLogo ?? true,
    showRera: customTemplate?.showRera ?? true,
    signatures: customTemplate?.signatures?.length ? customTemplate.signatures : [
      { role: 'promoter', label: `For ${projectBranding.developerName || project?.builderName || company?.name}`, signerName: 'Authorized Signatory' },
      { role: 'purchaser', label: customer?.name || 'Allottee / Purchaser', signerName: customer?.name }
    ],
    witnesses: customTemplate?.witnesses?.length ? customTemplate.witnesses : [
      { label: 'Witness 1' },
      { label: 'Witness 2' }
    ],
    documentType: 'banakhat',
    projectConfig: {
      projectName: project?.name || 'Santora',
      projectCode: project?.projectCode,
      developerName: projectBranding.developerName || project?.builderName || company?.name || 'RUDRA DEVELOPERS',
      companyName: projectBranding.companyName || company?.name,
      officeAddress: projectBranding.officeAddress || company?.address,
      phone: projectBranding.phone || company?.phone,
      email: projectBranding.email || company?.email,
      reraNumber: projectBranding.reraNumber || project?.reraNumber,
      panNumber: projectBranding.panNumber || company?.pan,
      logoUrl: logoPath,
      tagline: project?.receiptConfig?.tagline || project?.legalDocConfig?.projectTagline || '2 BHK PODIUM HOMES',
      jurisdiction: project?.receiptConfig?.jurisdiction || project?.legalDocConfig?.jurisdiction || 'Ahmedabad Jurisdiction',
      legalDocConfig: project?.legalDocConfig,
    },
    legalDocData: {
      documentNumber,
      bookingNumber: booking.bookingNumber,
      bookingDate: booking.bookingDate,
      todayDate: todayStr,
      customerName: customer?.name || 'Purchaser',
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      customerPan: customer?.pan || 'N/A',
      customerAddress: customer?.address || 'Ahmedabad, Gujarat',
      customerAge: customer?.age || 35,
      customerOccupation: customer?.occupation || 'Business',
      unitNumber: unit?.unitNumber || 'Unit',
      towerName: unit?.towerName || 'Tower A',
      floorName: unit?.floorName || '1st Floor',
      unitType: unit?.unitType || 'Flat',
      carpetAreaSqft: unit?.carpetAreaSqft,
      carpetAreaSqmt: unit?.carpetAreaSqmt,
      builtUpAreaSqft: unit?.builtUpAreaSqft,
      balconyAreaSqmt: unit?.balconyAreaSqmt,
      washAreaSqmt: unit?.washAreaSqmt,
      landShareSqmt: unit?.landShareSqmt,
      totalAmount: totalAmount,
      bookingAmount: booking.bookingAmount,
      boundaries: unit?.boundaries,
    },
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

  // Retrieve project-specific template or company default or fallback
  let customTemplate = await DocumentTemplate.findOne({
    companyId: user.companyId,
    projectId: project?._id,
    templateType: 'dastavej',
  });
  if (!customTemplate) {
    customTemplate = await DocumentTemplate.findOne({
      companyId: user.companyId,
      projectId: null,
      templateType: 'dastavej',
      isDefault: true,
    });
  }

  const documentNumber = await nextDocumentNumber(user.companyId, 'dastavej');
  const totalAmount = unit?.totalValue || booking.totalValue || 0;
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const projectBranding = project?.branding || {};
  const projectTheme = project?.theme || {};

  const context = {
    today_date: todayStr,
    current_date: todayStr,
    company_name: projectBranding.companyName || company?.name || 'Vendor',
    company_address: projectBranding.officeAddress || company?.address || 'Address',
    builder_name: projectBranding.developerName || project?.builderName || company?.name || 'Vendor',
    developer_name: projectBranding.developerName || project?.builderName || company?.name || 'Vendor',
    project_name: project?.name || 'Project',
    project_short_name: projectBranding.shortName || project?.name || 'Project',
    project_location: project?.location || project?.address || 'City',
    rera_number: projectBranding.reraNumber || project?.reraNumber || 'Applied / Pending',
    gst_number: projectBranding.gstNumber || company?.gstin || '',
    tower_name: unit?.towerName || 'Tower A',
    floor_name: unit?.floorName || '1st Floor',
    flat_number: unit?.unitNumber || 'Unit',
    carpet_area: unit?.carpetAreaSqft || unit?.areaSqft || 0,
    builtup_area: unit?.builtUpAreaSqft || unit?.areaSqft || 0,
    parking_slot: unit?.parkingSlot || 'Dedicated Slot',
    total_amount: Math.round(totalAmount).toLocaleString('en-IN'),
    total_amount_in_words: numberToWordsINR(totalAmount),
    customer_name: customer?.name || 'Purchaser',
    customer_mobile: customer?.phone || '',
    customer_phone: customer?.phone || '',
    customer_pan: customer?.pan || 'N/A',
    customer_aadhaar: customer?.aadhaar || 'N/A',
    customer_address: customer?.address || 'Address',
  };

  let renderedContent = '';
  if (customTemplate && customTemplate.clauses && customTemplate.clauses.length > 0) {
    renderedContent = compileClauses(customTemplate.clauses, context);
  } else if (customTemplate && customTemplate.bodyContent) {
    renderedContent = renderTemplate(customTemplate.bodyContent, context);
  } else {
    renderedContent = renderTemplate(DEFAULT_DASTAVEJ_TEMPLATE, context);
  }

  const logoRelative = projectBranding.logoUrl || company?.logo;
  const logoPath = logoRelative ? path.resolve(process.cwd(), logoRelative.replace(/^\//, '')) : undefined;

  const { relativeUrl } = await generateLegalDocumentPdf({
    title: customTemplate?.title || 'Deed of Conveyance (Dastavej)',
    documentNumber,
    companyName: projectBranding.companyName || company?.name || 'Vendor',
    projectName: project?.name || 'Project',
    developerName: projectBranding.developerName || project?.builderName || company?.name,
    reraNumber: projectBranding.reraNumber || project?.reraNumber || undefined,
    bodyContent: renderedContent,
    todayDate: todayStr,
    logoPath,
    primaryColor: projectTheme.primary,
    secondaryColor: projectTheme.secondary,
    watermarkText: customTemplate?.watermarkText || project?.name,
    showLogo: customTemplate?.showLogo ?? true,
    showRera: customTemplate?.showRera ?? true,
    signatures: customTemplate?.signatures?.length ? customTemplate.signatures : [
      { role: 'vendor', label: `For ${projectBranding.developerName || project?.builderName || company?.name}`, signerName: 'Authorized Signatory' },
      { role: 'purchaser', label: customer?.name || 'Purchaser', signerName: customer?.name }
    ],
    witnesses: customTemplate?.witnesses?.length ? customTemplate.witnesses : [
      { label: 'Witness 1' },
      { label: 'Witness 2' }
    ],
    documentType: 'dastavej',
    projectConfig: {
      projectName: project?.name || 'Santora',
      projectCode: project?.projectCode,
      developerName: projectBranding.developerName || project?.builderName || company?.name || 'RUDRA DEVELOPERS',
      companyName: projectBranding.companyName || company?.name,
      officeAddress: projectBranding.officeAddress || company?.address,
      phone: projectBranding.phone || company?.phone,
      email: projectBranding.email || company?.email,
      reraNumber: projectBranding.reraNumber || project?.reraNumber,
      panNumber: projectBranding.panNumber || company?.pan,
      logoUrl: logoPath,
      tagline: project?.receiptConfig?.tagline || project?.legalDocConfig?.projectTagline || '2 BHK PODIUM HOMES',
      jurisdiction: project?.receiptConfig?.jurisdiction || project?.legalDocConfig?.jurisdiction || 'Ahmedabad Jurisdiction',
      legalDocConfig: project?.legalDocConfig,
    },
    legalDocData: {
      documentNumber,
      bookingNumber: booking.bookingNumber,
      bookingDate: booking.bookingDate,
      todayDate: todayStr,
      customerName: customer?.name || 'Purchaser',
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      customerPan: customer?.pan || 'N/A',
      customerAddress: customer?.address || 'Ahmedabad, Gujarat',
      customerAge: customer?.age || 35,
      customerOccupation: customer?.occupation || 'Business',
      unitNumber: unit?.unitNumber || 'Unit',
      towerName: unit?.towerName || 'Tower A',
      floorName: unit?.floorName || '1st Floor',
      unitType: unit?.unitType || 'Flat',
      carpetAreaSqft: unit?.carpetAreaSqft,
      carpetAreaSqmt: unit?.carpetAreaSqmt,
      builtUpAreaSqft: unit?.builtUpAreaSqft,
      balconyAreaSqmt: unit?.balconyAreaSqmt,
      washAreaSqmt: unit?.washAreaSqmt,
      landShareSqmt: unit?.landShareSqmt,
      totalAmount: totalAmount,
      bookingAmount: booking.bookingAmount,
      boundaries: unit?.boundaries,
    },
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

/** Get list of all available dynamic template variables */
export async function listTemplateVariables(_req: Request, res: Response) {
  sendSuccess(res, { variables: VARIABLE_REGISTRY });
}

/** Live Preview Receipt with Custom Project Configuration */
export async function previewReceiptPdf(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;
  const body = req.body || {};

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  const company = await Company.findById(user.companyId);

  const branding = project?.branding || {};
  const theme = project?.theme || {};
  const receiptConfig = { ...(project?.receiptConfig || {}), ...body };

  const logoRelative = branding.logoUrl || company?.logo;
  const logoPath = logoRelative ? path.resolve(process.cwd(), logoRelative.replace(/^\//, '')) : undefined;

  const { relativeUrl } = await generateReceiptPdf({
    receiptNumber: 'RCP-PREVIEW-001',
    paymentDate: new Date(),
    companyName: branding.companyName || company?.name || 'BuildTrack Real Estate',
    companyAddress: branding.officeAddress || company?.address || 'Sample Office Address',
    companyPhone: branding.phone || company?.phone || '+91 98250 00000',
    companyEmail: branding.email || company?.email || 'sales@example.com',
    companyGstin: branding.gstNumber || company?.gstin || '24AAACT0000A1Z5',
    customerName: 'Sample Purchaser (Preview)',
    customerPhone: '+91 98000 00000',
    customerAddress: 'Sample Residence Address, City',
    projectName: project?.name || 'Sample Project',
    developerName: branding.developerName || project?.builderName || 'Sample Developers',
    reraNumber: branding.reraNumber || project?.reraNumber || 'PR/GJ/SAMPLE/2026/01',
    unitNumber: 'A-101',
    unitType: '3 BHK Luxury',
    carpetAreaSqft: 1850,
    paymentAmount: 500000,
    paymentMode: 'NEFT / RTGS',
    totalUnitValue: 12500000,
    totalPaidTillNow: 2500000,
    remainingBalance: 10000000,
    logoPath,
    primaryColor: body.primaryColor || theme.primary || '#E8590C',
    secondaryColor: body.secondaryColor || theme.secondary || '#17263B',
    watermarkText: receiptConfig.watermarkText || project?.name,
    showLogo: receiptConfig.showLogo ?? true,
    showGst: receiptConfig.showGst ?? true,
    showRera: receiptConfig.showRera ?? true,
    showCustomerAddress: receiptConfig.showCustomerAddress ?? true,
    showBankDetails: receiptConfig.showBankDetails ?? true,
    termsAndConditions: receiptConfig.termsAndConditions,
    authorizedSignatoryTitle: receiptConfig.authorizedSignatoryTitle || `For ${branding.developerName || project?.name || 'Developer'}`,
    tagline: body.tagline || receiptConfig.tagline || project?.legalDocConfig?.projectTagline || '2 BHK PODIUM HOMES',
    jurisdiction: body.jurisdiction || receiptConfig.jurisdiction || project?.legalDocConfig?.jurisdiction || 'Ahmedabad Jurisdiction',
    legalDocConfig: body.legalDocConfig || project?.legalDocConfig,
  });

  sendSuccess(res, { previewPdfUrl: relativeUrl }, 'Preview generated successfully');
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

// ── Property Document Queries & PDF Streaming ───────────────────

export async function listPropertyDocuments(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.query as any;
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.documentType) filter.documentType = q.documentType;
  if (q.bookingId) filter.bookingId = q.bookingId;
  if (q.customerId) filter.customerId = q.customerId;
  if (q.projectId) filter.projectId = q.projectId;

  const docs = await PropertyDocument.find(filter)
    .populate('customerId', 'name phone email')
    .populate('projectId', 'name')
    .populate('bookingId', 'bookingNumber status')
    .populate('unitId', 'unitNumber unitType totalValue')
    .sort({ createdAt: -1 });

  sendSuccess(res, docs);
}

export async function getPropertyDocument(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const doc = await PropertyDocument.findOne({ _id: req.params.id, companyId: user.companyId })
    .populate('customerId')
    .populate('projectId')
    .populate('bookingId')
    .populate('unitId');
  if (!doc) throw ApiError.notFound('Document not found.');
  sendSuccess(res, doc);
}

export async function streamPaymentReceiptPdf(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const paymentId = req.params.paymentId;
  const payment = await Payment.findOne({ _id: paymentId, companyId: user.companyId })
    .populate('customerId')
    .populate('projectId')
    .populate('bookingId')
    .populate('unitId');
  if (!payment) throw ApiError.notFound('Payment record not found.');

  const company = await Company.findById(user.companyId);
  const customer = payment.customerId as any;
  const project = payment.projectId as any;
  const unit = payment.unitId as any;
  const booking = payment.bookingId as any;

  if (!payment.receiptNumber) {
    payment.receiptNumber = await nextReceiptNumber(user.companyId);
    await payment.save();
  }

  let totalPaidTillNow = payment.amount;
  let totalUnitValue = unit?.totalValue || booking?.totalValue || 0;
  if (booking) {
    const paidAgg = await Payment.aggregate([
      { $match: { bookingId: booking._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    totalPaidTillNow = paidAgg[0]?.total ?? payment.amount;
  }

  const { buffer, relativeUrl } = await generateReceiptPdf({
    receiptNumber: payment.receiptNumber,
    paymentDate: payment.paidDate || payment.createdAt || new Date(),
    paymentAmount: payment.amount,
    paymentMode: payment.method || 'Bank Transfer',
    transactionId: payment.reference || undefined,
    companyName: company?.name || 'BuildTrack Real Estate',
    companyAddress: company?.address || undefined,
    companyPhone: company?.phone || undefined,
    companyEmail: company?.email || undefined,
    companyGstin: company?.gstin || undefined,
    customerName: customer?.name || 'Valued Customer',
    customerPhone: customer?.phone || 'N/A',
    customerEmail: customer?.email || undefined,
    customerAddress: customer?.address || undefined,
    customerPan: customer?.pan || undefined,
    projectName: project?.name || 'Project',
    unitNumber: unit?.unitNumber || 'Unit',
    towerName: unit?.towerName || undefined,
    floorName: unit?.floorName || undefined,
    unitType: unit?.unitType || undefined,
    totalUnitValue,
    totalPaidTillNow,
    remainingBalance: Math.max(0, totalUnitValue - totalPaidTillNow),
    tagline: project?.receiptConfig?.tagline || project?.legalDocConfig?.projectTagline || '2 BHK PODIUM HOMES',
    jurisdiction: project?.receiptConfig?.jurisdiction || project?.legalDocConfig?.jurisdiction || 'Ahmedabad Jurisdiction',
    legalDocConfig: project?.legalDocConfig,
    developerName: project?.branding?.developerName || project?.builderName || company?.name,
    logoPath: project?.branding?.logoUrl ? path.resolve(process.cwd(), project.branding.logoUrl.replace(/^\//, '')) : undefined,
  });

  if (payment.receiptPdfUrl !== relativeUrl) {
    payment.receiptPdfUrl = relativeUrl;
    await payment.save();
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Receipt_${payment.receiptNumber}.pdf"`);
  res.send(buffer);
}

export async function streamPropertyDocumentPdf(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const docId = req.params.docId || req.params.id;
  const doc = await PropertyDocument.findOne({ _id: docId, companyId: user.companyId });
  if (!doc) throw ApiError.notFound('Property document not found.');

  // Check if file exists on disk
  if (doc.pdfUrl) {
    const filePath = path.resolve(process.cwd(), doc.pdfUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${doc.documentNumber}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Regenerate PDF
  const company = await Company.findById(user.companyId);
  const project = await Project.findById(doc.projectId);
  const { buffer } = await generateLegalDocumentPdf({
    title: doc.documentType === 'banakhat' ? 'Agreement to Sale (Banakhat)' : 'Deed of Conveyance (Dastavej)',
    documentNumber: doc.documentNumber,
    companyName: company?.name || 'Vendor',
    projectName: project?.name || 'Project',
    reraNumber: project?.reraNumber || undefined,
    bodyContent: doc.renderedContent || '',
    todayDate: doc.createdAt.toLocaleDateString('en-IN'),
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${doc.documentNumber}.pdf"`);
  res.send(buffer);
}

export async function deletePropertyDocument(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManageDocuments')) {
    throw ApiError.forbidden('You do not have permission to delete documents.');
  }

  const docId = req.params.id || req.params.docId;
  const doc = await PropertyDocument.findOne({ _id: docId, companyId: user.companyId });
  if (!doc) throw ApiError.notFound('Property document not found.');

  // Unlink from booking if linked
  if (doc.bookingId) {
    await Booking.updateOne(
      { _id: doc.bookingId },
      {
        $unset: {
          ...(doc.documentType === 'banakhat' ? { banakhatDocumentId: 1 } : {}),
          ...(doc.documentType === 'dastavej' ? { dastavejDocumentId: 1 } : {}),
        },
      },
    );
  }

  // Remove file from disk if present
  if (doc.pdfUrl) {
    try {
      const filePath = path.resolve(process.cwd(), doc.pdfUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }

  await doc.deleteOne();

  await logAudit(req, {
    action: 'delete',
    module: 'documents',
    entityType: 'property_document',
    entityId: doc._id,
    description: `${user.name} deleted document ${doc.documentNumber} (${doc.title})`,
  });

  sendSuccess(res, { id: doc._id }, `Document ${doc.documentNumber} deleted successfully.`);
}

export async function deletePaymentReceipt(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role, 'canManagePayments') && !hasPermission(user.role, 'canGenerateReceipts')) {
    throw ApiError.forbidden('You do not have permission to delete receipts.');
  }

  const paymentId = req.params.paymentId || req.params.id;
  const payment = await Payment.findOne({ _id: paymentId, companyId: user.companyId });
  if (!payment) throw ApiError.notFound('Payment not found.');

  if (payment.receiptPdfUrl) {
    try {
      const filePath = path.resolve(process.cwd(), payment.receiptPdfUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }

  const oldReceiptNo = payment.receiptNumber;
  payment.receiptNumber = null as any;
  payment.receiptPdfUrl = null as any;
  await payment.save();

  await logAudit(req, {
    action: 'receipt_deleted',
    module: 'receipts',
    entityType: 'payment',
    entityId: payment._id,
    description: `${user.name} deleted receipt ${oldReceiptNo || ''} for payment ${payment.paymentNumber}`,
  });

  sendSuccess(res, { paymentId: payment._id }, `Receipt ${oldReceiptNo || ''} deleted successfully.`);
}

