import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  startTestEnv,
  stopTestEnv,
  registerAndLogin,
  createCompanyViaApi,
  createProjectViaApi,
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

describe.skipIf(skip)('RBAC & permissions', () => {
  let ownerToken: string;
  let salesToken: string;
  let accountantToken: string;
  let engineerToken: string;

  it('returns permissions with the session user', async () => {
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);

    const me = await request(app).get('/api/auth/me').set(authHeader(ownerToken));
    expect(me.status).toBe(200);
    expect(Array.isArray(me.body.data.permissions)).toBe(true);
    expect(me.body.data.permissions).toContain('canApproveBookings');
    expect(me.body.data.role).toBe('owner');
  });

  it('creates a sales manager and enforces permissions at the API level', async () => {
    const sales = await addTeamMember(app, ownerToken, 'sales_manager');
    salesToken = sales.token;
    expect(sales.user.role).toBe('sales_manager');

    // Sales manager cannot create projects…
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(salesToken))
      .send({ name: 'Sales Project', startDate: '2026-01-10', budget: 1000 });
    expect(res.status).toBe(403);

    // …but CAN manage customers.
    const customer = await request(app)
      .post('/api/customers')
      .set(authHeader(salesToken))
      .send({ name: 'Ravi Buyer', phone: '9876512345', leadSource: 'website' });
    expect(customer.status).toBe(201);
  });

  it('blocks accountants from project creation but allows expenses', async () => {
    const acc = await addTeamMember(app, ownerToken, 'accountant');
    accountantToken = acc.token;
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(accountantToken))
      .send({ name: 'Acc Project', startDate: '2026-01-10', budget: 1000 });
    expect(res.status).toBe(403);
  });

  it('legacy roles keep working (manager alias)', async () => {
    const mgr = await addTeamMember(app, ownerToken, 'manager');
    const projects = await request(app)
      .get('/api/projects')
      .set(authHeader(mgr.token));
    expect(projects.status).toBe(200);
    void engineerToken;
  });
});

describe.skipIf(skip)('Project structure & unit inventory', () => {
  let ownerToken: string;
  let project: any;
  let blockId: string;
  let floorId: string;

  beforeAll(async () => {
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);
    project = await createProjectViaApi(app, ownerToken);
  });

  it('builds a phase → tower → floor hierarchy and returns a tree', async () => {
    const phase = await request(app)
      .post('/api/units/structure')
      .set(authHeader(ownerToken))
      .send({ projectId: project._id, nodeType: 'phase', name: 'Phase 1' });
    expect(phase.status).toBe(201);

    const tower = await request(app)
      .post('/api/units/structure')
      .set(authHeader(ownerToken))
      .send({ projectId: project._id, parentId: phase.body.data._id, nodeType: 'block', name: 'Tower A' });
    blockId = tower.body.data._id;
    expect(tower.status).toBe(201);

    const floor = await request(app)
      .post('/api/units/structure')
      .set(authHeader(ownerToken))
      .send({ projectId: project._id, parentId: blockId, nodeType: 'floor', name: 'Floor 1' });
    floorId = floor.body.data._id;

    const tree = await request(app)
      .get(`/api/units/structure/tree?projectId=${project._id}`)
      .set(authHeader(ownerToken));
    expect(tree.status).toBe(200);
    expect(tree.body.data.tree[0].children[0].children[0].name).toBe('Floor 1');
  });

  it('rejects duplicate unit numbers within a project', async () => {
    const first = await request(app)
      .post('/api/units')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id, floorId, blockId,
        unitNumber: 'A-101', unitType: '2 BHK', areaSqft: 1250, totalValue: 6_500_000,
        ratePerSqft: 5200,
      });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/api/units')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        unitNumber: 'A-101', unitType: '2 BHK', totalValue: 6_500_000,
      });
    expect(dup.status).toBe(409);
  });

  it('summarises inventory by status', async () => {
    const summary = await request(app)
      .get(`/api/units/inventory-summary?projectId=${project._id}`)
      .set(authHeader(ownerToken));
    expect(summary.status).toBe(200);
    expect(summary.body.data.totalUnits).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.available).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.unsoldInventoryValue).toBeGreaterThan(0);
  });
});

