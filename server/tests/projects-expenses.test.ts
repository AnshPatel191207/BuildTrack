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

describe.skipIf(skip)('Companies & Projects', () => {
  let ownerToken: string;
  let project: any;

  it('creates a company during onboarding', async () => {
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    const company = await createCompanyViaApi(app, ownerToken);
    expect(company.name).toBe('Seed Builders');

    // Second attempt must conflict.
    const again = await request(app)
      .post('/api/company')
      .set(authHeader(ownerToken))
      .send({ name: 'Another Co', phone: '9800000001', email: 'another@seed.in' });
    expect(again.status).toBe(409);
  });

  it('creates a project with auto project code and returns financial fields', async () => {
    project = await createProjectViaApi(app, ownerToken);
    expect(project.projectCode).toMatch(/^PRJ-\d+$/);
    expect(project.budget).toBe(5_000_000);
    expect(project.spentAmount).toBe(0);
    expect(project.remainingBudget).toBe(5_000_000);
    expect(project.budgetUtilization).toBe(0);
  });

  it('validates negative budget', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(ownerToken))
      .send({
        name: 'Bad Budget Project',
        startDate: '2026-01-10',
        budget: -500,
      });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('rejects end date before start date', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(ownerToken))
      .send({
        name: 'Time Traveller Villa',
        startDate: '2026-06-10',
        expectedEndDate: '2026-01-10',
        budget: 1000,
      });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toMatch(/end date/i);
  });

  it('searches projects by name/client/location', async () => {
    const res = await request(app)
      .get('/api/projects?search=riverside')
      .set(authHeader(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('adds an engineer assigned to the project; engineer sees only assigned projects', async () => {
    const { token } = await addTeamMember(app, ownerToken, 'engineer', [project._id]);

    // Create a second project the engineer is NOT assigned to.
    await createProjectViaApi(app, ownerToken, { name: 'Hidden Mall' });

    const list = await request(app).get('/api/projects').set(authHeader(token));
    expect(list.status).toBe(200);
    const names = list.body.data.map((p: any) => p.name);
    expect(names).toContain('Riverside Apartments');
    expect(names).not.toContain('Hidden Mall');
  });

  it('blocks unassigned users from project detail (access control)', async () => {
    const { token } = await addTeamMember(app, ownerToken, 'engineer'); // no assignments
    const all = await request(app).get('/api/projects').set(authHeader(ownerToken));
    const target = all.body.data.find((p: any) => p.name === 'Riverside Apartments');

    const res = await request(app).get(`/api/projects/${target._id}`).set(authHeader(token));
    expect([403, 404]).toContain(res.status);
  });

  it('prevents workers from creating projects (role authorization)', async () => {
    const { token } = await addTeamMember(app, ownerToken, 'worker');
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(token))
      .send({ name: 'Worker Project', startDate: '2026-02-02', budget: 1000 });
    expect(res.status).toBe(403);
  });

  it('marks a project completed with 100% progress', async () => {
    const res = await request(app)
      .put(`/api/projects/${project._id}`)
      .set(authHeader(ownerToken))
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.data.progressPercentage).toBe(100);
    expect(res.body.data.status).toBe('completed');
  });

  it('deletes a project as owner only', async () => {
    const temp = await createProjectViaApi(app, ownerToken, { name: 'Doomed Project' });
    const del = await request(app).delete(`/api/projects/${temp._id}`).set(authHeader(ownerToken));
    expect(del.status).toBe(200);

    const missing = await request(app)
      .get(`/api/projects/${temp._id}`)
      .set(authHeader(ownerToken));
    expect(missing.status).toBe(404);
  });
});

describe.skipIf(skip)('Expenses & finances', () => {
  let ownerToken: string;
  let project: any;
  let expenseId: string;

  beforeAll(async () => {
    if (skip) return;
    const reg = await registerAndLogin(app);
    ownerToken = reg.token;
    await createCompanyViaApi(app, ownerToken);
    project = await createProjectViaApi(app, ownerToken);
  });

  it('creates an expense and updates the project spent amount', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/expenses')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        category: 'materials',
        title: 'Cement bags — OPC 53',
        amount: 45_500,
        paymentMethod: 'upi',
        date: today,
      });
    expect(res.status).toBe(201);
    expenseId = res.body.data._id;

    const projRes = await request(app)
      .get(`/api/projects/${project._id}`)
      .set(authHeader(ownerToken));
    expect(projRes.body.data.spentAmount).toBe(45_500);
    expect(projRes.body.data.budgetUtilization).toBeCloseTo((45_500 / 5_000_000) * 100, 1);
  });

  it('rejects zero or negative amounts', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/expenses')
      .set(authHeader(ownerToken))
      .send({
        projectId: project._id,
        category: 'labor',
        title: 'Zero rupee labour',
        amount: 0,
        date: today,
      });
    expect(res.status).toBe(422);
  });

  it('deleting an expense reverses the spent amount', async () => {
    const del = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set(authHeader(ownerToken));
    expect(del.status).toBe(200);

    const projRes = await request(app)
      .get(`/api/projects/${project._id}`)
      .set(authHeader(ownerToken));
    expect(projRes.body.data.spentAmount).toBe(0);
  });

  it('returns paginated results with pagination metadata', async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= 7; i++) {
      await request(app)
        .post('/api/expenses')
        .set(authHeader(ownerToken))
        .send({
          projectId: project._id,
          category: 'miscellaneous',
          title: `Petty cash item ${i}`,
          amount: 100 + i,
          date: today,
        });
    }
    const page1 = await request(app)
      .get('/api/expenses?page=1&limit=3')
      .set(authHeader(ownerToken));
    expect(page1.body.data.length).toBe(3);
    expect(page1.body.pagination.total).toBe(7);
    expect(page1.body.pagination.totalPages).toBe(3);
  });

  it('provides analytics breakdown by category', async () => {
    const res = await request(app)
      .get('/api/expenses/analytics')
      .set(authHeader(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.byCategory.some((c: any) => c._id === 'miscellaneous')).toBe(true);
    expect(res.body.data.totalSpent).toBeGreaterThan(0);
  });

  it('flags over-budget state in project dashboard', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Create a tiny-budget project then exceed it.
    const tiny = await createProjectViaApi(app, ownerToken, {
      name: 'Tiny Shed',
      budget: 1000,
    });
    await request(app)
      .post('/api/expenses')
      .set(authHeader(ownerToken))
      .send({
        projectId: tiny._id,
        category: 'equipment',
        title: 'Concrete mixer hire',
        amount: 2500,
        date: today,
      });
    const dash = await request(app)
      .get(`/api/projects/${tiny._id}/dashboard`)
      .set(authHeader(ownerToken));
    expect(dash.status).toBe(200);
    expect(dash.body.data.financial.overBudget).toBe(true);
    expect(dash.body.data.financial.overBy).toBe(1500);
  });
});
