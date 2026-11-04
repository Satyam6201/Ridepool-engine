export class AppError extends Error {
  constructor(msg, status = 500) {
    super(msg);
    this.status = status;
    this.isPublic = true;
  }
}

export class BadRequest extends AppError {
  constructor(msg = "Bad request") {
    super(msg, 400);
  }
}

export class Unauthorized extends AppError {
  constructor(msg = "Unauthorized") {
    super(msg, 401);
  }
}

export class Forbidden extends AppError {
  constructor(msg = "Forbidden") {
    super(msg, 403);
  }
}

export class NotFound extends AppError {
  constructor(msg = "Not found") {
    super(msg, 404);
  }
}

export class Conflict extends AppError {
  constructor(msg = "Conflict") {
    super(msg, 409);
  }
}
