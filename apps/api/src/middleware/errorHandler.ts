import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { errorResponse } from '../utils/responseFormatter';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[Error]:', err);

  if (err instanceof ZodError) {
    const zErr = err as any;
    const messages = zErr.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return errorResponse(res, `Validation failed: ${messages}`, 400);
  }

  // Handle known application errors or DB constraints here if needed

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : err.message || 'Unknown error occurred';

  return errorResponse(res, message, statusCode);
};
