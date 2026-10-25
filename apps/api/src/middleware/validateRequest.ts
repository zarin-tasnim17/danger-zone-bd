import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const zErr = error as any;
        const issues = zErr.issues || zErr.errors || [];
        const messages = issues.map((e: any) => `${(e.path && e.path.join('.')) || 'field'}: ${e.message}`).join(', ');
        return res.status(400).json({
          success: false,
          error: { message: `Validation failed: ${messages}` }
        });
      }
      next(error);
    }
  };
};
