import morgan from 'morgan';
import type { Request } from 'express';
import { env } from '../config/env';

morgan.token('user', ((req: Request) => (req.user ? String(req.user._id) : '-')) as any);

export const httpLogger = morgan(
  env.isProd
    ? ':method :url :status :res[content-length] - :response-time ms u=:user'
    : ':method :url :status :response-time ms',
);

export function logInfo(...args: unknown[]) {
  console.log('[info]', ...args);
}

export function logError(message: string, error?: unknown) {
  console.error('[error]', message, error instanceof Error ? error.stack : error ?? '');
}

/** Never leak internals to clients in production. */
export function clientErrorMessage(error: unknown, fallback: string): string {
  if (env.isProd) return fallback;
  return error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback;
}
