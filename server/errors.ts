export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "INTERNAL_ERROR",
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Resource") {
    super(404, `${what} not found`, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "Invalid request", "VALIDATION_ERROR", details);
  }
}