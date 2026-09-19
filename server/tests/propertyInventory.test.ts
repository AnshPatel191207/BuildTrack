import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { generateSampleExcelTemplate, parseAndPreviewExcel } from '../src/services/excelImport.service';

describe('Real Estate Excel Template & Import Exact Columns', () => {
  it('generates the exact 11 columns matching the real estate spreadsheet image', () => {
    const buffer = generateSampleExcelTemplate({ name: 'Santora' });
    expect(buffer).toBeDefined();

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toContain('Sheet1');

    const sheet = workbook.Sheets['Sheet1'];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const expectedHeaders = [
      'Sr.No.',
      'Project Name',
      'Block',
      'Floor',
      'Flat No.',
      'Prop. Plot Area In Sqmt',
      'Unit Built up Area In Sqmt',
      'Rera Carpet Area In Sqmt',
      'Wash & Balcony Area In Sqmt',
      'Open Terrace In Sqmt',
      'Sale deed Amount',
    ];

    expect(rows[0]).toEqual(expectedHeaders);
    expect(rows.length).toBeGreaterThan(5);

    // Verify sample row 1 matches image values
    const firstRow = rows[1];
    expect(firstRow[1]).toBe('Santora'); // Project Name
    expect(firstRow[2]).toBe('A');       // Block
    expect(firstRow[4]).toBe('A-101');   // Flat No.
    expect(firstRow[5]).toBe(25.85);     // Prop. Plot Area In Sqmt
    expect(firstRow[6]).toBe(68.80);     // Unit Built up Area In Sqmt
    expect(firstRow[7]).toBe(60.35);     // Rera Carpet Area In Sqmt
    expect(firstRow[8]).toBe(4.59);      // Wash & Balcony Area In Sqmt
    expect(firstRow[9]).toBe(43.18);     // Open Terrace In Sqmt
    expect(firstRow[10]).toBe(4040000);  // Sale deed Amount
  });

  it('reads the exact user spreadsheet Unsold unit detail.xlsx with all 11 columns', async () => {
    const fs = await import('fs');
    const path = 'C:\\Users\\Ansh\\Downloads\\Unsold unit detail.xlsx';
    if (!fs.existsSync(path)) {
      return; // Skip if environment differs
    }
    const fileBuffer = fs.readFileSync(path);
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    expect(wb.SheetNames.length).toBeGreaterThan(0);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const expectedHeaders = [
      'Sr.No.',
      'Project Name',
      'Block',
      'Floor',
      'Flat No.',
      'Prop. Plot Area In Sqmt',
      'Unit Built up Area In Sqmt',
      'Rera Carpet Area In Sqmt',
      'Wash & Balcony Area In Sqmt',
      'Open Terrace In Sqmt',
      'Sale deed Amount',
    ];

    const normalizedHeaders = rows[0].map((h: any) => String(h).replace(/\s+/g, ' ').trim());
    expect(normalizedHeaders).toEqual(expectedHeaders);
    expect(rows.length).toBeGreaterThan(10);
  });

  it('generates official PDF receipt without QR code dependency', async () => {
    const { generateReceiptPdf } = await import('../src/services/pdfGenerator.service');
    const pdfResult = await generateReceiptPdf({
      receiptNumber: 'RCP-2026-000099',
      paymentDate: new Date(),
      companyName: 'Santora Builders Ltd',
      customerName: 'Kishore Patel',
      customerPhone: '9876543210',
      projectName: 'Santora Heights',
      unitNumber: 'A-101',
      paymentAmount: 500000,
      paymentMode: 'cheque',
    });

    expect(pdfResult.filePath).toBeDefined();
    expect(pdfResult.relativeUrl).toBeDefined();
    expect(pdfResult.buffer).toBeDefined();
    expect(pdfResult.buffer.length).toBeGreaterThan(500);
  });
});
