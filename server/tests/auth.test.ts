import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  startTestEnv,
  stopTestEnv,
  registerAndLogin,
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

describe.skipIf(skip)('Authentication', () => {
  it('registers a new owner and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Nirav Shah',
        email: 'nirav@test.in',
        phone: '9825000001',
        password: 'Password1',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('nirav@test.in');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    // passwordHash must never leak
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects duplicate email with a friendly message', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'First User', email: 'dup@test.in', phone: '9825000002', password: 'Password1',
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Second User', email: 'dup@test.in', phone: '9825000003', password: 'Password1',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X', email: 'not-an-email', phone: '1234', password: 'short',
    });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Test', email: 'login@test.in', phone: '9825000004', password: 'Password1',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.in', password: 'Password1' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects wrong password without leaking info', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.in', password: 'WrongPass9' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/incorrect/i);
  });

  it('returns current user for /me with valid token', async () => {
    const { token } = await registerAndLogin(app);
    const res = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBeTruthy();
  });

  it('rejects /me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('refreshes the session and rotates the refresh token', async () => {
    const { refreshToken } = await registerAndLogin(app, { email: `rf${Date.now()}@test.in` });
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeTruthy();

    // Old token must now be revoked (rotation).
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('changes password and invalidates old one', async () => {
    const reg = await registerAndLogin(app, { email: `pw${Date.now()}@test.in`, password: 'Password1' });
    const changed = await request(app)
      .put('/api/auth/change-password')
      .set(authHeader(reg.token))
      .send({ currentPassword: 'Password1', newPassword: 'NewPassword2' });
    expect(changed.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: reg.user.email, password: 'Password1' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: reg.user.email, password: 'NewPassword2' });
    expect(newLogin.status).toBe(200);
  });
});
