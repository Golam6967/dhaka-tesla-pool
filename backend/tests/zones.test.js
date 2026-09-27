const request = require('supertest');
const { createApp } = require('../src/app');
const { pool: appPool } = require('../src/db/pool');
const { truncateAll, testPool, insertCorridor, insertZone } = require('./helpers/testDb');

const app = createApp();

describe('GET /api/zones', () => {
  afterAll(async () => {
    await testPool.end();
    await appPool.end();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it('lists zones with their corridor name, no auth required', async () => {
    const corridorId = await insertCorridor('Banani-Gulshan-Mohakhali');
    await insertZone({ name: 'Banani', corridorId });
    await insertZone({ name: 'Mohakhali', corridorId });

    const res = await request(app).get('/api/zones');

    expect(res.status).toBe(200);
    expect(res.body.zones).toHaveLength(2);
    expect(res.body.zones[0]).toMatchObject({
      name: expect.any(String),
      corridorId,
      corridorName: 'Banani-Gulshan-Mohakhali',
    });
  });

  it('returns an empty list when no zones exist', async () => {
    const res = await request(app).get('/api/zones');

    expect(res.status).toBe(200);
    expect(res.body.zones).toEqual([]);
  });
});
