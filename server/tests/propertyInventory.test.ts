import { describe, it, expect, vi } from 'vitest';
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

  it('preserves 2-pointer decimal float precision (xx.xx) and handles overwriteExisting properly', async () => {
    const { Project } = await import('../src/models/Project');
    const { Unit } = await import('../src/models/Unit');

    const companyId = '507f1f77bcf86cd799439011';
    const projectId = '507f191e810c19729de860ea';

    // Mock Project.find query
    vi.spyOn(Project, 'find').mockReturnValue({
      select: () => ({
        lean: async () => [
          { _id: projectId, name: 'Santora', projectCode: 'SAN' },
        ],
      }),
    } as any);

    // Generate buffer with precise 2-decimal numbers
    const headers = [
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
    const data = [
      headers,
      [1, 'Santora', 'A', 1, 'A-101', 25.85, 68.80, 60.35, 4.59, 43.18, 4040000.50],
      [2, 'Santora', 'A', 1, 'A-102', 26.12, 69.45, 61.20, 5.10, 44.05, 4250000.00],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Test 1: No existing units in DB
    vi.spyOn(Unit, 'find').mockReturnValue({
      select: () => ({
        lean: async () => [],
      }),
    } as any);

    const previewNew = await parseAndPreviewExcel(buf, companyId, {
      defaultProjectId: projectId,
      overwriteExisting: true,
    });

    expect(previewNew.validRows.length).toBe(2);
    expect(previewNew.errors.length).toBe(0);

    const r1 = previewNew.validRows[0];
    // Check exact 2-pointer floats
    expect(r1.plotAreaSqmt).toBe(25.85);
    expect(r1.builtUpAreaSqmt).toBe(68.80);
    expect(r1.carpetAreaSqmt).toBe(60.35);
    expect(r1.balconyAreaSqmt).toBe(4.59);
    expect(r1.terraceAreaSqmt).toBe(43.18);
    expect(r1.saleDeedAmount).toBe(4040000.50);

    // Verify converted sqft values are also preserved as 2-decimal floats
    expect(r1.area).toBe(Number((68.80 * 10.7639).toFixed(2))); // 740.56
    expect(r1.carpetArea).toBe(Number((60.35 * 10.7639).toFixed(2))); // 649.60
    expect(r1.builtUpArea).toBe(Number((68.80 * 10.7639).toFixed(2))); // 740.56

    // Test 2: A-101 already exists in DB
    vi.spyOn(Unit, 'find').mockReturnValue({
      select: () => ({
        lean: async () => [
          { projectId, unitNumber: 'A-101' },
        ],
      }),
    } as any);

    // Case 2A: overwriteExisting = true (Should mark as update and NOT skip/error)
    const previewWithOverwrite = await parseAndPreviewExcel(buf, companyId, {
      defaultProjectId: projectId,
      overwriteExisting: true,
    });

    expect(previewWithOverwrite.validRows.length).toBe(2);
    expect(previewWithOverwrite.updateCount).toBe(1);
    expect(previewWithOverwrite.errors.length).toBe(0);
    const existingRow = previewWithOverwrite.validRows.find((r) => r.unitNumber === 'A-101');
    expect(existingRow?.isExisting).toBe(true);
    expect(existingRow?.isUpdate).toBe(true);

    // Case 2B: overwriteExisting = false (Should report duplicate error)
    const previewWithoutOverwrite = await parseAndPreviewExcel(buf, companyId, {
      defaultProjectId: projectId,
      overwriteExisting: false,
    });

    expect(previewWithoutOverwrite.validRows.length).toBe(1); // Only A-102
    expect(previewWithoutOverwrite.errors.length).toBe(1);
    expect(previewWithoutOverwrite.errors[0].reason).toContain('already exists');
  });
});
