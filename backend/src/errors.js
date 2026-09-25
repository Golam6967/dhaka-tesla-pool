class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class ValidationError extends HttpError {
  constructor(message) {
    super(400, message);
  }
}

class UnauthorizedError extends HttpError {
  constructor(message = 'Invalid credentials') {
    super(401, message);
  }
}

class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

class ConflictError extends HttpError {
  constructor(message) {
    super(409, message);
  }
}

module.exports = {
  HttpError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
