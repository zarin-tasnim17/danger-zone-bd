import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { errorResponse } from '../utils/responseFormatter';

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized: User not authenticated', 401);
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return errorResponse(res, 'Forbidden: Insufficient permissions', 403);
    }

    next();
  };
};
