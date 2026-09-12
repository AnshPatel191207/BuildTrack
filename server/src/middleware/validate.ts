import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Middleware that validates and coerces request data with zod.
 * Accepts either `{ body, query }` options or a bare schema (treated as body).
 * Parsed results are exposed as req.validatedBody / req.validatedQuery.
 */
export const validate =
  (schemaOrOptions: ZodSchema | ValidateOptions): RequestHandler =>
  (req, _res, next) => {
    try {
      const options: ValidateOptions =
        'parse' in schemaOrOptions ? { body: schemaOrOptions as ZodSchema } : schemaOrOptions;
      if (options.body) {
        (req as any).validatedBody = options.body.parse(req.body ?? {});
      }
      if (options.query) {
        (req as any).validatedQuery = options.query.parse(req.query ?? {});
      }
      next();
    } catch (err) {
      next(err);
    }
  };
