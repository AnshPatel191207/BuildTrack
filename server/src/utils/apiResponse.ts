import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: { field?: string; message: string }[];

  constructor(status: number, message: string, errors?: { field?: string; message: string }[]) {
    super(message);
    this.status = status;
    this.errors = errors;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, errors?: { field?: string; message: string }[]) {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = 'Please sign in to continue.') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to do this.') {
    return new ApiError(403, message);
  }
  static notFound(message = 'The requested item was not found.') {
    return new ApiError(404, message);
  }
  static conflict(message: string) {
    return new ApiError(409, message);
  }
  static unprocessable(message: string, errors?: { field?: string; message: string }[]) {
    return new ApiError(422, message, errors);
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

interface SendOptions {
  status?: number;
  pagination?: unknown;
  extra?: Record<string, unknown>;
}

export function sendSuccess(
  res: Response,
  data: unknown,
  message = 'Success',
  options: SendOptions = {},
) {
  const body: Record<string, unknown> = { success: true, message, data };
  if (options.pagination) body.pagination = options.pagination;
  if (options.extra) Object.assign(body, options.extra);
  res.status(options.status ?? 200).json(body);
}

export function sendCreated(res: Response, data: unknown, message = 'Created successfully') {
  sendSuccess(res, data, message, { status: 201 });
}
