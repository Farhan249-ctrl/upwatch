const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('b. Ownership Scoping Test Suite', () => {
  let tokenA;
  let tokenB;
  let monitorAId;

  beforeAll(async () => {
    await setupTestDB();

    const regA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User A',
        email: 'userA@example.com',
        password: 'password123',
      });
    tokenA = regA.body.token;

    const regB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User B',
        email: 'userB@example.com',
        password: 'password123',
      });
    tokenB = regB.body.token;

    // User A creates a monitor
    const monRes = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: "User A's Service",
        url: 'http://127.0.0.1:4000/api/health',
        intervalSeconds: 60,
      });
    expect(monRes.status).toBe(201);
    monitorAId = monRes.body._id;
  });

  afterAll(async () => {
    await tearDownTestDB();
  });

  test("User B cannot read User A's monitor", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  test("User B cannot edit/patch User A's monitor", async () => {
    const res = await request(app)
      .patch(`/api/monitors/${monitorAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked By B' });

    expect(res.status).toBe(404);
  });

  test("User B cannot delete User A's monitor", async () => {
    const res = await request(app)
      .delete(`/api/monitors/${monitorAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  test("User B's monitor list does not contain User A's monitor", async () => {
    const res = await request(app)
      .get('/api/monitors')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const found = res.body.find(m => m._id === monitorAId);
    expect(found).toBeUndefined();
  });
});
