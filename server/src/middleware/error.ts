import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/apiResponse';
import { logError } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

interface NormalisedError {
  status: number;
  message: string;
  errors?: { field?: string; message: string }[];
}

function normalise(err: unknown): NormalisedError {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message, errors: err.errors };
  }

  if (err instanceof ZodError) {
    return {
      status: 422,
      message: err.issues[0]?.message ?? 'Please check the submitted values.',
      errors: err.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      status: 422,
      message: 'Please check the submitted values.',
      errors: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    };
  }

  const anyErr = err as { code?: number; keyValue?: Record<string, unknown>; name?: string };
  if (anyErr?.code === 11000) {
    const field = Object.keys(anyErr.keyValue ?? {})[0];
    let friendly = 'This record already exists.';
    if (field === 'email') friendly = 'An account with this email already exists.';
    if (field === 'workerId' || field === 'date') {
      friendly = "Attendance for this worker has already been marked on this date.";
    }
    return { status: 409, message: friendly };
  }

  if ((err as any)?.name === 'CastError') {
    return { status: 400, message: 'Invalid identifier provided.' };
  }

  // JWT errors
  if ((err as any)?.name === 'TokenError' || (err as any)?.name === 'JsonWebTokenError') {
    return { status: 401, message: 'Your session is invalid. Please sign in again.' };
  }

  return { status: 500, message: 'Something went wrong on our side. Please try again.' };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  const normalised = normalise(err);

  if (normalised.status >= 500) {
    logError(`${req.method} ${req.originalUrl} failed`, err);
  }

  if (res.headersSent) return;

  res.status(normalised.status).json({
    success: false,
    message: normalised.message,
    ...(normalised.errors ? { errors: normalised.errors } : {}),
  });
}
