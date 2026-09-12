import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  startTestEnv,
  stopTestEnv,
  registerAndLogin,
  createCompanyViaApi,
  createProjectViaApi,
  authHeader,
  todayString,
} from './helpers';

let app: any;
const skip = process.env.SKIP_DB_TESTS === '1';

beforeAll(async () => {
  if (!skip) app = await startTestEnv();
});
afterAll(async () => {
  if (!skip) await stopTestEnv();
});

describe.skipIf(skip)('Attendance', () => {
  let ownerToken: string;
  let project: any;

  beforeAll(async () => {
    if (skip) return;
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);
    project = await createProjectViaApi(app, ownerToken);
  });

  async function addWorker(name: string) {
    const res = await request(app)
      .post('/api/workers')
      .set(authHeader(ownerToken))
      .send({ name, phone: '9825000011', workerType: 'mason', dailyWage: 800, projectId: project._id });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  it('adds a worker and validates negative wage', async () => {
    const worker = await addWorker('Ramesh Test');
    expect(worker.dailyWage).toBe(800);

    const bad = await request(app)
      .post('/api/workers')
      .set(authHeader(ownerToken))
      .send({ name: 'Bad Wage', dailyWage: -50, projectId: project._id });
    expect(bad.status).toBe(422);
  });

  it('marks attendance via bulk endpoint', async () => {
    const w1 = await addWorker('Worker One');
    const w2 = await addWorker('Worker Two');
    const res = await request(app)
      .post('/api/attendance/bulk')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        date: todayString(),
        entries: [
          { workerId: w1._id, status: 'present', checkIn: '08:00' },
          { workerId: w2._id, status: 'half_day', checkIn: '09:00', checkOut: '13:00' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(2);
  });

  it('prevents duplicate attendance for the same worker/date (unique index)', async () => {
    const w1 = await addWorker('Dup Worker');
    const first = await request(app)
      .post('/api/attendance')
      .set(authHeader(ownerToken))
      .send({ projectId: project._id, date: todayString(), workerId: w1._id, status: 'present' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/attendance')
      .set(authHeader(ownerToken))
      .send({ projectId: project._id, date: todayString(), workerId: w1._id, status: 'absent' });
    // The single-mark route upserts via bulk logic; either way there must be ONE record.
    const list = await request(app)
      .get(`/api/attendance?projectId=${project._id}&date=${todayString()}`)
      .set(authHeader(ownerToken));
    const forWorker = list.body.data.filter((r: any) => r.workerId?._id === w1._id || r.workerId === w1._id);
    expect(forWorker.length).toBe(1);
    expect(second.body.success === true || second.status === 409 || second.status === 200).toBe(true);
  });

  it('rejects invalid time format for check-in', async () => {
    const w = await addWorker('Time Worker');
    const res = await request(app)
      .post('/api/attendance')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        date: todayString(),
        workerId: w._id,
        status: 'present',
        checkIn: '25:99',
      });
    expect(res.status).toBe(422);
  });
});

describe.skipIf(skip)('Materials & stock', () => {
  let ownerToken: string;
  let project: any;
  let material: any;

  beforeAll(async () => {
    if (skip) return;
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);
    project = await createProjectViaApi(app, ownerToken);

    const res = await request(app)
      .post('/api/materials')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        name: 'OPC Cement',
        category: 'cement',
        unit: 'bag',
        minimumStock: 100,
        averagePrice: 400,
        supplier: 'Test Suppliers',
      });
    material = res.body.data;
  });

  it('records opening stock as an adjustment transaction', async () => {
    const withOpening = await request(app)
      .post('/api/materials')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        name: 'River Sand',
        category: 'sand',
        unit: 'brass',
        currentStock: 5,
        minimumStock: 2,
        averagePrice: 5000,
      });
    expect(withOpening.status).toBe(201);
    expect(withOpening.body.data.currentStock).toBe(5);

    const detail = await request(app)
      .get(`/api/materials/${withOpening.body.data._id}`)
      .set(authHeader(ownerToken));
    const adjustment = detail.body.data.transactions.find(
      (t: any) => t.type === 'adjustment',
    );
    expect(adjustment.quantity).toBe(5);
  });

  it('purchase increases stock', async () => {
    const res = await request(app)
      .post(`/api/materials/${material._id}/transactions`)
      .set(authHeader(ownerToken))
      .send({ type: 'purchase', quantity: 250, unitPrice: 405, invoiceNumber: 'INV-101' });
    expect(res.status).toBe(201);
    expect(res.body.data.currentStock).toBe(250);
    expect(res.body.data.averagePrice).toBe(405);
  });

  it('usage decreases stock but rejects when insufficient', async () => {
    const use = await request(app)
      .post(`/api/materials/${material._id}/transactions`)
      .set(authHeader(ownerToken))
      .send({ type: 'usage', quantity: 60, notes: 'Slab pour' });
    expect(use.status).toBe(201);
    expect(use.body.data.currentStock).toBe(190);

    const tooMuch = await request(app)
      .post(`/api/materials/${material._id}/transactions`)
      .set(authHeader(ownerToken))
      .send({ type: 'usage', quantity: 9999 });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.message).toMatch(/not enough stock/i);
  });

  it('flags low stock after usage drops below the minimum level', async () => {
    const drop = await request(app)
      .post(`/api/materials/${material._id}/transactions`)
      .set(authHeader(ownerToken))
      .send({ type: 'usage', quantity: 95 });
    expect(drop.status).toBe(201);
    expect(drop.body.data.currentStock).toBeLessThanOrEqual(material.minimumStock);
  });

  it('validates zero quantity transactions', async () => {
    const res = await request(app)
      .post(`/api/materials/${material._id}/transactions`)
      .set(authHeader(ownerToken))
      .send({ type: 'purchase', quantity: 0 });
    expect(res.status).toBe(422);
  });

  it('returns inventory summary with low-stock counts', async () => {
    const res = await request(app)
      .get(`/api/materials?projectId=${project._id}`)
      .set(authHeader(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.summary.lowStockCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.summary.estimatedValue).toBeGreaterThan(0);
  });
});
