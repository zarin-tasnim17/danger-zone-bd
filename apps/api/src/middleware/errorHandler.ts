import { ErrorRequestHandler } from 'express';
import { ApiResponse } from '@repo/shared';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  const response: ApiResponse = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred'
    }
  };

  res.status(err.status || 500).json(response);
};
