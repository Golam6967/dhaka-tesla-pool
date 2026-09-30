const { errorHandler } = require('../src/middleware/errorHandler');
const { ValidationError } = require('../src/errors');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('errorHandler', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns a typed HttpError message and status as-is', () => {
    const res = mockRes();
    errorHandler(new ValidationError('seatsRequested must be positive'), {}, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'seatsRequested must be positive' });
  });

  it('never leaks an unexpected error\'s message — generic 500 instead', () => {
    const res = mockRes();
    const rawDbError = new Error('duplicate key value violates unique constraint "users_phone_key"');

    errorHandler(rawDbError, {}, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toMatch(/constraint|phone_key|duplicate/i);
  });

  it('still logs the full error server-side for debugging', () => {
    const res = mockRes();
    const rawDbError = new Error('some internal detail');

    errorHandler(rawDbError, {}, res, () => {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(rawDbError);
  });
});
