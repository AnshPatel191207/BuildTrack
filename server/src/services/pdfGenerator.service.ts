import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { numberToWordsINR } from './templateEngine.service';

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
}

export interface LegalDocPdfData {
  title: string;
  documentNumber: string;
  companyName: string;
  companyAddress?: string;
  projectName: string;
  reraNumber?: string;
  bodyContent: string;
  todayDate: string;
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Generates an official PDF receipt and writes it to disk, returning the relative URL and buffer.
 */
export async function generateReceiptPdf(
  data: ReceiptPdfData,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  ensureUploadsDir();
  const fileName = `Receipt_${data.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const relativeUrl = `/uploads/documents/${fileName}`;

  // Generate QR Code data URL or buffer
  const qrText = data.verifiedUrl || `BuildTrack Receipt: ${data.receiptNumber} | Unit: ${data.unitNumber} | Amount: INR ${data.paymentAmount} | Date: ${new Date(data.paymentDate).toLocaleDateString('en-IN')}`;
  const qrBuffer = await QRCode.toBuffer(qrText, { width: 120, margin: 1 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const writeStream = fs.createWriteStream(filePath);
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.pipe(writeStream);

    // Document styling constants
    const primaryColor = '#E8590C'; // Terracotta
    const navyColor = '#17263B';
    const darkGray = '#333333';
    const lightGray = '#777777';
    const pageMargin = 40;
    const pageWidth = 595.28;
    const contentWidth = pageWidth - pageMargin * 2;

    // Header top band
    doc.rect(pageMargin, 35, contentWidth, 5).fill(primaryColor);

    // Company & Document Header
    doc.fontSize(20).fillColor(navyColor).font('Helvetica-Bold').text(data.companyName, pageMargin, 50);
    doc.fontSize(9).font('Helvetica').fillColor(lightGray);
    if (data.companyAddress) doc.text(data.companyAddress, pageMargin, 74, { width: 320 });
    const contactLine = [
      data.companyPhone ? `Tel: ${data.companyPhone}` : null,
      data.companyEmail ? `Email: ${data.companyEmail}` : null,
      data.companyGstin ? `GSTIN: ${data.companyGstin}` : null,
    ].filter(Boolean).join('  |  ');
    if (contactLine) doc.text(contactLine, pageMargin, doc.y + 2, { width: 320 });

    // Official Receipt Banner (Right Side)
    const rightBoxX = pageWidth - pageMargin - 180;
    doc.rect(rightBoxX, 48, 180, 52).fillAndStroke('#FDF5F0', primaryColor);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor).text('PAYMENT RECEIPT', rightBoxX + 10, 56);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(navyColor).text(`No: ${data.receiptNumber}`, rightBoxX + 10, 72);
    doc.fontSize(8.5).font('Helvetica').fillColor(darkGray).text(
      `Date: ${new Date(data.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      rightBoxX + 10,
      86,
    );

    doc.moveDown(2);
    const yAfterHeader = 120;
    doc.strokeColor('#E0E0E0').lineWidth(1).moveTo(pageMargin, yAfterHeader).lineTo(pageWidth - pageMargin, yAfterHeader).stroke();

    // Section 1: Customer Details vs Property Details (Two column layout)
    const colWidth = (contentWidth - 20) / 2;
    const col1X = pageMargin;
    const col2X = pageMargin + colWidth + 20;
    const topY = yAfterHeader + 12;

    // Col 1: Customer Info
    doc.rect(col1X, topY, colWidth, 90).fill('#FAFAFA');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(navyColor).text('RECEIVED FROM', col1X + 10, topY + 8);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(darkGray).text(data.customerName, col1X + 10, topY + 24);
    doc.fontSize(8.5).font('Helvetica').fillColor(lightGray);
    doc.text(`Mobile: ${data.customerPhone}`, col1X + 10, topY + 38);
    if (data.customerEmail) doc.text(`Email: ${data.customerEmail}`, col1X + 10, topY + 50);
    if (data.customerPan) doc.text(`PAN: ${data.customerPan}`, col1X + 10, topY + 62);
    if (data.customerAddress) doc.text(`Address: ${data.customerAddress.slice(0, 45)}`, col1X + 10, topY + 74);

    // Col 2: Unit & Project Info
    doc.rect(col2X, topY, colWidth, 90).fill('#FAFAFA');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(navyColor).text('PROPERTY DETAILS', col2X + 10, topY + 8);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(darkGray).text(`Unit: ${data.unitNumber} (${data.unitType || 'Unit'})`, col2X + 10, topY + 24);
    doc.fontSize(8.5).font('Helvetica').fillColor(lightGray);
    doc.text(`Project: ${data.projectName}${data.projectCode ? ` (${data.projectCode})` : ''}`, col2X + 10, topY + 38);
    if (data.towerName || data.floorName) {
      doc.text(`Tower: ${data.towerName || 'N/A'} | Floor: ${data.floorName || 'N/A'}`, col2X + 10, topY + 50);
    }
    if (data.carpetAreaSqft) doc.text(`Carpet Area: ${data.carpetAreaSqft} Sq. Ft.`, col2X + 10, topY + 62);
    if (data.reraNumber) doc.text(`RERA Reg: ${data.reraNumber}`, col2X + 10, topY + 74);

    // Section 2: Payment Particulars Table
    const tableY = topY + 106;
    doc.rect(pageMargin, tableY, contentWidth, 24).fill(navyColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('DESCRIPTION / PAYMENT PARTICULARS', pageMargin + 10, tableY + 7);
    doc.text('MODE / REF NO.', pageMargin + 250, tableY + 7);
    doc.text('AMOUNT (INR)', pageWidth - pageMargin - 110, tableY + 7, { width: 100, align: 'right' });

    // Table Data Row
    const rowY = tableY + 24;
    doc.rect(pageMargin, rowY, contentWidth, 48).fillAndStroke('#FFFFFF', '#E0E0E0');
    doc.fontSize(9).font('Helvetica-Bold').fillColor(darkGray);
    doc.text(`Payment towards Unit ${data.unitNumber}`, pageMargin + 10, rowY + 10);
    doc.fontSize(8).font('Helvetica').fillColor(lightGray);
    if (data.notes) doc.text(data.notes.slice(0, 50), pageMargin + 10, rowY + 24);

    const modeStr = data.paymentMode.toUpperCase();
    const refStr = data.transactionId || data.chequeNumber ? `Ref: ${data.transactionId || data.chequeNumber}` : 'Direct';
    doc.fontSize(8.5).font('Helvetica').fillColor(darkGray).text(`${modeStr}`, pageMargin + 250, rowY + 10);
    doc.fontSize(8).font('Helvetica').fillColor(lightGray).text(refStr, pageMargin + 250, rowY + 24);

    doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text(
      `Rs. ${Math.round(data.paymentAmount).toLocaleString('en-IN')}`,
      pageWidth - pageMargin - 130,
      rowY + 14,
      { width: 120, align: 'right' },
    );

    // Amount in Words Bar
    const wordsY = rowY + 54;
    doc.rect(pageMargin, wordsY, contentWidth, 26).fill('#F6F6F6');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(navyColor).text('Amount in Words:', pageMargin + 10, wordsY + 8);
    const words = numberToWordsINR(data.paymentAmount);
    doc.fontSize(8.5).font('Helvetica').fillColor(darkGray).text(words, pageMargin + 115, wordsY + 8, { width: contentWidth - 125 });

    // Financial Summary (Unit Total, Paid, Outstanding)
    if (data.totalUnitValue !== undefined) {
      const summaryY = wordsY + 34;
      doc.rect(pageMargin, summaryY, contentWidth, 34).fill('#FBFBFA');
      const boxW = contentWidth / 3;
      
      // Box 1
      doc.fontSize(8).font('Helvetica').fillColor(lightGray).text('TOTAL UNIT VALUE', pageMargin + 10, summaryY + 6);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(navyColor).text(`Rs. ${Math.round(data.totalUnitValue).toLocaleString('en-IN')}`, pageMargin + 10, summaryY + 18);

      // Box 2
      doc.fontSize(8).font('Helvetica').fillColor(lightGray).text('TOTAL PAID TILL DATE', pageMargin + boxW + 10, summaryY + 6);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F7A43').text(`Rs. ${Math.round(data.totalPaidTillNow || data.paymentAmount).toLocaleString('en-IN')}`, pageMargin + boxW + 10, summaryY + 18);

      // Box 3
      doc.fontSize(8).font('Helvetica').fillColor(lightGray).text('OUTSTANDING BALANCE', pageMargin + boxW * 2 + 10, summaryY + 6);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#C0362C').text(`Rs. ${Math.round(data.remainingBalance || 0).toLocaleString('en-IN')}`, pageMargin + boxW * 2 + 10, summaryY + 18);
    }

    // QR Code & Signatures Area (Bottom)
    const bottomY = 460;
    doc.image(qrBuffer, pageMargin + 10, bottomY, { width: 85, height: 85 });
    doc.fontSize(7.5).font('Helvetica').fillColor(lightGray).text('Scan QR code for digital verification', pageMargin + 5, bottomY + 90, { width: 100, align: 'center' });

    // Bank Details if Cheque/NEFT
    const bankX = pageMargin + 120;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(navyColor).text('PAYMENT TERMS & NOTES', bankX, bottomY + 5);
    doc.fontSize(7.5).font('Helvetica').fillColor(lightGray);
    doc.text('1. Payments made via Cheque are subject to realization.', bankX, bottomY + 18, { width: 220 });
    doc.text('2. This is a computer-generated receipt with verifiable digital seal.', bankX, bottomY + 30, { width: 220 });
    doc.text('3. Please quote receipt number for all future correspondence.', bankX, bottomY + 42, { width: 220 });

    // Signature Box
    const sigX = pageWidth - pageMargin - 150;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(navyColor).text(`For ${data.companyName}`, sigX, bottomY + 5, { width: 150, align: 'center' });
    doc.rect(sigX, bottomY + 22, 150, 48).stroke('#CCCCCC');
    doc.fontSize(7.5).font('Helvetica').fillColor(lightGray).text('Authorized Signatory', sigX, bottomY + 54, { width: 150, align: 'center' });

    // Footer band
    doc.rect(pageMargin, 595.28 - 20, contentWidth, 1).fill('#E0E0E0');
    doc.fontSize(7).font('Helvetica').fillColor(lightGray).text('BuildTrack Enterprise ERP • Certified Official Record', pageMargin, 595.28 - 15, { width: contentWidth, align: 'center' });

    doc.end();

    writeStream.on('finish', () => {
      resolve({ filePath, relativeUrl, buffer: Buffer.concat(chunks) });
    });
    writeStream.on('error', reject);
  });
}

/**
 * Generates formatted legal document PDF (Banakhat or Dastavej)
 */
export async function generateLegalDocumentPdf(
  data: LegalDocPdfData,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
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

    const primaryColor = '#E8590C';
    const navyColor = '#17263B';
    const darkGray = '#2B2E33';

    // Header
    doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text(data.title.toUpperCase(), { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor(darkGray).text(`Document Ref: ${data.documentNumber}  |  Date: ${data.todayDate}`, { align: 'center' });
    if (data.reraNumber) {
      doc.fontSize(8).fillColor('#666666').text(`RERA Registration No: ${data.reraNumber}`, { align: 'center' });
    }
    doc.moveDown(1);
    doc.strokeColor('#D0D0D0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
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
        // Strip markdown bold asterisks for clean PDF layout
        const cleanText = line.replace(/\*\*(.*?)\*\*/g, '$1');
        doc.fontSize(9.5).font('Helvetica').fillColor(darkGray).text(cleanText, {
          align: 'justify',
          lineGap: 3,
        });
      }
    }

    doc.end();

    writeStream.on('finish', () => {
      resolve({ filePath, relativeUrl, buffer: Buffer.concat(chunks) });
    });
    writeStream.on('error', reject);
  });
}
