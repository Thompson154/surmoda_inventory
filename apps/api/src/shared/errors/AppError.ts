import type { ErrorCode } from '../constants/errorCodes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    // WHY: do NOT call Object.setPrototypeOf here — it breaks `instanceof` for subclasses.
    // Modern TS targeting ES2022 keeps the prototype chain correctly via super().
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
