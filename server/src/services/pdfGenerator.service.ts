import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { numberToWordsINR } from './templateEngine.service';
import {
  fillReceiptPdf,
  fillBanakhatPdf,
  fillDastavejPdf,
  type ProjectConfig,
  type LegalDocData,
  type PaymentRecord,
} from './pdfTemplateEngine.service';

export interface ReceiptPdfData {
  receiptNumber: string;
  paymentDate: Date;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyPan?: string;
  companyGstin?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerPan?: string;
  customerAddress?: string;
  projectName: string;
  projectCode?: string;
  developerName?: string;
  reraNumber?: string;
  towerName?: string;
  floorName?: string;
  unitNumber: string;
  unitType?: string;
  carpetAreaSqft?: number;
  paymentAmount: number;
  paymentMode: string;
  transactionId?: string;
  chequeNumber?: string;
  chequeDate?: Date;
  bankName?: string;
  totalUnitValue?: number;
  totalPaidTillNow?: number;
  remainingBalance?: number;
  notes?: string;
  verifiedUrl?: string;
  // Dynamic branding & theming
  logoPath?: string;
  primaryColor?: string;
  secondaryColor?: string;
  watermarkText?: string;
  showLogo?: boolean;
  showGst?: boolean;
  showRera?: boolean;
  showCustomerAddress?: boolean;
  showBankDetails?: boolean;
  authorizedSignatoryTitle?: string;
  termsAndConditions?: string[];
  tagline?: string;
  jurisdiction?: string;
  legalDocConfig?: any;
}

