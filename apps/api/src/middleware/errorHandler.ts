import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { errorResponse } from '../utils/responseFormatter';

/**
 * Scrubs credentials, database URLs, and JWT tokens from error logs
 * to prevent accidental secret leakage into centralized log aggregators.
 */
export const sanitizeErrorOutput = (input: any): string => {
  const str = typeof input === 'string' ? input : (input?.stack || input?.message || JSON.stringify(input) || '');
  return str
    .replace(/postgres(ql)?:\/\/[^@\s]+@[^\s/]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/(password|secret|key|token)=([^&\s]+)/gi, '$1=[REDACTED]');
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Safe sanitized logging to console/APM
  const sanitizedLog = sanitizeErrorOutput(err);
  console.error(`[Error Interceptor]: ${sanitizedLog}`);

  if (err instanceof ZodError) {
    const zErr = err as any;
    const issues = zErr.issues || zErr.errors || [];
    const messages = issues
      .map((e: any) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return errorResponse(res, `Validation failed: ${messages}`, 400);
  }

  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  // In production, strictly suppress internal stack traces and server internals
  const clientMessage =
    isProd && statusCode === 500
      ? 'Internal Server Error'
      : err.message || 'Unknown error occurred';

  return errorResponse(res, clientMessage, statusCode);
};
