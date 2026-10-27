import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { errorResponse } from '../utils/responseFormatter';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token =
    req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : undefined);

  if (!token) {
    return errorResponse(res, 'Unauthorized: No access token provided', 401);
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return errorResponse(res, 'Unauthorized: Invalid or expired token', 401);
  }
};