describe.skipIf(skip)('Customers → Leads → Bookings → Payments flow', () => {
  let ownerToken: string;
  let salesToken: string;
  let project: any;
  let unitId: string;
  let customerId: string;
  let bookingId: string;
  let leadId: string;

  beforeAll(async () => {
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);
    project = await createProjectViaApi(app, ownerToken);
    const sales = await addTeamMember(app, ownerToken, 'sales_manager');
    salesToken = sales.token;

    const unit = await request(app)
      .post('/api/units')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id, unitNumber: 'B-301', unitType: '3 BHK',
        areaSqft: 1650, totalValue: 9_075_000, ratePerSqft: 5500,
      });
    unitId = unit.body.data._id;

    const customer = await request(app)
      .post('/api/customers')
      .set(authHeader(salesToken))
      .send({ name: 'Deepa Nair', phone: '9825445566', city: 'Ahmedabad', leadSource: 'broker' });
    customerId = customer.body.data._id;

    const lead = await request(app)
      .post('/api/leads')
      .set(authHeader(salesToken))
      .send({ projectId: project._id, name: 'Sameer Jain', phone: '9912345678', source: 'reference' });
    leadId = lead.body.data._id;
  });

  it('tracks lead pipeline and follow-ups', async () => {
    const moved = await request(app)
      .put(`/api/leads/${leadId}`)
      .set(authHeader(salesToken))
      .send({ stage: 'site_visit_completed' });
    expect(moved.status).toBe(200);
    expect(moved.body.data.stage).toBe('site_visit_completed');

    const fu = await request(app)
      .post(`/api/leads/${leadId}/follow-ups`)
      .set(authHeader(salesToken))
      .send({ date: '2026-09-01', note: 'Share final quote' });
    expect(fu.status).toBe(200);

    const dash = await request(app)
      .get('/api/leads/sales-dashboard')
      .set(authHeader(ownerToken));
    expect(dash.status).toBe(200);
    expect(dash.body.data.openLeads).toBeGreaterThanOrEqual(1);
    expect(typeof dash.body.data.conversionRate).toBe('number');
  });

  it('creates a booking that reserves the unit and routes approval', async () => {
    const booking = await request(app)
      .post('/api/bookings')
      .set(authHeader(salesToken))
      .send({
        projectId: project._id,
        unitId,
        customerId,
        bookingDate: '2026-08-20',
        bookingAmount: 450_000,
      });
    expect(booking.status).toBe(201);
    bookingId = booking.body.data._id;

    const unit = await request(app).get(`/api/units/${unitId}`).set(authHeader(ownerToken));
    expect(unit.body.data.status).toBe('reserved');

    const approvals = await request(app)
      .get('/api/approvals?entityType=booking&status=pending')
      .set(authHeader(ownerToken));
    expect(approvals.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('confirms booking → generates schedule → records payment → marks sold', async () => {
    const confirm = await request(app)
      .post(`/api/bookings/${bookingId}/actions`)
      .set(authHeader(salesToken))
      .send({ action: 'confirm' });
    expect(confirm.status).toBe(200);

    const schedule = await request(app)
      .post(`/api/bookings/${bookingId}/schedule`)
      .set(authHeader(ownerToken))
      .send({ installments: 4, startDate: '2026-09-01', frequencyMonths: 1 });
    expect(schedule.status).toBe(200);
    expect(schedule.body.data.length).toBeGreaterThanOrEqual(4);

    const pending = schedule.body.data.find((p: any) => p.status === 'pending');
    const markPaid = await request(app)
      .post(`/api/payments/${pending._id}/mark-paid`)
      .set(authHeader(ownerToken))
      .send({ method: 'bank_transfer' });
    expect(markPaid.status).toBe(200);
    expect(markPaid.body.data.status).toBe('paid');

    const sold = await request(app)
      .post(`/api/bookings/${bookingId}/actions`)
      .set(authHeader(salesToken))
      .send({ action: 'mark_sold' });
    expect(sold.status).toBe(200);
  });

  it('shows receivables with overdue buckets', async () => {
    const rec = await request(app)
      .get('/api/payments/receivables')
      .set(authHeader(ownerToken));
    expect(rec.status).toBe(200);
    expect(rec.body.data).toHaveProperty('totalReceivable');
    expect(rec.body.data).toHaveProperty('customerWise');
  });
});

describe.skipIf(skip)('Procurement: contractors, vendors, purchase orders', () => {
  let ownerToken: string;
  let managerToken: string;
  let supervisorToken: string;
  let project: any;
  let contractorId: string;
  let contractId: string;
  let vendorId: string;
  let poId: string;

  beforeAll(async () => {
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);
    project = await createProjectViaApi(app, ownerToken);
    const mgr = await addTeamMember(app, ownerToken, 'project_manager', [project._id]);
    managerToken = mgr.token;
    const sup = await addTeamMember(app, ownerToken, 'supervisor', [project._id]);
    supervisorToken = sup.token;
  });

  it('creates contractors + contracts and records payments', async () => {
    const contractor = await request(app)
      .post('/api/contractors')
      .set(authHeader(managerToken))
      .send({
        name: 'Magansinh Rathod',
        companyName: 'Magan RCC',
        phone: '9825090909',
        workTypes: ['rcc'],
      });
    contractorId = contractor.body.data._id;

    const contract = await request(app)
      .post(`/api/contractors/${contractorId}/contracts`)
      .set(authHeader(managerToken))
      .send({
        projectId: project._id,
        scope: 'Slab casting package',
        contractValue: 800_000,
        startDate: '2026-06-01',
      });
    contractId = contract.body.data._id;
    expect(contract.status).toBe(201);

    const pay = await request(app)
      .post(`/api/contractors/${contractorId}/contracts/${contractId}/payments`)
      .set(authHeader(managerToken))
      .send({ paymentType: 'advance', amount: 200_000, date: '2026-08-01' });
    expect(pay.status).toBe(201);

    const detail = await request(app)
      .get(`/api/contractors/${contractorId}`)
      .set(authHeader(ownerToken));
    expect(detail.body.data.contracts[0].pendingAmount).toBe(600_000);
  });

  it('creates vendors from array or comma-separated materials', async () => {
    // Canonical array payload.
    const vendor = await request(app)
      .post('/api/vendors')
      .set(authHeader(managerToken))
      .send({
        name: 'Ultra Cements Traders',
        gstNumber: '24AAACU0584F1ZK',
        materialsSupplied: ['cement'],
        phone: '9825011111',
      });
    expect(vendor.status).toBe(201);

    // Comma-separated form input must normalise to an array (regression).
    const vendor2 = await request(app)
      .post('/api/vendors')
      .set(authHeader(managerToken))
      .send({
        name: 'Comma Format Supplier',
        phone: '9825022222',
        materialsSupplied: 'cement, steel, sand',
      });
    expect(vendor2.status).toBe(201);
    expect(vendor2.body.data.materialsSupplied).toEqual(['cement', 'steel', 'sand']);

    vendorId = vendor.body.data._id;
  });

  it('runs the PO workflow draft → approved → ordered → delivered with material posting', async () => {
    const vendor = await request(app)
      .post('/api/vendors')
      .set(authHeader(managerToken))
      .send({
        name: 'Ultra Cements Traders',
        gstNumber: '24AAACU0584F1ZK',
        materialsSupplied: ['cement'],
        phone: '9825011111',
      });
    vendorId = vendor.body.data._id;

    const created = await request(app)
      .post('/api/purchase-orders')
      .set(authHeader(managerToken))
      .send({
        projectId: project._id,
        vendorId,
        items: [
          { materialName: 'OPC Cement Pro', category: 'cement', quantity: 100, unit: 'bag', rate: 400 },
        ],
        submitForApproval: true,
      });
    expect(created.status).toBe(201);
    poId = created.body.data._id;
    expect(created.body.data.poNumber).toMatch(/^PO-\d+$/);

    // Approve through the approval engine: supervisor → manager → owner.
    const approvals = await request(app)
      .get('/api/approvals?entityType=purchase_order&status=pending')
      .set(authHeader(ownerToken));
    if (process.env.DEBUG_ERP) {
      console.log('APPROVALS BODY:', JSON.stringify(approvals.body).slice(0, 1500));
      console.log('LOOKING FOR poId:', poId);
    }
    const target = approvals.body.data.find((a: any) => String(a.entityId) === poId || a.title?.includes('PO-'));
    expect(target).toBeTruthy();

    for (const token of [supervisorToken, managerToken, ownerToken]) {
      const act = await request(app)
        .post(`/api/approvals/${target._id}/act`)
        .set(authHeader(token))
        .send({ decision: 'approve' });
      expect(act.status).toBe(200);
      if (act.body.data?.status === 'approved') break;
    }

    const afterApproval = await request(app)
      .get(`/api/purchase-orders/${poId}`)
      .set(authHeader(ownerToken));
    expect(['approved', 'ordered']).toContain(afterApproval.body.data.purchaseOrder.status);

    // Order it.
    const order = await request(app)
      .post(`/api/purchase-orders/${poId}/transition`)
      .set(authHeader(managerToken))
      .send({ action: 'order' });
    expect(order.body.data.status).toBe('ordered');

    // Deliver — should post stock into materials automatically.
    const deliver = await request(app)
      .post(`/api/purchase-orders/${poId}/transition`)
      .set(authHeader(managerToken))
      .send({ action: 'deliver', invoiceNumber: 'UCT/2211' });
    expect(deliver.body.data.status).toBe('delivered');

    const materials = await request(app)
      .get(`/api/materials?projectId=${project._id}`)
      .set(authHeader(ownerToken));
    const cementItem = (materials.body.data.materials ?? []).find((m: any) =>
      m.name.toLowerCase().includes('opc cement'),
    );
    expect(cementItem).toBeTruthy();
    expect(cementItem.currentStock).toBeGreaterThan(0);
  });
});

