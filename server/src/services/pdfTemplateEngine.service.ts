import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import PDFKit from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { numberToWordsINR } from './templateEngine.service';

export interface ProjectConfig {
  projectName: string;
  projectCode?: string;
  developerName?: string;
  companyName?: string;
  officeAddress?: string;
  siteAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstNumber?: string;
  reraNumber?: string;
  panNumber?: string;
  logoUrl?: string | null;
  tagline?: string;
  jurisdiction?: string;
  primaryColor?: string;
  secondaryColor?: string;
  authorizedSignatoryTitle?: string;
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
}

export interface ReceiptPaymentData {
  receiptNumber: string;
  paymentDate: Date | string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  unitNumber: string;
  towerName?: string;
  floorName?: string;
  unitType?: string;
  carpetAreaSqft?: number;
  paymentAmount: number;
  paymentMode: string;
  transactionId?: string;
  chequeNumber?: string;
  chequeDate?: Date | string;
  bankName?: string;
  totalUnitValue?: number;
  totalPaidTillNow?: number;
  remainingBalance?: number;
  notes?: string;
}

export interface LegalDocData {
  documentNumber: string;
  bookingNumber?: string;
  bookingDate?: Date | string;
  todayDate?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerPan?: string;
  customerAddress?: string;
  customerAge?: string | number;
  customerOccupation?: string;
  customerReligion?: string;
  unitNumber: string;
  towerName?: string;
  floorName?: string;
  unitType?: string;
  carpetAreaSqft?: number;
  carpetAreaSqmt?: number;
  builtUpAreaSqft?: number;
  balconyAreaSqmt?: number;
  washAreaSqmt?: number;
  totalAreaSqmt?: number;
  landShareSqmt?: number;
  terraceAreaSqmt?: number;
  facing?: string;
  parkingSlot?: string;
  totalAmount: number;
  basePrice?: number;
  gstAmount?: number;
  bookingAmount?: number;
  boundaries?: {
    east?: string;
    west?: string;
    north?: string;
    south?: string;
  };
}

export interface PaymentRecord {
  amount: number;
  mode: string;
  refNo?: string;
  date?: string | Date;
  bankName?: string;
  branchName?: string;
}

