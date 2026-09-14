import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';

let mongod: MongoMemoryServer | null = null;
let app: Express | null = null;

/**
 * Boots an in-memory MongoDB for tests. If the binary cannot be downloaded
 * (offline CI machines), set SKIP_DB_TESTS=1 to skip gracefully.
 */
export async function startTestEnv(): Promise<Express> {
  if (app) return app;

  if (process.env.USE_REAL_MONGO) {
    const { connectDatabase } = await import('../src/config/db');
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/buildtrack_test';
    await connectDatabase();
  } else if (process.env.SKIP_DB_TESTS !== '1') {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('buildtrack_test');
    const { connectDatabase } = await import('../src/config/db');
    await connectDatabase();
  }

  const { createApp } = await import('../src/app');
  app = createApp();
  return app!;
}

export async function stopTestEnv(): Promise<void> {
  const { disconnectDatabase } = await import('../src/config/db');
  await disconnectDatabase().catch(() => {});
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
  app = null;
}

export async function registerAndLogin(
  appInstance: Express,
  overrides: Record<string, unknown> = {},
): Promise<{ token: string; user: any; refreshToken: string }> {
  const res = await request(appInstance)
    .post('/api/auth/register')
    .send({
      name: 'Test Owner',
      email: `owner${Math.random().toString(36).slice(2)}@test.in`,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      password: 'Password1',
      ...overrides,
    });
  if (!res.body.success) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return {
    token: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    user: res.body.data.user,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createCompanyViaApi(
  appInstance: Express,
  token: string,
): Promise<any> {
  const res = await request(appInstance)
    .post('/api/company')
    .set(authHeader(token))
    .send({ name: 'Seed Builders', phone: '9800000000', email: 'office@seed.in', address: 'MG Road, Ahmedabad' });
  return res.body.data;
}

export async function createProjectViaApi(
  appInstance: Express,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const res = await request(appInstance)
    .post('/api/projects')
    .set(authHeader(token))
    .send({
      name: 'Riverside Apartments',
      clientName: 'Asha Nivas Trust',
      location: 'Navrangpura, Ahmedabad',
      projectType: 'residential',
      startDate: '2026-01-10',
      expectedEndDate: '2026-12-20',
      budget: 5_000_000,
      ...overrides,
    });
  if (!res.body.success) throw new Error(`project failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export async function addTeamMember(
  appInstance: Express,
  ownerToken: string,
  role: string,
  projectIds: any[] = [],
): Promise<{ token: string; user: any }> {
  const email = `${role}${Math.random().toString(36).slice(2)}@test.in`;
  const res = await request(appInstance)
    .post('/api/company/team')
    .set(authHeader(ownerToken))
    .send({
      name: `${role[0].toUpperCase()}${role.slice(1)} User`,
      email,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      role,
      password: 'Password1',
      assignedProjects: projectIds,
    });
  const loginRes = await request(appInstance)
    .post('/api/auth/login')
    .send({ email, password: 'Password1' });
  return { token: loginRes.body.data.accessToken, user: loginRes.body.data.user };
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export { mongoose };
