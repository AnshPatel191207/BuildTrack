import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import * as XLSX from 'xlsx';
import {
  startTestEnv,
  stopTestEnv,
  registerAndLogin,
  createCompanyViaApi,
  addTeamMember,
  authHeader,
} from './helpers';

let app: any;
const skip = process.env.SKIP_DB_TESTS === '1';

beforeAll(async () => {
  if (!skip) app = await startTestEnv();
});

afterAll(async () => {
  if (!skip) await stopTestEnv();
});

describe.skipIf(skip)('Property ERP End-to-End Test Suite', () => {
  let ownerToken: string;
  let clientToken: string;
  let projectId: string;
  let towerId: string;
  let floorId: string;
  let flatId: string;
  let shopId: string;
  let customerId: string;
  let bookingId: string;
  let paymentId: string;

  beforeAll(async () => {
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);

    // Create worker user to test RBAC security
    const worker = await addTeamMember(app, ownerToken, 'worker');
    clientToken = worker.token;
  });

  // ── 1. Property Projects & Hierarchy ──────────────────────────────
  describe('Property Project & Hierarchy Management', () => {
    it('creates a new Property Project', async () => {
      const res = await request(app)
        .post('/api/property/projects')
        .set(authHeader(ownerToken))
        .send({
          name: 'Shivalik Skyview',
          location: 'SG Highway, Ahmedabad',
          address: 'Opp. ISKCON Temple, SG Highway',
          builderName: 'Shivalik Group',
          reraNumber: 'PR/GJ/AHMEDABAD/12345/2026',
          projectType: 'residential',
          startDate: '2026-03-01',
          budget: 250000000,
          description: 'Luxury high-rise residential towers and retail promenade',
          totalTowers: 2,
          totalUnits: 120,
          amenities: ['Clubhouse', 'Gym', 'Swimming Pool', 'EV Charging'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.name).toBe('Shivalik Skyview');
      projectId = res.body.data._id;
    });

    it('creates a Tower under the Project', async () => {
      const res = await request(app)
        .post(`/api/property/projects/${projectId}/towers`)
        .set(authHeader(ownerToken))
        .send({
          projectId,
          name: 'Tower A - Aster',
          towerNumber: 'A',
          totalFloors: 14,
          description: 'Main residential wing',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.name).toBe('Tower A - Aster');
      towerId = res.body.data._id;
    });

    it('creates a Floor under the Tower', async () => {
      const res = await request(app)
        .post(`/api/property/towers/${towerId}/floors`)
        .set(authHeader(ownerToken))
        .send({
          projectId,
          towerId,
          name: '4th Floor',
          order: 4,
          description: 'Fourth floor residential flats',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.name).toBe('4th Floor');
      floorId = res.body.data._id;
    });

    it('creates a Flat with full specifications', async () => {
      const res = await request(app)
        .post('/api/property/flats')
        .set(authHeader(ownerToken))
        .send({
          projectId,
          towerId,
          floorId,
          unitNumber: 'A-402',
          unitType: '3BHK',
          areaSqft: 1850,
          carpetAreaSqft: 1420,
          builtUpAreaSqft: 1850,
          bedrooms: 3,
          bathrooms: 3,
          balconies: 2,
          floorNumber: 4,
          facing: 'East',
          ratePerSqft: 5500,
          parkingSlot: 'B1-22',
          parkingCharges: 250000,
          clubhouseCharges: 150000,
          gstPercentage: 5,
          basePrice: 10175000,
          totalValue: 10575000,
          status: 'available',
          notes: 'Premium garden facing unit',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.unitNumber).toBe('A-402');
      expect(res.body.data.totalValue).toBe(10575000);
      flatId = res.body.data._id;
    });

    it('creates a Commercial Shop', async () => {
      const res = await request(app)
        .post('/api/property/shops')
        .set(authHeader(ownerToken))
        .send({
          projectId,
          towerId,
          floorId,
          unitNumber: 'SHOP-05',
          unitType: 'Shop',
          areaSqft: 650,
          carpetAreaSqft: 520,
          ratePerSqft: 12000,
          totalValue: 7800000,
          status: 'available',
          facing: 'Main Road',
          notes: 'Promenade front shop with high footfall',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.unitNumber).toBe('SHOP-05');
      shopId = res.body.data._id;
    });

    it('lists Flats and Shops filtered by project', async () => {
      const flatsRes = await request(app)
        .get(`/api/property/flats?projectId=${projectId}`)
        .set(authHeader(ownerToken));
      expect(flatsRes.status).toBe(200);
      expect(flatsRes.body.data.length).toBeGreaterThanOrEqual(1);

      const shopsRes = await request(app)
        .get(`/api/property/shops?projectId=${projectId}`)
        .set(authHeader(ownerToken));
      expect(shopsRes.status).toBe(200);
      expect(shopsRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 2. Customer 360° Profile ───────────────────────────────────────
  describe('Customer 360° Profile', () => {
    it('creates a property customer and retrieves 360 profile', async () => {
      const custRes = await request(app)
        .post('/api/customers')
        .set(authHeader(ownerToken))
        .send({
          projectId,
          name: 'Rajeshbhai Patel',
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: `rajesh${Math.random().toString(36).slice(2)}@gmail.com`,
          address: '45, Suryam Bunglows, Bodakdev',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pan: 'ABCDE1234F',
          leadSource: 'walk_in',
          status: 'hot',
          stage: 'booking',
        });

      expect(custRes.status).toBe(201);
      customerId = custRes.body.data._id;

      const profileRes = await request(app)
        .get(`/api/property/customers/${customerId}/profile`)
        .set(authHeader(ownerToken));

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.data.customer._id).toBe(customerId);
      expect(profileRes.body.data.metrics).toBeDefined();
      expect(profileRes.body.data.metrics.totalBookings).toBe(0);
      expect(profileRes.body.data.metrics.totalBookedValue).toBe(0);
      expect(profileRes.body.data.bookings).toEqual([]);
      expect(profileRes.body.data.payments).toEqual([]);
    });
  });

  // ── 3. Bookings & Installments ─────────────────────────────────────
  describe('Property Bookings & Installment Schedules', () => {
    it('creates a Booking for unit A-402 with custom installment schedule', async () => {
      const bookRes = await request(app)
        .post('/api/bookings')
        .set(authHeader(ownerToken))
        .send({
          projectId,
          customerId,
          unitId: flatId,
          bookingDate: '2026-03-10',
          bookingAmount: 525000,
          notes: 'Customer opted for construction-linked payment plan',
        });

      expect(bookRes.status).toBe(201);
      expect(bookRes.body.success).toBe(true);
      bookingId = bookRes.body.data._id;
      expect(bookingId).toBeDefined();

      // Confirm booking to transition unit from reserved to booked
      const actionRes = await request(app)
        .post(`/api/bookings/${bookingId}/actions`)
        .set(authHeader(ownerToken))
        .send({ action: 'confirm' });
      expect(actionRes.status).toBe(200);

      // Check unit status transitioned to booked
      const unitCheck = await request(app)
        .get(`/api/units/${flatId}`)
        .set(authHeader(ownerToken));
      expect(unitCheck.status).toBe(200);
      expect(unitCheck.body.data.status).toBe('booked');
    });
  });

  // ── 4. Payments & Auto Receipt Generation ──────────────────────────
  describe('Payments & Auto Receipt Generation (RCP-YYYY-000001 & QR)', () => {
    it('records a payment and generates an official numbered receipt with QR', async () => {
      const payRes = await request(app)
        .post('/api/payments')
        .set(authHeader(ownerToken))
        .send({
          projectId,
          customerId,
          bookingId,
          amount: 525000,
          paymentType: 'booking_amount',
          paidDate: '2026-03-12',
          dueDate: '2026-03-12',
          method: 'cheque',
          reference: 'CHQ-889102',
          notes: 'Token advance installment paid via cheque',
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.success).toBe(true);
      paymentId = payRes.body.data._id;
      expect(paymentId).toBeDefined();

      // Generate receipt
      const receiptRes = await request(app)
        .post(`/api/property/payments/${paymentId}/receipt`)
        .set(authHeader(ownerToken));

      expect(receiptRes.status).toBe(201);
      expect(receiptRes.body.success).toBe(true);
      expect(receiptRes.body.data.receiptNumber).toMatch(/^RCP-\d{4}-\d{6}$/);
      expect(receiptRes.body.data.verificationQrCode).toBeDefined();
      expect(receiptRes.body.data.amountInWords).toBeDefined();
    });
  });

  // ── 5. Banakhat & Dastavej Legal Document Generation ───────────────
  describe('Banakhat & Dastavej Legal Document Generation', () => {
    it('generates Banakhat (Agreement for Sale) with template variable substitution', async () => {
      const banakhatRes = await request(app)
        .post(`/api/property/bookings/${bookingId}/banakhat`)
        .set(authHeader(ownerToken))
        .send({
          title: 'Agreement for Sale (Banakhat) - Rajeshbhai Patel',
          notes: 'Standard RERA compliant Banakhat generated',
        });

      expect(banakhatRes.status).toBe(201);
      expect(banakhatRes.body.success).toBe(true);
      expect(banakhatRes.body.data.renderedContent).toBeDefined();
      expect(banakhatRes.body.data.documentNumber).toBeDefined();

      const docHtml = banakhatRes.body.data.renderedContent;
      // Ensure key variables were replaced
      expect(docHtml).toContain('Rajeshbhai Patel');
      expect(docHtml).toContain('A-402');
      expect(docHtml).not.toContain('{{customer_name}}');
      expect(docHtml).not.toContain('{{flat_number}}');
    });

    it('generates Dastavej (Sale Deed) with template variable substitution', async () => {
      const dastavejRes = await request(app)
        .post(`/api/property/bookings/${bookingId}/dastavej`)
        .set(authHeader(ownerToken))
        .send({
          title: 'Final Conveyance Deed (Dastavej) - Rajeshbhai Patel',
          notes: 'Sub-registrar ready Dastavej document',
        });

      expect(dastavejRes.status).toBe(201);
      expect(dastavejRes.body.success).toBe(true);
      expect(dastavejRes.body.data.renderedContent).toBeDefined();

      const docHtml = dastavejRes.body.data.renderedContent;
      expect(docHtml).toContain('Rajeshbhai Patel');
      expect(docHtml).toContain('A-402');
      expect(docHtml).not.toContain('{{customer_name}}');
    });

    it('verifies Customer 360 profile now contains the booking, payment, and generated documents', async () => {
      const profileRes = await request(app)
        .get(`/api/property/customers/${customerId}/profile`)
        .set(authHeader(ownerToken));

      expect(profileRes.status).toBe(200);
      const { data } = profileRes.body;
      expect(data.metrics.totalBookings).toBe(1);
      expect(data.metrics.totalBookedValue).toBeGreaterThan(0);
      expect(data.metrics.totalPaid).toBe(525000);
      expect(data.bookings.length).toBe(1);
      expect(data.payments.length).toBe(1);
      expect(data.documents.length).toBeGreaterThanOrEqual(2); // Banakhat + Dastavej
    });
  });

  // ── 6. Property Dashboard & Reports ────────────────────────────────
  describe('Property Dashboard & Analytics Reports', () => {
    it('returns executive dashboard statistics', async () => {
      const dashRes = await request(app)
        .get('/api/property/dashboard')
        .set(authHeader(ownerToken));

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.success).toBe(true);
      expect(dashRes.body.data.inventory.totalUnits).toBeGreaterThanOrEqual(1);
      expect(dashRes.body.data.inventory.bookedUnits).toBeGreaterThanOrEqual(1);
      expect(dashRes.body.data.collections.today).toBeGreaterThanOrEqual(0);
    });

    it('generates property reports with inventory breakdown and status metrics', async () => {
      const reportRes = await request(app)
        .get(`/api/property/reports?projectId=${projectId}`)
        .set(authHeader(ownerToken));

      expect(reportRes.status).toBe(200);
      expect(reportRes.body.success).toBe(true);
      expect(reportRes.body.data.reportType).toBe('inventory');
      expect(reportRes.body.data.totals.totalUnits).toBeGreaterThanOrEqual(1);
      expect(reportRes.body.data.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('exports property reports to PDF and Excel via /api/property/reports/export', async () => {
      const pdfRes = await request(app)
        .get(`/api/property/reports/export?projectId=${projectId}&reportType=inventory&format=pdf`)
        .set(authHeader(ownerToken));
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.header['content-type']).toContain('application/pdf');

      const excelRes = await request(app)
        .get(`/api/property/reports/export?projectId=${projectId}&reportType=inventory&format=excel`)
        .set(authHeader(ownerToken));
      expect(excelRes.status).toBe(200);
      expect(excelRes.header['content-type']).toContain('spreadsheetml.sheet');
    });

    it('lists property customers, bookings, payments, and documents via /api/property endpoints', async () => {
      const custRes = await request(app)
        .get('/api/property/customers')
        .set(authHeader(ownerToken));
      expect(custRes.status).toBe(200);
      expect(custRes.body.data.length).toBeGreaterThanOrEqual(1);

      const bookRes = await request(app)
        .get('/api/property/bookings')
        .set(authHeader(ownerToken));
      expect(bookRes.status).toBe(200);
      expect(bookRes.body.data.length).toBeGreaterThanOrEqual(1);

      const payRes = await request(app)
        .get('/api/property/payments')
        .set(authHeader(ownerToken));
      expect(payRes.status).toBe(200);
      expect(payRes.body.data.length).toBeGreaterThanOrEqual(1);

      const docRes = await request(app)
        .get('/api/property/documents')
        .set(authHeader(ownerToken));
      expect(docRes.status).toBe(200);
      expect(docRes.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('streams PDF receipt via /api/property/documents/receipts/:paymentId/pdf', async () => {
      const receiptPdfRes = await request(app)
        .get(`/api/property/documents/receipts/${paymentId}/pdf`)
        .set(authHeader(ownerToken));
      expect(receiptPdfRes.status).toBe(200);
      expect(receiptPdfRes.header['content-type']).toContain('application/pdf');
    });
  });

  // ── 7. Excel Bulk Import ───────────────────────────────────────────
  describe('Excel Bulk Inventory Import', () => {
    it('downloads the official sample Excel template', async () => {
      const tplRes = await request(app)
        .get('/api/property/import/template')
        .set(authHeader(ownerToken));

      expect(tplRes.status).toBe(200);
      expect(tplRes.header['content-type']).toContain('spreadsheetml.sheet');
    });

    it('previews an Excel file upload and executes bulk import', async () => {
      // Create an in-memory workbook
      const rows = [
        {
          Project: 'Shivalik Skyview',
          Tower: 'Tower B - Bloom',
          Floor: '1st Floor',
          'Unit Number': 'B-101',
          'Unit Type': '2BHK',
          Category: 'flat',
          Area: 1250,
          'Carpet Area': 980,
          'BuiltUp Area': 1250,
          Rate: 5000,
          Price: 6250000,
          Status: 'available',
          Facing: 'North',
          Bedrooms: 2,
        },
        {
          Project: 'Shivalik Skyview',
          Tower: 'Tower B - Bloom',
          Floor: '1st Floor',
          'Unit Number': 'B-102',
          'Unit Type': '2BHK',
          Category: 'flat',
          Area: 1250,
          'Carpet Area': 980,
          'BuiltUp Area': 1250,
          Rate: 5000,
          Price: 6250000,
          Status: 'available',
          Facing: 'North-East',
          Bedrooms: 2,
        },
      ];

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // 1. Preview Excel Import
      const previewRes = await request(app)
        .post('/api/property/import/preview')
        .set(authHeader(ownerToken))
        .attach('file', excelBuffer, 'bulk_units.xlsx');

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      expect(previewRes.body.data.totalRows).toBe(2);
      expect(previewRes.body.data.validCount).toBe(2);
      expect(previewRes.body.data.errorCount).toBe(0);

      // 2. Execute Bulk Import
      const execRes = await request(app)
        .post('/api/property/import/execute')
        .set(authHeader(ownerToken))
        .send({
          validRows: previewRes.body.data.validRows,
        });

      expect(execRes.status).toBe(201);
      expect(execRes.body.success).toBe(true);
      expect(execRes.body.data.insertedUnits).toBe(2);

      // 3. Verify newly imported units exist in database
      const flatsRes = await request(app)
        .get(`/api/property/flats?projectId=${projectId}`)
        .set(authHeader(ownerToken));

      expect(flatsRes.status).toBe(200);
      const unitNumbers = flatsRes.body.data.map((u: any) => u.unitNumber);
      expect(unitNumbers).toContain('B-101');
      expect(unitNumbers).toContain('B-102');
    });
  });

  // ── 8. RBAC Security & Boundary Enforcement ────────────────────────
  describe('RBAC Security & Permission Boundaries', () => {
    it('forbids client user from creating flats', async () => {
      const res = await request(app)
        .post('/api/property/flats')
        .set(authHeader(clientToken))
        .send({
          projectId,
          unitNumber: 'HACK-101',
          unitType: '1BHK',
          areaSqft: 500,
          totalValue: 2000000,
        });

      expect(res.status).toBe(403);
    });

    it('forbids client user from generating Banakhat or Dastavej documents', async () => {
      const res = await request(app)
        .post(`/api/property/bookings/${bookingId}/banakhat`)
        .set(authHeader(clientToken))
        .send({ title: 'Unauthorized Banakhat' });

      expect(res.status).toBe(403);
    });

    it('forbids client user from executing bulk imports', async () => {
      const res = await request(app)
        .post('/api/property/import/execute')
        .set(authHeader(clientToken))
        .send({ validRows: [] });

      expect(res.status).toBe(403);
    });
  });
});