const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function formatDate(dateInput?: Date | string): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('en-IN');
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. PAYMENT RECEIPT (8.5 × 5.5 inches landscape)
 * Uses SANTORA RECEIPT.pdf as base vector template, overlays dynamic project & payment data.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function fillReceiptPdf(
  project: ProjectConfig,
  payment: ReceiptPaymentData,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  ensureUploadsDir();
  const safeReceiptNo = payment.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Receipt_${safeReceiptNo}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const relativeUrl = `/uploads/documents/${fileName}`;

  const templateFile = path.join(TEMPLATES_DIR, 'SANTORA RECEIPT.pdf');

  // If template is missing, fallback to pure vector pdfkit generation
  if (!fs.existsSync(templateFile)) {
    return generateReceiptPdfVector(project, payment, filePath, relativeUrl);
  }

  const templateBytes = fs.readFileSync(templateFile);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(0);
  const { width: pWidth, height: pHeight } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const darkColor = rgb(0.12, 0.12, 0.13);
  const maroonColor = rgb(0.57, 0.03, 0.15); // #910827
  const grayColor = rgb(0.35, 0.35, 0.35);

  // Check if project customization is different from default Rudra / Santora
  const developerName = (project.developerName || project.companyName || 'RUDRA DEVELOPERS').trim();
  const isDefaultSantora =
    developerName.toLowerCase().includes('rudra') &&
    (project.projectName || '').toLowerCase().includes('santora');

  // ── Top-Left Header: Developer, Address, Contact, RECEIPT badge ───────
  if (!isDefaultSantora) {
    // White out original header
    page.drawRectangle({
      x: 98,
      y: pHeight - 145,
      width: 320,
      height: 110,
      color: rgb(1, 1, 1),
    });

    // Developer name
    page.drawText(developerName.toUpperCase(), {
      x: 102,
      y: pHeight - 55,
      size: 13,
      font: fontBold,
      color: darkColor,
    });

    // Address
    const address = project.officeAddress || project.siteAddress || 'Ahmedabad, Gujarat';
    const cleanAddress = address.length > 90 ? address.slice(0, 90) + '...' : address;
    page.drawText(cleanAddress, {
      x: 102,
      y: pHeight - 70,
      size: 8,
      font: fontRegular,
      color: grayColor,
    });

    // Contact
    const contactParts: string[] = [];
    if (project.phone) contactParts.push(project.phone);
    if (project.email) contactParts.push(project.email);
    if (contactParts.length > 0) {
      page.drawText(contactParts.join(' | '), {
        x: 102,
        y: pHeight - 84,
        size: 8,
        font: fontBold,
        color: grayColor,
      });
    }

    // Red/Maroon RECEIPT badge
    page.drawRectangle({
      x: 102,
      y: pHeight - 114,
      width: 66,
      height: 19.5,
      color: maroonColor,
    });
    page.drawText('RECEIPT', {
      x: 114,
      y: pHeight - 108,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  }

  // ── Top-Right Header: Tagline & Project Logo ──────────────────────────
  if (!isDefaultSantora) {
    // White out top-right logo
    page.drawRectangle({
      x: 430,
      y: pHeight - 140,
      width: 140,
      height: 105,
      color: rgb(1, 1, 1),
    });

    // Subtitle / Tagline
    const tagline = project.tagline || project.legalDocConfig?.projectTagline || 'RESIDENTIAL APARTMENTS';
    page.drawText(tagline.toUpperCase(), {
      x: 435,
      y: pHeight - 60,
      size: 7.5,
      font: fontBold,
      color: darkColor,
    });

    // Project Logo (if custom image file exists) or bold project name
    let logoDrawn = false;
    if (project.logoUrl) {
      try {
        const localLogoPath = path.resolve(process.cwd(), project.logoUrl.replace(/^\//, ''));
        if (fs.existsSync(localLogoPath)) {
          const logoBytes = fs.readFileSync(localLogoPath);
          const embeddedImage = localLogoPath.endsWith('.jpg') || localLogoPath.endsWith('.jpeg')
            ? await pdfDoc.embedJpg(logoBytes)
            : await pdfDoc.embedPng(logoBytes);
          const imgDims = embeddedImage.scaleToFit(130, 45);
          page.drawImage(embeddedImage, {
            x: 435,
            y: pHeight - 115,
            width: imgDims.width,
            height: imgDims.height,
          });
          logoDrawn = true;
        }
      } catch {
        logoDrawn = false;
      }
    }

    if (!logoDrawn) {
      page.drawText((project.projectName || 'PROJECT').toUpperCase(), {
        x: 435,
        y: pHeight - 85,
        size: 16,
        font: fontBold,
        color: darkColor,
      });
    }
  }

  // ── Form Fields (Populated over underlines) ───────────────────────────
  // Date: y = 243 (398 - 155)
  const paymentDateStr = formatDate(payment.paymentDate);
  page.drawText(paymentDateStr, {
    x: 135,
    y: 243,
    size: 10,
    font: fontBold,
    color: darkColor,
  });

  // Receipt No:
  page.drawText(payment.receiptNumber, {
    x: 462,
    y: 243,
    size: 10,
    font: fontBold,
    color: darkColor,
  });

  // Received With Thanks From:
  page.drawText((payment.customerName || 'CUSTOMER').toUpperCase(), {
    x: 275,
    y: 219,
    size: 10.5,
    font: fontBold,
    color: darkColor,
  });

  // Unit / Property Line:
  const unitParts = [`Unit No. ${payment.unitNumber}`];
  if (payment.floorName) unitParts.push(payment.floorName);
  if (payment.towerName) unitParts.push(payment.towerName);
  unitParts.push(project.projectName || 'Project');
  if (payment.carpetAreaSqft) unitParts.push(`Carpet: ${payment.carpetAreaSqft} Sq. Ft.`);
  page.drawText(unitParts.join(', '), {
    x: 105,
    y: 195,
    size: 9.5,
    font: fontBold,
    color: rgb(0.18, 0.18, 0.2),
  });

  // The Sum Of Rupees (in words):
  const amountWords = numberToWordsINR(payment.paymentAmount);
  page.drawText(amountWords, {
    x: 195,
    y: 171,
    size: 10,
    font: fontBold,
    color: darkColor,
  });

  // By Cheque / Draft / RTGS / IMPS No.:
  const modeText = payment.paymentMode.toUpperCase();
  const refText = payment.transactionId || payment.chequeNumber || '';
  const modeRefStr = refText ? `${modeText} / REF: ${refText}` : modeText;
  page.drawText(modeRefStr, {
    x: 272,
    y: 143,
    size: 10,
    font: fontBold,
    color: darkColor,
  });

  // Bank name & Date:
  const bankStr = payment.bankName || 'Direct Transfer / Cash';
  page.drawText(bankStr, {
    x: 165,
    y: 120,
    size: 10,
    font: fontBold,
    color: darkColor,
  });

  const chqDateStr = formatDate(payment.chequeDate || payment.paymentDate);
  page.drawText(chqDateStr, {
    x: 502,
    y: 120,
    size: 10,
    font: fontBold,
    color: darkColor,
  });

  // Numeric Rupee Box (x=138, y=70, size 14 bold):
  const amountStr = `${formatCurrency(payment.paymentAmount)}/-`;
  page.drawText(amountStr, {
    x: 138,
    y: 70,
    size: 14,
    font: fontBold,
    color: darkColor,
  });

  // Signatory title (top of signature box):
  const signEntity = project.authorizedSignatoryTitle || `FOR, ${developerName.toUpperCase()}`;
  page.drawRectangle({
    x: 440,
    y: 92,
    width: 130,
    height: 15,
    color: rgb(1, 1, 1),
  });
  page.drawText(signEntity.length > 28 ? signEntity.slice(0, 28) : signEntity, {
    x: 445,
    y: 94,
    size: 7.5,
    font: fontBold,
    color: darkColor,
  });

  // Jurisdiction footer:
  const jurisdiction = project.jurisdiction || project.legalDocConfig?.jurisdiction || 'Ahmedabad Jurisdiction';
  page.drawRectangle({
    x: 95,
    y: 20,
    width: 360,
    height: 16,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Subject To Realisation Of The Cheque  •  ${jurisdiction}`, {
    x: 100,
    y: 22,
    size: 7.5,
    font: fontRegular,
    color: grayColor,
  });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  fs.writeFileSync(filePath, buffer);

  return { filePath, relativeUrl, buffer };
}

/**
 * Pure vector fallback for Receipt (8.5 × 5.5 inches) using PDFKit
 */
function generateReceiptPdfVector(
  project: ProjectConfig,
  payment: ReceiptPaymentData,
  filePath: string,
  relativeUrl: string,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    // 8.5 × 5.5 inches in points: 612 × 396
    const doc = new PDFKit({ size: [614, 398], margin: 0 });
    const chunks: Buffer[] = [];
    const writeStream = fs.createWriteStream(filePath);

    doc.on('data', (c) => chunks.push(c));
    doc.pipe(writeStream);

    const devName = (project.developerName || project.companyName || 'RUDRA DEVELOPERS').toUpperCase();
    const projName = (project.projectName || 'SANTORA').toUpperCase();
    const tagline = project.tagline || '2 BHK PODIUM HOMES';
    const address = project.officeAddress || project.siteAddress || 'Ahmedabad, Gujarat';
    const contact = [project.phone, project.email].filter(Boolean).join(' | ') || '+91 75749 98888';
    const jurisdiction = project.jurisdiction || 'Ahmedabad Jurisdiction';

    // Outer Perforated Dashed Line on left stub (x=57.6)
    doc.save();
    doc.dash(3, { space: 3 });
    doc.strokeColor('#BBBBBB').lineWidth(0.8).moveTo(57.6, 26).lineTo(57.6, 372).stroke();
    doc.restore();

    // Main Card Solid Outer Border
    doc.rect(79.2, 26.2, 509.4, 346.2).strokeColor('#2B2E33').lineWidth(1.2).stroke();

    // Top-Left Header: Developer, Address, Contact
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#2B2E33').text(devName, 102, 42);
    doc.fontSize(8).font('Helvetica').fillColor('#555555').text(address, 102, 58, { width: 320 });
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333').text(contact, 102, 72, { width: 320 });

    // Maroon "RECEIPT" badge
    doc.roundedRect(102.8, 88, 66, 19.5, 2).fill('#910827');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#FFFFFF').text('RECEIPT', 114, 93);

    // Top-Right Header: Tagline & Project
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#2B2E33').text(tagline.toUpperCase(), 435, 42, { width: 140, align: 'right' });
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#910827').text(projName, 435, 54, { width: 140, align: 'right' });

    // Fields & Underlines
    const drawUnderline = (x1: number, x2: number, y: number) => {
      doc.strokeColor('#333333').lineWidth(0.6).moveTo(x1, y).lineTo(x2, y).stroke();
    };

    // Date & Receipt No:
    doc.fontSize(9.5).font('Helvetica').fillColor('#2B2E33').text('Date :', 102, 142);
    drawUnderline(132, 220, 154);
    doc.fontSize(9.5).font('Helvetica-Bold').text(formatDate(payment.paymentDate), 135, 142);

    doc.fontSize(9.5).font('Helvetica').text('Receipt No. :', 400, 142);
    drawUnderline(460, 564, 154);
    doc.fontSize(9.5).font('Helvetica-Bold').text(payment.receiptNumber, 465, 142);

    // Received with thanks from:
    doc.fontSize(9.5).font('Helvetica').text('Received With Thanks From Mr. / Mrs.', 102, 168);
    drawUnderline(272, 564, 180);
    doc.fontSize(10).font('Helvetica-Bold').text(payment.customerName.toUpperCase(), 275, 167);

    // Unit & Project line:
    drawUnderline(102, 564, 204);
    const unitDesc = `Unit No. ${payment.unitNumber}, ${payment.floorName || ''} ${payment.towerName || ''}, ${projName} (${payment.carpetAreaSqft || ''} Sq. Ft.)`;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#444444').text(unitDesc, 105, 192);

    // Sum of Rupees:
    doc.fontSize(9.5).font('Helvetica').fillColor('#2B2E33').text('The Sum Of Rupees', 102, 218);
    drawUnderline(192, 564, 230);
    doc.fontSize(9.5).font('Helvetica-Bold').text(numberToWordsINR(payment.paymentAmount), 195, 217);

    // Mode & Reference:
    doc.fontSize(9.5).font('Helvetica').text('By Cheque / Draft / RTGS / IMPS No.', 102, 244);
    drawUnderline(268, 564, 256);
    const refStr = payment.transactionId || payment.chequeNumber ? `${payment.paymentMode.toUpperCase()} / REF: ${payment.transactionId || payment.chequeNumber}` : payment.paymentMode.toUpperCase();
    doc.fontSize(9.5).font('Helvetica-Bold').text(refStr, 272, 243);

    // Bank name & Date:
    doc.fontSize(9.5).font('Helvetica').text('Bank name :', 102, 270);
    drawUnderline(160, 470, 282);
    doc.fontSize(9.5).font('Helvetica-Bold').text(payment.bankName || 'Direct Transfer', 165, 269);

    doc.fontSize(9.5).font('Helvetica').text('Date :', 472, 270);
    drawUnderline(498, 564, 282);
    doc.fontSize(9.5).font('Helvetica-Bold').text(formatDate(payment.chequeDate || payment.paymentDate), 502, 269);

    // Amount Rupee Box
    doc.rect(102.27, 308.23, 172.5, 30.3).strokeColor('#2B2E33').lineWidth(1).stroke();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#910827').text('₹', 108.8, 316);
    doc.strokeColor('#CCCCCC').lineWidth(0.8).moveTo(128.18, 308.23).lineTo(128.18, 338.53).stroke();
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#2B2E33').text(`${formatCurrency(payment.paymentAmount)}/-`, 138, 316);

    // Footer note:
    doc.fontSize(7.5).font('Helvetica').fillColor('#555555').text(`Subject To Realisation Of The Cheque  •  ${jurisdiction}`, 102, 356);

    // Signatory box:
    const signEntity = project.authorizedSignatoryTitle || `FOR, ${devName}`;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#2B2E33').text(signEntity, 455, 296, { width: 120, align: 'center' });
    doc.rect(487.57, 305.35, 46.77, 46.77).strokeColor('#2B2E33').lineWidth(0.8).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor('#555555').text('Authorized Signature', 455, 356, { width: 120, align: 'center' });

    doc.end();
    writeStream.on('finish', () => resolve({ filePath, relativeUrl, buffer: Buffer.concat(chunks) }));
    writeStream.on('error', reject);
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. AGREEMENT OF SALE (BANAKHAT - 27 PAGES)
 * Loads Agrement Of Sales Draft Satora.pdf, replaces blank fields with dynamic booking & project data.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function fillBanakhatPdf(
  project: ProjectConfig,
  docData: LegalDocData,
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  ensureUploadsDir();
  const safeDocNo = docData.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Banakhat_${safeDocNo}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const relativeUrl = `/uploads/documents/${fileName}`;

  const templateFile = path.join(TEMPLATES_DIR, 'Agrement Of Sales Draft Satora.pdf');
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Banakhat template file not found at: ${templateFile}`);
  }

  const templateBytes = fs.readFileSync(templateFile);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const darkColor = rgb(0.1, 0.1, 0.1);

  const whiteOut = (page: PDFPage, x: number, y: number, w: number, h: number) => {
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 1, 1) });
  };

  const carpetSqmt = docData.carpetAreaSqmt || (docData.carpetAreaSqft ? Math.round((docData.carpetAreaSqft / 10.764) * 100) / 100 : 134.7);
  const balconySqmt = docData.balconyAreaSqmt || 8.5;
  const washSqmt = docData.washAreaSqmt || 4.5;
  const landShareSqmt = docData.landShareSqmt || 25.0;
  const totalAreaSqmt = docData.totalAreaSqmt || Math.round((carpetSqmt + balconySqmt + washSqmt) * 100) / 100;

  // ── Page 2: Purchaser Particulars ─────────────────────────────────────
  const p2 = pdfDoc.getPage(1);
  const p2H = p2.getHeight();

  // Name
  whiteOut(p2, 220, p2H - 93, 230, 18);
  p2.drawText((docData.customerName || 'PURCHASER').toUpperCase(), {
    x: 222,
    y: p2H - 90,
    size: 11,
    font: fontBold,
    color: darkColor,
  });

  // PAN
  whiteOut(p2, 300, p2H - 118, 130, 18);
  p2.drawText(docData.customerPan || 'N/A', {
    x: 302,
    y: p2H - 115,
    size: 10.5,
    font: fontBold,
    color: darkColor,
  });

  // Age & Occupation
  whiteOut(p2, 330, p2H - 141, 70, 18);
  p2.drawText(`${docData.customerOccupation || 'Business'}`, {
    x: 332,
    y: p2H - 138,
    size: 10,
    font: fontRegular,
    color: darkColor,
  });

  // Address
  whiteOut(p2, 280, p2H - 167, 245, 18);
  const custAddr = docData.customerAddress || 'Ahmedabad, Gujarat';
  p2.drawText(custAddr.length > 55 ? custAddr.slice(0, 55) : custAddr, {
    x: 282,
    y: p2H - 164,
    size: 9.5,
    font: fontRegular,
    color: darkColor,
  });

  // ── Page 5: Allotment Recitals ────────────────────────────────────────
  const p5 = pdfDoc.getPage(4);
  const p5H = p5.getHeight();
  // Block
  whiteOut(p5, 270, p5H - 263, 40, 16);
  p5.drawText(docData.towerName || 'A', { x: 272, y: p5H - 260, size: 10, font: fontBold });
  // Floor
  whiteOut(p5, 335, p5H - 263, 40, 16);
  p5.drawText(docData.floorName || '4th', { x: 337, y: p5H - 260, size: 10, font: fontBold });
  // Flat No
  whiteOut(p5, 235, p5H - 287, 60, 16);
  p5.drawText(docData.unitNumber || 'A-402', { x: 237, y: p5H - 284, size: 10, font: fontBold });
  // Carpet Area
  whiteOut(p5, 335, p5H - 287, 60, 16);
  p5.drawText(`${carpetSqmt}`, { x: 337, y: p5H - 284, size: 10, font: fontBold });

  // ── Page 6: Balcony, Wash, Land Share ─────────────────────────────────
  const p6 = pdfDoc.getPage(5);
  const p6H = p6.getHeight();
  whiteOut(p6, 235, p6H - 93, 45, 16);
  p6.drawText(`${balconySqmt}`, { x: 237, y: p6H - 90, size: 10, font: fontBold });
  whiteOut(p6, 385, p6H - 93, 45, 16);
  p6.drawText(`${washSqmt}`, { x: 387, y: p6H - 90, size: 10, font: fontBold });
  whiteOut(p6, 275, p6H - 117, 50, 16);
  p6.drawText(`${landShareSqmt}`, { x: 277, y: p6H - 114, size: 10, font: fontBold });

  // ── Page 7: RERA, Booking Amount, Total Consideration ─────────────────
  const p7 = pdfDoc.getPage(6);
  const p7H = p7.getHeight();
  // RERA Number & Date
  const reraNum = project.reraNumber || 'PR/GJ/GANDHINAGAR/2026/001';
  whiteOut(p7, 340, p7H - 93, 190, 16);
  p7.drawText(reraNum, { x: 342, y: p7H - 90, size: 9, font: fontBold });

  // Booking Amount
  const bookAmt = docData.bookingAmount || Math.round(docData.totalAmount * 0.1);
  whiteOut(p7, 360, p7H - 117, 90, 16);
  p7.drawText(`${formatCurrency(bookAmt)}/-`, { x: 362, y: p7H - 114, size: 10, font: fontBold });

  whiteOut(p7, 185, p7H - 141, 160, 16);
  p7.drawText(numberToWordsINR(bookAmt), { x: 187, y: p7H - 138, size: 8.5, font: fontBold });

  // Total Consideration
  whiteOut(p7, 235, p7H - 190, 100, 16);
  p7.drawText(`${formatCurrency(docData.totalAmount)}/-`, { x: 237, y: p7H - 187, size: 10, font: fontBold });

  whiteOut(p7, 395, p7H - 190, 140, 16);
  p7.drawText(numberToWordsINR(docData.totalAmount), { x: 397, y: p7H - 187, size: 8.5, font: fontBold });

  // ── Page 8: Allotment Schedule Summary ────────────────────────────────
  const p8 = pdfDoc.getPage(7);
  const p8H = p8.getHeight();
  whiteOut(p8, 270, p8H - 93, 35, 16);
  p8.drawText(docData.towerName || 'A', { x: 272, y: p8H - 90, size: 10, font: fontBold });
  whiteOut(p8, 335, p8H - 93, 35, 16);
  p8.drawText(docData.floorName || '4th', { x: 337, y: p8H - 90, size: 10, font: fontBold });
  whiteOut(p8, 240, p8H - 117, 60, 16);
  p8.drawText(docData.unitNumber || 'A-402', { x: 242, y: p8H - 114, size: 10, font: fontBold });
  whiteOut(p8, 340, p8H - 117, 50, 16);
  p8.drawText(`${carpetSqmt}`, { x: 342, y: p8H - 114, size: 10, font: fontBold });
  whiteOut(p8, 235, p8H - 141, 45, 16);
  p8.drawText(`${balconySqmt}`, { x: 237, y: p8H - 138, size: 10, font: fontBold });
  whiteOut(p8, 385, p8H - 141, 45, 16);
  p8.drawText(`${washSqmt}`, { x: 387, y: p8H - 138, size: 10, font: fontBold });
  whiteOut(p8, 235, p8H - 165, 45, 16);
  p8.drawText(`${totalAreaSqmt}`, { x: 237, y: p8H - 162, size: 10, font: fontBold });
  whiteOut(p8, 385, p8H - 165, 45, 16);
  p8.drawText(`${landShareSqmt}`, { x: 387, y: p8H - 162, size: 10, font: fontBold });
  whiteOut(p8, 220, p8H - 189, 90, 16);
  p8.drawText(`${formatCurrency(docData.totalAmount)}/-`, { x: 222, y: p8H - 186, size: 10, font: fontBold });

  // ── Page 24: Property Parishisht & Boundaries ─────────────────────────
  const p24 = pdfDoc.getPage(23);
  const p24H = p24.getHeight();
  const b = docData.boundaries || { east: 'Internal Road', west: 'Adjacent Flat', north: 'Open Space', south: 'Common Corridor' };
  whiteOut(p24, 215, p24H - 245, 60, 14);
  p24.drawText(b.east || 'Internal Road', { x: 217, y: p24H - 243, size: 9, font: fontRegular });
  whiteOut(p24, 335, p24H - 245, 60, 14);
  p24.drawText(b.west || 'Adjacent Flat', { x: 337, y: p24H - 243, size: 9, font: fontRegular });
  whiteOut(p24, 215, p24H - 265, 60, 14);
  p24.drawText(b.north || 'Open Space', { x: 217, y: p24H - 263, size: 9, font: fontRegular });
  whiteOut(p24, 335, p24H - 265, 60, 14);
  p24.drawText(b.south || 'Common Corridor', { x: 337, y: p24H - 263, size: 9, font: fontRegular });

  // ── Page 26: Signatures & Execution Date ──────────────────────────────
  const p26 = pdfDoc.getPage(25);
  const p26H = p26.getHeight();
  const todayStr = docData.todayDate || formatDate(new Date());
  whiteOut(p26, 215, p26H - 93, 140, 16);
  p26.drawText(todayStr, { x: 217, y: p26H - 90, size: 9.5, font: fontBold });

  // Purchaser signature line
  whiteOut(p26, 220, p26H - 235, 200, 16);
  p26.drawText(`( ${docData.customerName.toUpperCase()} )`, { x: 222, y: p26H - 232, size: 9.5, font: fontBold });

  // ── Page 27: Back Cover Flat No ───────────────────────────────────────
  const p27 = pdfDoc.getPage(26);
  const p27H = p27.getHeight();
  whiteOut(p27, 280, p27H - 455, 120, 24);
  p27.drawText(docData.unitNumber || 'A-402', { x: 285, y: p27H - 450, size: 14, font: fontBold });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  fs.writeFileSync(filePath, buffer);

  return { filePath, relativeUrl, buffer };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. SALES DEED (DASTAVEJ - 17 PAGES LEGAL SIZE: 8.5 × 14 in)
 * Loads Sales Deed Draft Santora.pdf, replaces blank fields with dynamic booking & project data.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function fillDastavejPdf(
  project: ProjectConfig,
  docData: LegalDocData,
  paymentRecords: PaymentRecord[] = [],
): Promise<{ filePath: string; relativeUrl: string; buffer: Buffer }> {
  ensureUploadsDir();
  const safeDocNo = docData.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Dastavej_${safeDocNo}.pdf`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const relativeUrl = `/uploads/documents/${fileName}`;

  const templateFile = path.join(TEMPLATES_DIR, 'Sales Deed Draft Santora.pdf');
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Sales Deed template file not found at: ${templateFile}`);
  }

  const templateBytes = fs.readFileSync(templateFile);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const darkColor = rgb(0.1, 0.1, 0.1);

  const whiteOut = (page: PDFPage, x: number, y: number, w: number, h: number) => {
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 1, 1) });
  };

  const carpetSqmt = docData.carpetAreaSqmt || (docData.carpetAreaSqft ? Math.round((docData.carpetAreaSqft / 10.764) * 100) / 100 : 134.7);
  const balconySqmt = docData.balconyAreaSqmt || 8.5;
  const washSqmt = docData.washAreaSqmt || 4.5;
  const landShareSqmt = docData.landShareSqmt || 25.0;
  const totalAreaSqmt = docData.totalAreaSqmt || Math.round((carpetSqmt + balconySqmt + washSqmt) * 100) / 100;
  const terraceSqmt = docData.terraceAreaSqmt || 0.0;

  // ── Page 1: Title & Consideration ─────────────────────────────────────
  const p1 = pdfDoc.getPage(0);
  const p1H = p1.getHeight();
  // Unit & Consideration in numbers & words
  whiteOut(p1, 230, p1H - 775, 45, 16);
  p1.drawText(docData.towerName || 'A', { x: 232, y: p1H - 772, size: 10, font: fontBold });
  whiteOut(p1, 310, p1H - 775, 45, 16);
  p1.drawText(docData.floorName || '4th', { x: 312, y: p1H - 772, size: 10, font: fontBold });
  whiteOut(p1, 230, p1H - 800, 65, 16);
  p1.drawText(docData.unitNumber || 'A-402', { x: 232, y: p1H - 797, size: 10, font: fontBold });
  whiteOut(p1, 390, p1H - 800, 100, 16);
  p1.drawText(`${formatCurrency(docData.totalAmount)}/-`, { x: 392, y: p1H - 797, size: 10, font: fontBold });
  whiteOut(p1, 210, p1H - 825, 220, 16);
  p1.drawText(numberToWordsINR(docData.totalAmount), { x: 212, y: p1H - 822, size: 9, font: fontBold });

  // ── Page 2: Purchaser Particulars ─────────────────────────────────────
  const p2 = pdfDoc.getPage(1);
  const p2H = p2.getHeight();
  whiteOut(p2, 235, p2H - 510, 220, 18);
  p2.drawText((docData.customerName || 'PURCHASER').toUpperCase(), {
    x: 237,
    y: p2H - 507,
    size: 11,
    font: fontBold,
    color: darkColor,
  });

  whiteOut(p2, 310, p2H - 535, 120, 18);
  p2.drawText(docData.customerPan || 'N/A', {
    x: 312,
    y: p2H - 532,
    size: 10.5,
    font: fontBold,
    color: darkColor,
  });

  whiteOut(p2, 340, p2H - 560, 60, 18);
  p2.drawText(`${docData.customerOccupation || 'Business'}`, {
    x: 342,
    y: p2H - 557,
    size: 10,
    font: fontRegular,
    color: darkColor,
  });

  whiteOut(p2, 290, p2H - 585, 235, 18);
  const custAddr = docData.customerAddress || 'Ahmedabad, Gujarat';
  p2.drawText(custAddr.length > 55 ? custAddr.slice(0, 55) : custAddr, {
    x: 292,
    y: p2H - 582,
    size: 9.5,
    font: fontRegular,
    color: darkColor,
  });

  // ── Page 5: RERA Registration ─────────────────────────────────────────
  const p5 = pdfDoc.getPage(4);
  const p5H = p5.getHeight();
  const reraNum = project.reraNumber || 'PR/GJ/GANDHINAGAR/2026/001';
  whiteOut(p5, 340, p5H - 188, 190, 16);
  p5.drawText(reraNum, { x: 342, y: p5H - 185, size: 9, font: fontBold });

  // ── Page 6 & Page 8: Unit Specifications & Consideration ──────────────
  const p6 = pdfDoc.getPage(5);
  const p6H = p6.getHeight();
  whiteOut(p6, 270, p6H - 355, 35, 16);
  p6.drawText(docData.towerName || 'A', { x: 272, y: p6H - 352, size: 10, font: fontBold });
  whiteOut(p6, 335, p6H - 355, 35, 16);
  p6.drawText(docData.floorName || '4th', { x: 337, y: p6H - 352, size: 10, font: fontBold });
  whiteOut(p6, 240, p6H - 380, 60, 16);
  p6.drawText(docData.unitNumber || 'A-402', { x: 242, y: p6H - 377, size: 10, font: fontBold });
  whiteOut(p6, 340, p6H - 380, 50, 16);
  p6.drawText(`${carpetSqmt}`, { x: 342, y: p6H - 377, size: 10, font: fontBold });
  whiteOut(p6, 235, p6H - 405, 45, 16);
  p6.drawText(`${washSqmt}`, { x: 237, y: p6H - 402, size: 10, font: fontBold });
  whiteOut(p6, 385, p6H - 405, 45, 16);
  p6.drawText(`${balconySqmt}`, { x: 387, y: p6H - 402, size: 10, font: fontBold });
  whiteOut(p6, 275, p6H - 430, 50, 16);
  p6.drawText(`${landShareSqmt}`, { x: 277, y: p6H - 427, size: 10, font: fontBold });

  const p8 = pdfDoc.getPage(7);
  const p8H = p8.getHeight();
  whiteOut(p8, 270, p8H - 263, 35, 16);
  p8.drawText(docData.towerName || 'A', { x: 272, y: p8H - 260, size: 10, font: fontBold });
  whiteOut(p8, 335, p8H - 263, 35, 16);
  p8.drawText(docData.floorName || '4th', { x: 337, y: p8H - 260, size: 10, font: fontBold });
  whiteOut(p8, 240, p8H - 287, 60, 16);
  p8.drawText(docData.unitNumber || 'A-402', { x: 242, y: p8H - 284, size: 10, font: fontBold });
  whiteOut(p8, 340, p8H - 287, 50, 16);
  p8.drawText(`${carpetSqmt}`, { x: 342, y: p8H - 284, size: 10, font: fontBold });
  whiteOut(p8, 235, p8H - 311, 45, 16);
  p8.drawText(`${washSqmt}`, { x: 237, y: p8H - 308, size: 10, font: fontBold });
  whiteOut(p8, 385, p8H - 311, 45, 16);
  p8.drawText(`${balconySqmt}`, { x: 387, y: p8H - 308, size: 10, font: fontBold });
  whiteOut(p8, 275, p8H - 335, 50, 16);
  p8.drawText(`${landShareSqmt}`, { x: 277, y: p8H - 332, size: 10, font: fontBold });
  whiteOut(p8, 220, p8H - 360, 95, 16);
  p8.drawText(`${formatCurrency(docData.totalAmount)}/-`, { x: 222, y: p8H - 357, size: 10, font: fontBold });
  whiteOut(p8, 385, p8H - 360, 140, 16);
  p8.drawText(numberToWordsINR(docData.totalAmount), { x: 387, y: p8H - 357, size: 8.5, font: fontBold });

  // ── Page 9: Payment Breakdown Table ───────────────────────────────────
  const p9 = pdfDoc.getPage(8);
  const p9H = p9.getHeight();
  whiteOut(p9, 210, p9H - 215, 95, 16);
  p9.drawText(`${formatCurrency(docData.totalAmount)}/-`, { x: 212, y: p9H - 212, size: 10, font: fontBold });
  whiteOut(p9, 375, p9H - 215, 150, 16);
  p9.drawText(numberToWordsINR(docData.totalAmount), { x: 377, y: p9H - 212, size: 8.5, font: fontBold });

  // Draw payment rows if provided
  let tableY = p9H - 315;
  const rows = paymentRecords.length > 0 ? paymentRecords.slice(0, 5) : [
    {
      amount: docData.totalAmount,
      mode: 'RTGS',
      refNo: 'BANK CLEARANCE',
      date: docData.todayDate || new Date(),
      bankName: 'Nationalized Bank',
      branchName: 'Ahmedabad',
    },
  ];

  for (const r of rows) {
    p9.drawText(`Rs. ${formatCurrency(r.amount)}`, { x: 105, y: tableY, size: 9, font: fontBold });
    p9.drawText(r.refNo || r.mode.toUpperCase(), { x: 185, y: tableY, size: 8.5, font: fontRegular });
    p9.drawText(formatDate(r.date), { x: 275, y: tableY, size: 8.5, font: fontRegular });
    p9.drawText(r.bankName || 'HDFC Bank', { x: 360, y: tableY, size: 8.5, font: fontRegular });
    p9.drawText(r.branchName || 'Ahmedabad', { x: 475, y: tableY, size: 8.5, font: fontRegular });
    tableY -= 20;
  }

  // ── Page 17: Property Schedule, Boundaries & Execution ────────────────
  const p17 = pdfDoc.getPage(16);
  const p17H = p17.getHeight();
  whiteOut(p17, 280, p17H - 170, 70, 16);
  p17.drawText(docData.unitNumber || 'A-402', { x: 282, y: p17H - 167, size: 10, font: fontBold });
  whiteOut(p17, 280, p17H - 194, 60, 16);
  p17.drawText(docData.floorName || '4th', { x: 282, y: p17H - 191, size: 10, font: fontBold });
  whiteOut(p17, 280, p17H - 218, 50, 16);
  p17.drawText(`${landShareSqmt}`, { x: 282, y: p17H - 215, size: 10, font: fontBold });
  whiteOut(p17, 280, p17H - 242, 50, 16);
  p17.drawText(`${carpetSqmt}`, { x: 282, y: p17H - 239, size: 10, font: fontBold });
  whiteOut(p17, 280, p17H - 266, 50, 16);
  p17.drawText(`${balconySqmt + washSqmt}`, { x: 282, y: p17H - 263, size: 10, font: fontBold });
  whiteOut(p17, 280, p17H - 290, 50, 16);
  p17.drawText(`${totalAreaSqmt}`, { x: 282, y: p17H - 287, size: 10, font: fontBold });
  whiteOut(p17, 280, p17H - 314, 50, 16);
  p17.drawText(`${terraceSqmt}`, { x: 282, y: p17H - 311, size: 10, font: fontBold });

  // Boundaries
  const b = docData.boundaries || { east: 'Internal Road', west: 'Adjacent Flat', north: 'Open Space', south: 'Common Corridor' };
  whiteOut(p17, 220, p17H - 362, 70, 14);
  p17.drawText(b.east || 'Internal Road', { x: 222, y: p17H - 360, size: 9, font: fontRegular });
  whiteOut(p17, 220, p17H - 386, 70, 14);
  p17.drawText(b.west || 'Adjacent Flat', { x: 222, y: p17H - 384, size: 9, font: fontRegular });
  whiteOut(p17, 220, p17H - 410, 70, 14);
  p17.drawText(b.north || 'Open Space', { x: 222, y: p17H - 408, size: 9, font: fontRegular });
  whiteOut(p17, 220, p17H - 434, 70, 14);
  p17.drawText(b.south || 'Common Corridor', { x: 222, y: p17H - 432, size: 9, font: fontRegular });

  // Execution Date
  const today = new Date();
  whiteOut(p17, 225, p17H - 755, 30, 16);
  p17.drawText(String(today.getDate()), { x: 227, y: p17H - 752, size: 10, font: fontBold });
  whiteOut(p17, 300, p17H - 755, 75, 16);
  p17.drawText(today.toLocaleString('en-US', { month: 'long' }), { x: 302, y: p17H - 752, size: 9.5, font: fontBold });

  // Purchaser signature
  whiteOut(p17, 230, p17H - 945, 200, 16);
  p17.drawText(`( ${docData.customerName.toUpperCase()} )`, { x: 232, y: p17H - 942, size: 9.5, font: fontBold });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  fs.writeFileSync(filePath, buffer);

  return { filePath, relativeUrl, buffer };
}