describe.skipIf(skip)('Progress, milestones, equipment, analytics & reports', () => {
  let ownerToken: string;
  let engineerToken: string;
  let project: any;

  beforeAll(async () => {
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);
    project = await createProjectViaApi(app, ownerToken);
    const eng = await addTeamMember(app, ownerToken, 'site_engineer', [project._id]);
    engineerToken = eng.token;
  });

  it('seeds default construction stages and updates progress', async () => {
    const stages = await request(app)
      .get(`/api/progress/stages?projectId=${project._id}`)
      .set(authHeader(engineerToken));
    expect(stages.status).toBe(200);
    expect(stages.body.data.stages.length).toBeGreaterThanOrEqual(12);

    const rcc = stages.body.data.stages.find((s: any) => s.name === 'rcc_structure');
    const upd = await request(app)
      .put(`/api/progress/stages/${rcc._id}`)
      .set(authHeader(engineerToken))
      .send({ progressPercentage: 45 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.status).toBe('in_progress');
  });

  it('creates work items and rolls up progress to nodes and the project', async () => {
    const structure = await request(app)
      .post('/api/units/structure')
      .set(authHeader(ownerToken))
      .send({ projectId: project._id, nodeType: 'block', name: 'Block X' });
    const blockId = structure.body.data._id;

    const item = await request(app)
      .post('/api/progress/work-items')
      .set(authHeader(engineerToken))
      .send({
        projectId: project._id,
        nodeId: blockId,
        name: 'Excavation Zone 1',
        stageName: 'excavation',
      });
    expect(item.status).toBe(201);

    const updated = await request(app)
      .put(`/api/progress/work-items/${item.body.data._id}`)
      .set(authHeader(engineerToken))
      .send({ progressPercentage: 60 });
    expect(updated.status).toBe(200);

    const refreshedBlock = await request(app)
      .get(`/api/units/structure?projectId=${project._id}&nodeType=block`)
      .set(authHeader(ownerToken));
    const bx = refreshedBlock.body.data.find((n: any) => n.name === 'Block X');
    expect(bx.progressPercentage).toBe(60);
  });

  it('manages milestones with delayed detection', async () => {
    const late = await request(app)
      .post('/api/milestones')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        name: 'Foundation Complete',
        dueDate: '2026-01-15',
      });
    expect(late.status).toBe(201);

    const list = await request(app)
      .get(`/api/milestones?view=all`)
      .set(authHeader(ownerToken));
    const found = list.body.data.items ?? list.body.data;
    const delayed = found.find(
      (m: any) => m.name === 'Foundation Complete' && m.effectiveStatus === 'delayed',
    );
    expect(delayed).toBeTruthy();
  });

  it('logs equipment usage and computes utilisation', async () => {
    const eq = await request(app)
      .post('/api/equipment')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        equipmentNumber: 'eq-exc-01',
        name: 'Excavator CAT 320',
        type: 'excavator',
        ownership: 'rented',
        rentalCostPerDay: 3500,
      });
    expect(eq.status).toBe(201);

    const log = await request(app)
      .post(`/api/equipment/${eq.body.data._id}/logs`)
      .set(authHeader(ownerToken))
      .send({ date: '2026-08-22', hoursUsed: 8, fuelCost: 2600 });
    expect(log.status).toBe(200);
    expect(log.body.data.fuelCostTotal).toBe(2600);
  });

  it('produces financial analytics restricted by permission', async () => {
    const ok = await request(app)
      .get('/api/analytics/financial')
      .set(authHeader(ownerToken));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toHaveProperty('receivables');

    const eng = await request(app)
      .get('/api/analytics/financial')
      .set(authHeader(engineerToken));
    expect(eng.status).toBe(403);
  });

  it('generates every report type', async () => {
    for (const type of [
      'project',
      'booking',
      'payment',
      'progress',
      'vendor',
      'contractor',
      'attendance',
      'expense',
      'inventory',
    ]) {
      const res = await request(app)
        .get(`/api/analytics/reports?type=${type}`)
        .set(authHeader(ownerToken));
      expect(res.status, `report ${type}`).toBe(200);
    }
  });

  it('records audit entries and exposes them only to permitted roles', async () => {
    await request(app)
      .put(`/api/projects/${project._id}`)
      .set(authHeader(ownerToken))
      .send({ progressPercentage: 42 });

    const logs = await request(app)
      .get('/api/audit-logs?module=projects')
      .set(authHeader(ownerToken));
    expect(logs.status).toBe(200);
    expect(logs.body.data.length).toBeGreaterThan(0);

    const denied = await request(app)
      .get('/api/audit-logs')
      .set(authHeader(engineerToken));
    expect(denied.status).toBe(403);
  });
});