export interface LegalDocPdfData {
  title: string;
  documentNumber: string;
  companyName: string;
  companyAddress?: string;
  projectName: string;
  developerName?: string;
  reraNumber?: string;
  bodyContent: string;
  todayDate: string;
  // Dynamic branding & theming
  logoPath?: string;
  primaryColor?: string;
  secondaryColor?: string;
  watermarkText?: string;
  showLogo?: boolean;
  showRera?: boolean;
  verificationUrl?: string;
  signatures?: Array<{ role: string; label: string; signerName?: string }>;
  witnesses?: Array<{ label: string }>;
  documentType?: 'banakhat' | 'dastavej' | string;
  projectConfig?: ProjectConfig;
  legalDocData?: LegalDocData;
  paymentRecords?: PaymentRecord[];
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Generates an official PDF receipt with dynamic branding, colors, and watermark.
 */
export async function generateReceiptPdf(
  data: ReceiptPdfData,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  return fillReceiptPdf(
    {
      projectName: data.projectName,
      projectCode: data.projectCode,
      developerName: data.developerName || data.companyName,
      companyName: data.companyName,
      officeAddress: data.companyAddress,
      phone: data.companyPhone,
      email: data.companyEmail,
      gstNumber: data.companyGstin,
      reraNumber: data.reraNumber,
      panNumber: data.companyPan,
      logoUrl: data.logoPath,
      tagline: data.tagline,
      jurisdiction: data.jurisdiction,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      authorizedSignatoryTitle: data.authorizedSignatoryTitle,
      legalDocConfig: data.legalDocConfig,
    },
    {
      receiptNumber: data.receiptNumber,
      paymentDate: data.paymentDate,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      unitNumber: data.unitNumber,
      towerName: data.towerName,
      floorName: data.floorName,
      unitType: data.unitType,
      carpetAreaSqft: data.carpetAreaSqft,
      paymentAmount: data.paymentAmount,
      paymentMode: data.paymentMode,
      transactionId: data.transactionId,
      chequeNumber: data.chequeNumber,
      chequeDate: data.chequeDate,
      bankName: data.bankName,
      totalUnitValue: data.totalUnitValue,
      totalPaidTillNow: data.totalPaidTillNow,
      remainingBalance: data.remainingBalance,
      notes: data.notes,
    },
  );
}

export async function generateReceiptPdfLegacy(
  data: ReceiptPdfData,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  ensureUploadsDir();
  const fileName = `Receipt_${data.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const relativeUrl = `/uploads/documents/${fileName}`;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const writeStream = fs.createWriteStream(filePath);
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.pipe(writeStream);

    // Dynamic document styling colors
    const primaryColor = data.primaryColor || '#E8590C';
    const navyColor = data.secondaryColor || '#17263B';
    const darkGray = '#2B2E33';
    const lightGray = '#666666';
    const pageMargin = 40;
    const pageWidth = 595.28;
    const contentWidth = pageWidth - pageMargin * 2;

    // Optional Watermark
    if (data.watermarkText) {
      doc.save();
      doc.fillColor(primaryColor).opacity(0.06);
      doc.rotate(-45, { origin: [pageWidth / 2, 420] });
      doc.fontSize(48).font('Helvetica-Bold').text(data.watermarkText.toUpperCase(), 40, 390, {
        align: 'center',
        width: 520,
      });
      doc.restore();
    }

    // Top primary color accent band
    doc.rect(pageMargin, 35, contentWidth, 5).fill(primaryColor);

    // Dynamic Logo & Header Area
    let headerTextX = pageMargin;
    if (data.showLogo !== false && data.logoPath && fs.existsSync(data.logoPath)) {
      try {
        doc.image(data.logoPath, pageMargin, 48, { fit: [120, 50] });
        headerTextX += 130;
      } catch {
        headerTextX = pageMargin;
      }
    }

    // Project Name & Company/Developer details
    doc.fontSize(16).fillColor(navyColor).font('Helvetica-Bold').text(data.projectName, headerTextX, 50, { width: 330 });
    doc.fontSize(9).font('Helvetica').fillColor(lightGray);
    if (data.developerName && data.developerName !== data.projectName) {
      doc.text(`Developed by: ${data.developerName}`, headerTextX, doc.y + 2, { width: 330 });
    }
    if (data.companyAddress) {
      doc.text(data.companyAddress, headerTextX, doc.y + 2, { width: 330 });
    }
    const contactParts: string[] = [];
    if (data.companyPhone) contactParts.push(`Tel: ${data.companyPhone}`);
    if (data.showGst !== false && data.companyGstin) contactParts.push(`GSTIN: ${data.companyGstin}`);
    if (contactParts.length > 0) {
      doc.text(contactParts.join('  |  '), headerTextX, doc.y + 2, { width: 330 });
    }

    // Official Receipt Banner (Right Side Box)
    const rightBoxX = pageWidth - pageMargin - 180;
    doc.rect(rightBoxX, 48, 180, 56).fillAndStroke('#FDFBF7', primaryColor);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor).text('PAYMENT RECEIPT', rightBoxX + 10, 56);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(navyColor).text(`No: ${data.receiptNumber}`, rightBoxX + 10, 72);
    doc.fontSize(8.5).font('Helvetica').fillColor(darkGray).text(
      `Date: ${new Date(data.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      rightBoxX + 10,
      86,
    );

    const yAfterHeader = 122;
    doc.strokeColor('#E0E0E0').lineWidth(1).moveTo(pageMargin, yAfterHeader).lineTo(pageWidth - pageMargin, yAfterHeader).stroke();

    // Section 1: Customer Details vs Property Details (Two column layout)
    const colWidth = (contentWidth - 20) / 2;
    const col1X = pageMargin;
    const col2X = pageMargin + colWidth + 20;
    const topY = yAfterHeader + 12;

    // Col 1: Customer Info
    doc.rect(col1X, topY, colWidth, 92).fill('#FBFBFA');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(navyColor).text('RECEIVED FROM', col1X + 10, topY + 8);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(darkGray).text(data.customerName, col1X + 10, topY + 24);
    doc.fontSize(8.5).font('Helvetica').fillColor(lightGray);
    doc.text(`Mobile: ${data.customerPhone}`, col1X + 10, topY + 38);
    if (data.customerEmail) doc.text(`Email: ${data.customerEmail}`, col1X + 10, topY + 50);
    if (data.customerPan) doc.text(`PAN: ${data.customerPan}`, col1X + 10, topY + 62);
    if (data.showCustomerAddress !== false && data.customerAddress) {
      doc.text(`Address: ${data.customerAddress.slice(0, 48)}`, col1X + 10, topY + 74);
    }

    // Col 2: Unit & Project Info
    doc.rect(col2X, topY, colWidth, 92).fill('#FBFBFA');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(navyColor).text('PROPERTY DETAILS', col2X + 10, topY + 8);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text(`Unit: ${data.unitNumber} (${data.unitType || 'Unit'})`, col2X + 10, topY + 24);
    doc.fontSize(8.5).font('Helvetica').fillColor(lightGray);
    doc.text(`Project: ${data.projectName}${data.projectCode ? ` (${data.projectCode})` : ''}`, col2X + 10, topY + 38);
    if (data.towerName || data.floorName) {
      doc.text(`Tower: ${data.towerName || 'N/A'} | Floor: ${data.floorName || 'N/A'}`, col2X + 10, topY + 50);
    }
    if (data.carpetAreaSqft) doc.text(`Carpet Area: ${data.carpetAreaSqft} Sq. Ft.`, col2X + 10, topY + 62);
    if (data.showRera !== false && data.reraNumber) doc.text(`RERA Reg: ${data.reraNumber}`, col2X + 10, topY + 74);

    // Section 2: Payment Particulars Table
    const tableY = topY + 108;
    doc.rect(pageMargin, tableY, contentWidth, 24).fill(navyColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('DESCRIPTION / PAYMENT PARTICULARS', pageMargin + 10, tableY + 7);
    doc.text('MODE / REF NO.', pageMargin + 250, tableY + 7);
    doc.text('AMOUNT (INR)', pageWidth - pageMargin - 110, tableY + 7, { width: 100, align: 'right' });

    // Table Data Row
    const rowY = tableY + 24;
    doc.rect(pageMargin, rowY, contentWidth, 48).fillAndStroke('#FFFFFF', '#E0E0E0');
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(darkGray);
    doc.text(`Installment / Booking Payment towards Unit ${data.unitNumber}`, pageMargin + 10, rowY + 10);
    doc.fontSize(8.5).font('Helvetica').fillColor(lightGray);
    doc.text(`Total Unit Value: ₹${(data.totalUnitValue || 0).toLocaleString('en-IN')}`, pageMargin + 10, rowY + 26);

    const modeLabel = data.paymentMode.toUpperCase();
    const refText = data.transactionId || data.chequeNumber ? `Ref: ${data.transactionId || data.chequeNumber}` : '';
    doc.fontSize(9).font('Helvetica-Bold').fillColor(darkGray).text(modeLabel, pageMargin + 250, rowY + 10);
    if (refText) doc.fontSize(8).font('Helvetica').fillColor(lightGray).text(refText, pageMargin + 250, rowY + 24);

    doc.fontSize(11).font('Helvetica-Bold').fillColor(navyColor);
    doc.text(`₹ ${data.paymentAmount.toLocaleString('en-IN')}`, pageWidth - pageMargin - 110, rowY + 14, {
      width: 100,
      align: 'right',
    });

    // In Words Row
    const wordsY = rowY + 48;
    doc.rect(pageMargin, wordsY, contentWidth, 24).fill('#F8F8F8');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(darkGray).text('Amount in words: ', pageMargin + 10, wordsY + 7, { continued: true });
    doc.font('Helvetica').fillColor(lightGray).text(numberToWordsINR(data.paymentAmount));

    // Section 3: Balance Summary
    const summaryY = wordsY + 36;
    if (data.totalPaidTillNow !== undefined && data.remainingBalance !== undefined) {
      const bColW = contentWidth / 3;
      doc.rect(pageMargin, summaryY, bColW, 40).fill('#F4F6F9');
      doc.fontSize(8).font('Helvetica').fillColor(lightGray).text('TOTAL UNIT VALUE', pageMargin + 10, summaryY + 8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(navyColor).text(`₹${(data.totalUnitValue || 0).toLocaleString('en-IN')}`, pageMargin + 10, summaryY + 20);

      doc.rect(pageMargin + bColW, summaryY, bColW, 40).fill('#EDF7ED');
      doc.fontSize(8).font('Helvetica').fillColor('#2E7D32').text('TOTAL PAID TILL NOW', pageMargin + bColW + 10, summaryY + 8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2E7D32').text(`₹${data.totalPaidTillNow.toLocaleString('en-IN')}`, pageMargin + bColW + 10, summaryY + 20);

      doc.rect(pageMargin + bColW * 2, summaryY, bColW, 40).fill('#FDEBE0');
      doc.fontSize(8).font('Helvetica').fillColor(primaryColor).text('REMAINING BALANCE', pageMargin + bColW * 2 + 10, summaryY + 8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text(`₹${data.remainingBalance.toLocaleString('en-IN')}`, pageMargin + bColW * 2 + 10, summaryY + 20);
    }

    // Section 4: Terms & Conditions & Signature Block
    const bottomY = summaryY + 54;

    // Terms
    const defaultTerms = [
      'Subject to realization of Cheque / RTGS / Online payment.',
      'Interest @ 12% p.a. applicable for delayed payments beyond grace period.',
      'This is a computer generated receipt and does not require physical stamp.',
    ];
    const terms = data.termsAndConditions && data.termsAndConditions.length > 0 ? data.termsAndConditions : defaultTerms;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(darkGray).text('Terms & Conditions:', pageMargin, bottomY);
    let termY = bottomY + 12;
    terms.slice(0, 3).forEach((term) => {
      doc.fontSize(7.5).font('Helvetica').fillColor(lightGray).text(`• ${term}`, pageMargin, termY, { width: 280 });
      termY += 11;
    });

    // Authorized Signature
    const signX = pageWidth - pageMargin - 130;
    const signEntity = data.authorizedSignatoryTitle || `For ${data.developerName || data.projectName}`;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(navyColor).text(signEntity, signX - 10, bottomY + 20, { width: 140, align: 'center' });
    doc.strokeColor(primaryColor).lineWidth(0.8).moveTo(signX, bottomY + 55).lineTo(pageWidth - pageMargin, bottomY + 55).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor(lightGray).text('Authorized Signatory', signX, bottomY + 58, { width: 130, align: 'center' });

    doc.end();

    writeStream.on('finish', () => {
      resolve({ filePath, relativeUrl, buffer: Buffer.concat(chunks) });
    });
    writeStream.on('error', reject);
  });
}

/**
 * Generates an official Legal Document PDF (Banakhat, Dastavej, Agreement) with dynamic branding & clauses.
 */
export async function generateLegalDocumentPdf(
  data: LegalDocPdfData,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  if (data.documentType === 'banakhat' && data.projectConfig && data.legalDocData) {
    return fillBanakhatPdf(data.projectConfig, data.legalDocData);
  }
  if (data.documentType === 'dastavej' && data.projectConfig && data.legalDocData) {
    return fillDastavejPdf(data.projectConfig, data.legalDocData, data.paymentRecords || []);
  }

  ensureUploadsDir();
  const fileName = `${data.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const relativeUrl = `/uploads/documents/${fileName}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.pipe(writeStream);

    const primaryColor = data.primaryColor || '#E8590C';
    const navyColor = data.secondaryColor || '#17263B';
    const darkGray = '#2B2E33';

    // Optional Watermark
    if (data.watermarkText) {
      doc.save();
      doc.fillColor(primaryColor).opacity(0.05);
      doc.rotate(-45, { origin: [297, 420] });
      doc.fontSize(56).font('Helvetica-Bold').text(data.watermarkText.toUpperCase(), 50, 400, {
        align: 'center',
        width: 500,
      });
      doc.restore();
    }

    // Header Logo (if present)
    if (data.showLogo !== false && data.logoPath && fs.existsSync(data.logoPath)) {
      try {
        doc.image(data.logoPath, 50, 40, { fit: [100, 40] });
      } catch {}
    }

    // Title & Header
    doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text(data.title.toUpperCase(), { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor(darkGray).text(`Document Ref: ${data.documentNumber}  |  Date: ${data.todayDate}`, { align: 'center' });
    if (data.showRera !== false && data.reraNumber) {
      doc.fontSize(8).fillColor('#666666').text(`RERA Registration No: ${data.reraNumber}`, { align: 'center' });
    }
    doc.moveDown(1);
    doc.strokeColor(primaryColor).lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1.5);

    // Body content parsing: clean up markdown headings/bolding into readable legal text
    const lines = data.bodyContent.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        doc.moveDown(0.5);
        continue;
      }

      if (line.startsWith('# ')) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor(navyColor).text(line.replace('# ', ''), { align: 'center' });
        doc.moveDown(0.5);
      } else if (line.startsWith('## ') || line.startsWith('### ')) {
        doc.fontSize(10.5).font('Helvetica-Bold').fillColor(navyColor).text(line.replace(/^#+\s*/, ''));
        doc.moveDown(0.3);
      } else if (line.startsWith('---')) {
        doc.moveDown(0.4);
        doc.strokeColor('#EEEEEE').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.4);
      } else {
        const cleanText = line.replace(/\*\*(.*?)\*\*/g, '$1');
        doc.fontSize(9.5).font('Helvetica').fillColor(darkGray).text(cleanText, {
          align: 'justify',
          lineGap: 3,
        });
      }
    }

    // Signatures Block
    if (data.signatures && data.signatures.length > 0) {
      doc.moveDown(2);
      const signY = doc.y;
      const colWidth = (545 - 50) / data.signatures.length;
      data.signatures.forEach((sig, idx) => {
        const x = 50 + idx * colWidth;
        doc.strokeColor('#999999').lineWidth(0.8).moveTo(x + 10, signY + 40).lineTo(x + colWidth - 20, signY + 40).stroke();
        doc.fontSize(9).font('Helvetica-Bold').fillColor(navyColor).text(sig.label, x + 10, signY + 46, { width: colWidth - 20, align: 'center' });
        if (sig.signerName) {
          doc.fontSize(8).font('Helvetica').fillColor('#666666').text(sig.signerName, x + 10, signY + 58, { width: colWidth - 20, align: 'center' });
        }
      });
      doc.moveDown(4);
    }

    // Witnesses Block
    if (data.witnesses && data.witnesses.length > 0) {
      doc.moveDown(1);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(navyColor).text('WITNESSES:');
      doc.moveDown(0.5);
      const witY = doc.y;
      const colWidth = (545 - 50) / data.witnesses.length;
      data.witnesses.forEach((wit, idx) => {
        const x = 50 + idx * colWidth;
        doc.strokeColor('#CCCCCC').lineWidth(0.8).moveTo(x + 10, witY + 30).lineTo(x + colWidth - 20, witY + 30).stroke();
        doc.fontSize(8.5).font('Helvetica').fillColor(darkGray).text(`1. ${wit.label}: ____________________`, x + 10, witY + 36, { width: colWidth - 20 });
      });
    }

    doc.end();

    writeStream.on('finish', () => {
      resolve({ filePath, relativeUrl, buffer: Buffer.concat(chunks) });
    });
    writeStream.on('error', reject);
  });
}
