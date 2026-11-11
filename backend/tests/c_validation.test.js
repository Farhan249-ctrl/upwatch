const request = require('supertest');
const app = require('../src/app');
const { setupTestDB, tearDownTestDB } = require('./setup');

describe('c. Validation Test Suite', () => {
  let token;

  beforeAll(async () => {
    await setupTestDB();

    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Validator User',
        email: 'valuser@example.com',
        password: 'password123',
      });
    token = reg.body.token;
  });

  afterAll(async () => {
    await tearDownTestDB();
  });

  test('should reject non-http/https URL', async () => {
    const res = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'FTP Monitor',
        url: 'ftp://ftp.example.com/file.txt',
        intervalSeconds: 60,
      });

    expect(res.status).toBe(400);
  });

  test('should strictly block 169.254.0.0/16 link-local metadata targets', async () => {
    const res = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'AWS Metadata Probe',
        url: 'http://169.254.169.254/latest/meta-data',
        intervalSeconds: 60,
      });

    expect(res.status).toBe(400);
  });

  test('should reject malformed URL string', async () => {
    const res = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Malformed URL',
        url: 'ht!tp://--bad-url',
        intervalSeconds: 60,
      });

    expect(res.status).toBe(400);
  });

  test('should reject invalid intervalSeconds', async () => {
    const res = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad Interval',
        url: 'http://127.0.0.1:4000/api/health',
        intervalSeconds: 45, // allowed are 15, 30, 60, 300
      });

    expect(res.status).toBe(400);
  });

  test('should enforce maximum of 20 monitors and reject the 21st monitor', async () => {
    // Create 20 valid monitors
    for (let i = 1; i <= 20; i++) {
      const res = await request(app)
        .post('/api/monitors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Monitor #${i}`,
          url: 'http://127.0.0.1:4000/api/health',
          intervalSeconds: 60,
        });
      expect(res.status).toBe(201);
    }

    // Attempt to create the 21st monitor
    const rejected = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Monitor #21 Overflow',
        url: 'http://127.0.0.1:4000/api/health',
        intervalSeconds: 60,
      });

    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toMatch(/Maximum limit of 20 monitors/i);
  });
});
